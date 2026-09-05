export type ThemeMode = "auto" | "light" | "dark";

export interface AppSettings {
  themeMode: ThemeMode;
  reminderNotificationsEnabled: boolean;
  defaultNotifyHour: number;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  themeMode: "auto",
  reminderNotificationsEnabled: false,
  defaultNotifyHour: 9,
};
