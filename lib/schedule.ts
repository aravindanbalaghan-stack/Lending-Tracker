export const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export type CollectionSchedule = (typeof WEEKDAYS)[number] | "Daily" | "Monthly";

export const SCHEDULE_OPTIONS: CollectionSchedule[] = [
  "Daily",
  ...WEEKDAYS,
  "Monthly",
];

const JS_DAY_TO_WEEKDAY: CollectionSchedule[] = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

// Default schedule tag for a loan given on this date — the weekday it falls on.
export function defaultScheduleForDate(date: Date): CollectionSchedule {
  return JS_DAY_TO_WEEKDAY[date.getDay()];
}

export function isWeekday(schedule: string): schedule is (typeof WEEKDAYS)[number] {
  return (WEEKDAYS as readonly string[]).includes(schedule);
}

export type ScheduleGroup = "daily" | "weekly" | "monthly";

export function scheduleGroup(schedule: string): ScheduleGroup {
  if (schedule === "Daily") return "daily";
  if (schedule === "Monthly") return "monthly";
  return "weekly";
}
