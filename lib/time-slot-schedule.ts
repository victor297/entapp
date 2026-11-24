export const WEEKDAYS = [
  { label: "Monday", day: 1 },
  { label: "Tuesday", day: 2 },
  { label: "Wednesday", day: 3 },
  { label: "Thursday", day: 4 },
  { label: "Friday", day: 5 },
  { label: "Saturday", day: 6 },
  { label: "Sunday", day: 0 },
] as const;

export interface DayAvailability {
  enabled: boolean;
  start: string;
  end: string;
}

export interface GeneratedTimeSlot {
  startTime: string;
  endTime: string;
}

function parseDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error("Choose a valid start and end date.");
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (date.getFullYear() !== Number(match[1]) || date.getMonth() !== Number(match[2]) - 1 || date.getDate() !== Number(match[3])) {
    throw new Error("Choose a valid start and end date.");
  }
  return date;
}

export function addCalendarMonths(value: string, months: number) {
  const date = parseDate(value);
  const originalDay = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + months);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(originalDay, lastDay));
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function timeInMinutes(value: string, label: string) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) throw new Error(`Choose a valid ${label} time.`);
  return Number(match[1]) * 60 + Number(match[2]);
}

export function generateWeeklySlots({
  startDate,
  endDate,
  days,
  sharedHours,
  useSharedHours,
  slotDurationMinutes,
  gapMinutes,
}: {
  startDate: string;
  endDate: string;
  days: Record<number, DayAvailability>;
  sharedHours: { start: string; end: string };
  useSharedHours: boolean;
  slotDurationMinutes: number;
  gapMinutes: number;
}): GeneratedTimeSlot[] {
  const firstDay = parseDate(startDate);
  const lastDay = parseDate(endDate);
  if (lastDay < firstDay) throw new Error("The end date must be on or after the start date.");
  if (endDate > addCalendarMonths(startDate, 6)) throw new Error("You can create availability for no more than six months at a time.");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (firstDay < today) throw new Error("The start date cannot be in the past.");
  if (!Number.isInteger(slotDurationMinutes) || slotDurationMinutes < 1) throw new Error("Slot duration must be at least one minute.");
  if (!Number.isInteger(gapMinutes) || gapMinutes < 0) throw new Error("Gap between slots must be zero or more whole minutes.");
  if (!Object.values(days).some(day => day.enabled)) throw new Error("Select at least one available day.");

  const generated: GeneratedTimeSlot[] = [];
  for (const { day: weekday } of WEEKDAYS) {
    const availability = days[weekday];
    if (!availability?.enabled) continue;
    const start = timeInMinutes(useSharedHours ? sharedHours.start : availability.start, "start");
    const end = timeInMinutes(useSharedHours ? sharedHours.end : availability.end, "end");
    if (end <= start) throw new Error(`${WEEKDAYS.find(item => item.day === weekday)?.label} end time must be after its start time.`);
    if (end - start < slotDurationMinutes) throw new Error(`${WEEKDAYS.find(item => item.day === weekday)?.label} availability is shorter than one slot.`);

    const cursor = new Date(firstDay);
    while (cursor <= lastDay) {
      if (cursor.getDay() === weekday) {
        for (let minute = start; minute + slotDurationMinutes <= end; minute += slotDurationMinutes + gapMinutes) {
          const slotStart = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), Math.floor(minute / 60), minute % 60);
          if (slotStart.getTime() <= Date.now()) continue;
          const slotEnd = new Date(slotStart.getTime() + slotDurationMinutes * 60_000);
          generated.push({ startTime: slotStart.toISOString(), endTime: slotEnd.toISOString() });
        }
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  if (!generated.length) throw new Error("No slots fit the selected days, hours, and date range.");
  return generated.sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime));
}

export function findOverlappingSlots(generated: GeneratedTimeSlot[], existing: { startTime: string; endTime: string; deletedAt?: string | null }[]) {
  return generated.filter(slot => existing.some(other =>
    !other.deletedAt &&
    Date.parse(other.startTime) < Date.parse(slot.endTime) &&
    Date.parse(other.endTime) > Date.parse(slot.startTime)
  ));
}
