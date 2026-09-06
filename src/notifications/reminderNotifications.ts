import { isRunningInExpoGo } from "expo";
import { Linking, Platform } from "react-native";

import { t } from "../i18n/translate";
import { type LoanReminder, REMINDER_DISCLAIMER, leadKey } from "../types/reminder";
import { formatCurrency } from "../utils/format";
import { formatDisplayDate } from "../utils/dateIso";
import { projectUpcomingCycles } from "../utils/reminderMath";
import { leadFireDate } from "../utils/reminderSchedule";

import type * as ExpoNotifications from "expo-notifications";

export const REMINDER_CHANNEL_ID = "loan-reminders";
const MAX_SCHEDULED_NOTIFICATIONS = 60;
const IDENTIFIER_PREFIX = "slc-rem-";

export type OsPermissionStatus =
  | "granted"
  | "denied"
  | "undetermined"
  | "unsupported";

type NotificationsModule = typeof ExpoNotifications;

const runningInExpoGo = isRunningInExpoGo();

export const reminderNotificationsSupported =
  (Platform.OS === "ios" || Platform.OS === "android") && !runningInExpoGo;

/**
 * A function, not a const: catalogues resolve at call time, and a module-level
 * const would freeze the English copy at import, before settings have loaded.
 */
export const notificationUnavailableHint = (): string =>
  runningInExpoGo
    ? t("notifications.unavailable.expoGo")
    : Platform.OS === "web"
      ? t("notifications.unavailable.web")
      : t("notifications.unavailable.device");

let notificationsModule: NotificationsModule | null | undefined;
let handlerReady = false;

const loadNotifications = (): NotificationsModule | null => {
  if (!reminderNotificationsSupported) {
    return null;
  }
  if (notificationsModule !== undefined) {
    return notificationsModule;
  }
  try {
    // Loaded only in a dev/production build. A top-level import crashes Expo Go on Android.
    const loaded = require("expo-notifications") as NotificationsModule;
    notificationsModule = loaded;
    if (!handlerReady) {
      loaded.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });
      handlerReady = true;
    }
    return loaded;
  } catch {
    notificationsModule = null;
    return null;
  }
};

const isOurIdentifier = (identifier: string): boolean =>
  identifier.startsWith(IDENTIFIER_PREFIX);

export const openPhoneNotificationSettings = async (): Promise<void> => {
  await Linking.openSettings();
};

export const getOsPermissionStatus = async (): Promise<OsPermissionStatus> => {
  const Notifications = loadNotifications();
  if (!Notifications) {
    return "unsupported";
  }
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted || current.status === "granted") {
      return "granted";
    }
    if (current.status === "undetermined" || current.status === "denied") {
      if (current.canAskAgain === false && current.status !== "undetermined") {
        return "denied";
      }
      return current.status === "undetermined" ? "undetermined" : "denied";
    }
    return current.granted ? "granted" : "denied";
  } catch {
    return "unsupported";
  }
};

const ensureAndroidChannel = async (
  Notifications: NotificationsModule
): Promise<void> => {
  if (Platform.OS !== "android") {
    return;
  }
  await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
    name: t("notifications.channelName"),
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#2563EB",
  });
};

export const requestReminderPermissions = async (): Promise<OsPermissionStatus> => {
  const Notifications = loadNotifications();
  if (!Notifications) {
    return "unsupported";
  }
  const current = await getOsPermissionStatus();
  if (current === "granted") {
    await ensureAndroidChannel(Notifications);
    return "granted";
  }
  if (current === "denied") {
    return "denied";
  }
  try {
    const result = await Notifications.requestPermissionsAsync();
    const granted = result.granted || result.status === "granted";
    if (granted) {
      await ensureAndroidChannel(Notifications);
      return "granted";
    }
    return "denied";
  } catch {
    return "denied";
  }
};

const cancelOurScheduledNotifications = async (): Promise<void> => {
  const Notifications = loadNotifications();
  if (!Notifications) {
    return;
  }
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter((item) => isOurIdentifier(item.identifier))
        .map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier))
    );
  } catch {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch {
      // Keep reminder tracking even if the OS queue cannot be cleared.
    }
  }
};

const leadTitle = (name: string, leadDays: number): string => {
  if (leadDays <= 0) {
    return t("notifications.leadTitle.today", { name });
  }
  if (leadDays === 1) {
    return t("notifications.leadTitle.tomorrow", { name });
  }
  return t("notifications.leadTitle.inDays", { name, count: leadDays });
};

interface PlannedNotification {
  identifier: string;
  reminderId: string;
  fireAt: Date;
  title: string;
  body: string;
}

