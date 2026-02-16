import { z } from "zod";

import type { DateRangePreset } from "@/lib/date";

const dateRangeSchema = z.enum(["7", "30", "90"]);

export function parseDateRange(value: string | null | undefined): DateRangePreset {
  const parsed = dateRangeSchema.safeParse(value);
  return parsed.success ? parsed.data : "30";
}

export function parsePositiveInt(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) return null;
  return parsed;
}

export function parseBoolean(value: string | null | undefined): boolean | null {
  if (value == null) return null;
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}
