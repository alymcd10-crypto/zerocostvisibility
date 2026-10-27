// Booking rules for the built-in calendar. The single source of truth: the bookings
// function enforces them and sends them to the Book page, which draws the calendar from them.
// Edit here to change open days, times, notice or days off.

export const BOOKING_RULES = {
  weekdays: [2, 3, 4], // 0 = Sunday … 6 = Saturday (Tue, Wed, Thu)
  times: ["9:00 AM", "11:00 AM", "1:30 PM", "4:00 PM"],
  minNoticeDays: 2, // earliest bookable day, counted from today in Central Time
  weeksAhead: 10, // how far out the calendar goes
  blockedDates: [] as string[], // days off, as 'YYYY-MM-DD'
  timezone: "America/Chicago",
  timezoneLabel: "Central Time",
  maxActivePerEmail: 2, // pending or confirmed future sessions one email can hold
};

export type BookingRules = typeof BOOKING_RULES;

// Today's date in the booking timezone, as YYYY-MM-DD.
export function todayIn(timezone: string, now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function bookableRange(rules: BookingRules, now = new Date()): { first: string; last: string } {
  const today = todayIn(rules.timezone, now);
  return { first: addDays(today, rules.minNoticeDays), last: addDays(today, rules.weeksAhead * 7) };
}

// Returns an error message for a slot outside the rules, or null when the slot is bookable.
export function slotError(rules: BookingRules, date: string, time: string, now = new Date()): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T12:00:00Z`)) || addDays(date, 0) !== date) {
    return "Please pick a day from the calendar.";
  }
  const { first, last } = bookableRange(rules, now);
  if (date < first) return "That day is too soon to book. Please pick a later day.";
  if (date > last) return "That day isn't open for booking yet. Please pick an earlier day.";
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  if (!rules.weekdays.includes(weekday) || rules.blockedDates.includes(date)) return "Liz isn't taking sessions that day. Please pick another.";
  if (!rules.times.includes(time)) return "Please pick one of the listed times.";
  return null;
}