export const refillReminderNotifications = async (
  reminders: LoanReminder[],
  options: { masterEnabled: boolean; notifyHour: number }
): Promise<LoanReminder[]> => {
  const cleared = reminders.map((item) => ({
    ...item,
    scheduledNotificationIds: [] as string[],
  }));

  const Notifications = loadNotifications();
  if (!Notifications || !options.masterEnabled) {
    await cancelOurScheduledNotifications();
    return cleared;
  }

  const permission = await getOsPermissionStatus();
  if (permission !== "granted") {
    await cancelOurScheduledNotifications();
    return cleared;
  }

  await ensureAndroidChannel(Notifications);
  await cancelOurScheduledNotifications();

  const now = Date.now();
  const planned: PlannedNotification[] = [];

  for (const reminder of reminders) {
    if (
      reminder.status !== "active" ||
      !reminder.notificationsEnabled ||
      reminder.notifyLeads.length === 0
    ) {
      continue;
    }

    const cycles = projectUpcomingCycles(reminder, 365, 52);
    for (const cycle of cycles) {
      for (const lead of reminder.notifyLeads) {
        const fireAt = leadFireDate(cycle.date, lead, options.notifyHour);
        if (fireAt.getTime() <= now) {
          continue;
        }
        const leadDays = lead.unit === "weeks" ? lead.value * 7 : lead.value;
        const identifier = `${IDENTIFIER_PREFIX}${reminder.id.slice(0, 10)}-${cycle.date}-${leadKey(lead)}`;
        planned.push({
          identifier,
          reminderId: reminder.id,
          fireAt,
          title: leadTitle(reminder.name || t("notifications.fallbackName"), leadDays),
          body: t("notifications.body", {
            amount: formatCurrency(cycle.amountDue, reminder.currencyCode),
            date: formatDisplayDate(cycle.date),
            remaining: formatCurrency(
              reminder.remainingBalance,
              reminder.currencyCode
            ),
          }),
        });
      }
    }
  }

  planned.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime());
  const selected = planned.slice(0, MAX_SCHEDULED_NOTIFICATIONS);
  const idsByReminder = new Map<string, string[]>();

  for (const item of selected) {
    try {
      const id = await Notifications.scheduleNotificationAsync({
        identifier: item.identifier,
        content: {
          title: item.title,
          body: item.body,
          data: { reminderId: item.reminderId },
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: item.fireAt,
          ...(Platform.OS === "android" ? { channelId: REMINDER_CHANNEL_ID } : {}),
        },
      });
      const list = idsByReminder.get(item.reminderId) ?? [];
      list.push(id);
      idsByReminder.set(item.reminderId, list);
    } catch {
      // Keep tracking even if a single schedule fails.
    }
  }

  return cleared.map((item) => ({
    ...item,
    scheduledNotificationIds: idsByReminder.get(item.id) ?? [],
  }));
};

/**
 * Clears already-delivered reminder notifications from the system tray (and
 * with them the launcher's badge), for reminders the user has just looked at.
 * Only touches notifications this app posted, and only delivered ones -
 * scheduled future alerts are untouched.
 *
 * Pass reminder ids to dismiss just those; omit to clear all of ours.
 */
export const dismissDeliveredReminderNotifications = async (
  reminderIds?: string[]
): Promise<void> => {
  const Notifications = loadNotifications();
  if (!Notifications) {
    return;
  }

  const wanted = reminderIds ? new Set(reminderIds) : null;
  if (wanted && wanted.size === 0) {
    return;
  }

  try {
    const presented = await Notifications.getPresentedNotificationsAsync();
    await Promise.all(
      presented
        .filter((item) => {
          const identifier = item.request.identifier;
          if (!isOurIdentifier(identifier)) {
            return false;
          }
          if (!wanted) {
            return true;
          }
          const data = item.request.content.data as
            | { reminderId?: string }
            | undefined;
          return typeof data?.reminderId === "string" && wanted.has(data.reminderId);
        })
        .map((item) => Notifications.dismissNotificationAsync(item.request.identifier))
    );
  } catch {
    // A tray we cannot read or clear must never block opening the screen.
  }
};

export const permissionStatusLabel = (status: OsPermissionStatus): string => {
  switch (status) {
    case "granted":
      return t("notifications.permission.granted");
    case "denied":
      return t("notifications.permission.denied");
    case "undetermined":
      return t("notifications.permission.undetermined");
    default:
      return runningInExpoGo
        ? t("notifications.permission.needsDevBuild")
        : t("notifications.permission.unavailable");
  }
};

export { REMINDER_DISCLAIMER };
