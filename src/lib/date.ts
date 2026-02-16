import { endOfDay, startOfDay, subDays } from "date-fns";

export type DateRangePreset = "7" | "30" | "90";

export function getDateRangeFromPreset(preset: DateRangePreset): { startDate: Date; endDate: Date } {
  const endDate = endOfDay(new Date());
  const days = Number(preset);
  const startDate = startOfDay(subDays(endDate, days - 1));

  return { startDate, endDate };
}

export function getPresetLabel(preset: DateRangePreset): string {
  if (preset === "7") return "Last 7 days";
  if (preset === "30") return "Last 30 days";
  return "Last 90 days";
}
