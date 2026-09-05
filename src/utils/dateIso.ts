const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const todayLocalIso = (): string => formatLocalDate(new Date());

export const parseIsoDate = (iso: string): Date => {
  const match = ISO_DATE.exec(iso.trim());
  if (!match) {
    return new Date(NaN);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return new Date(year, month - 1, day);
};

export const isValidIsoDate = (iso: string): boolean => {
  if (!ISO_DATE.test(iso.trim())) {
    return false;
  }
  const parsed = parseIsoDate(iso);
  return !Number.isNaN(parsed.getTime()) && formatLocalDate(parsed) === iso.trim();
};

export const addDays = (iso: string, days: number): string => {
  const date = parseIsoDate(iso);
  date.setDate(date.getDate() + days);
  return formatLocalDate(date);
};

export const lastDayOfMonth = (year: number, monthIndex: number): number => {
  return new Date(year, monthIndex + 1, 0).getDate();
};

export const addMonthsClamped = (
  iso: string,
  months: number,
  dayOfMonth: number
): string => {
  const date = parseIsoDate(iso);
  const target = date.getMonth() + months;
  const year = date.getFullYear() + Math.floor(target / 12);
  const month = ((target % 12) + 12) % 12;
  const day = Math.min(Math.max(1, dayOfMonth), lastDayOfMonth(year, month));
  return formatLocalDate(new Date(year, month, day));
};

export const dateAtLocalHour = (iso: string, hour: number): Date => {
  const date = parseIsoDate(iso);
  date.setHours(Math.max(0, Math.min(23, hour)), 0, 0, 0);
  return date;
};

export const formatDisplayDate = (iso: string): string => {
  if (!isValidIsoDate(iso)) {
    return iso;
  }
  return parseIsoDate(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

export const parseUserDate = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (isValidIsoDate(trimmed)) {
    return trimmed;
  }

  const au = trimmed.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (au) {
    const day = Number(au[1]);
    const month = Number(au[2]);
    const year = Number(au[3]);
    const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return isValidIsoDate(iso) ? iso : null;
  }

  return null;
};

export const daysUntil = (iso: string): number => {
  const today = parseIsoDate(todayLocalIso());
  const target = parseIsoDate(iso);
  const ms = target.getTime() - today.getTime();
  return Math.round(ms / 86400000);
};

export const toUserDateInput = (iso: string): string => {
  if (!isValidIsoDate(iso)) {
    return iso;
  }
  const date = parseIsoDate(iso);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getFullYear()}`;
};
