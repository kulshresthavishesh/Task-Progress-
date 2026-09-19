// Small date + progress helpers. Dates are "YYYY-MM-DD" strings and all maths is done in UTC,
// so results never change because of the server's timezone.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function pad(n) {
  return String(n).padStart(2, '0');
}

// True only for real calendar dates ("2026-02-30" is rejected).
function isValidDate(str) {
  if (typeof str !== 'string' || !DATE_RE.test(str)) return false;
  const [y, m, d] = str.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

// Add (or subtract) days from a "YYYY-MM-DD" string.
function addDays(str, n) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate(); // month is 1-12
}

// completed / total * 100, rounded. No tasks -> 0 (never NaN).
function calcPercent(completed, total) {
  if (!total) return 0;
  return Math.round((completed / total) * 100);
}

// A day counts toward a streak when at least one task was completed on it.
// `completedDates` = every date that has a completed task. `today` = the user's local today.
// The current streak is still alive if today has no completed task yet but yesterday did.
function calculateStreaks(completedDates, today) {
  const unique = [...new Set(completedDates)].sort();
  const set = new Set(unique);

  let longest = 0;
  let run = 0;
  let prev = null;
  for (const d of unique) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    if (run > longest) longest = run;
    prev = d;
  }

  let cursor = set.has(today) ? today : addDays(today, -1);
  let current = 0;
  while (set.has(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }

  return { currentStreak: current, longestStreak: longest };
}

module.exports = { pad, isValidDate, addDays, todayUTC, daysInMonth, calcPercent, calculateStreaks };
