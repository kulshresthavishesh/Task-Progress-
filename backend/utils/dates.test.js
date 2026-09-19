// Run with: npm test   (checks the maths that the whole app depends on)
const assert = require('assert');
const { isValidDate, addDays, calcPercent, calculateStreaks, daysInMonth } = require('./dates');

// Progress
assert.strictEqual(calcPercent(8, 10), 80);
assert.strictEqual(calcPercent(0, 0), 0);
assert.strictEqual(calcPercent(2, 11), 18); // overall, not (100 + 10) / 2
assert.strictEqual(calcPercent(1, 3), 33);

// Dates
assert.ok(isValidDate('2026-09-19'));
assert.ok(isValidDate('2028-02-29'));
assert.ok(!isValidDate('2026-02-29'));
assert.ok(!isValidDate('2026-13-01'));
assert.ok(!isValidDate('19-09-2026'));
assert.strictEqual(addDays('2026-12-31', 1), '2027-01-01');
assert.strictEqual(addDays('2026-03-01', -1), '2026-02-28');
assert.strictEqual(daysInMonth(2028, 2), 29);

// Streaks
const days = ['2026-09-10', '2026-09-11', '2026-09-12', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18', '2026-09-18'];
assert.deepStrictEqual(calculateStreaks(days, '2026-09-18'), { currentStreak: 4, longestStreak: 4 });
assert.deepStrictEqual(calculateStreaks(days, '2026-09-19'), { currentStreak: 4, longestStreak: 4 }); // today not done yet: streak alive
assert.deepStrictEqual(calculateStreaks(days, '2026-09-20'), { currentStreak: 0, longestStreak: 4 }); // missed a full day
assert.deepStrictEqual(calculateStreaks([], '2026-09-19'), { currentStreak: 0, longestStreak: 0 });
assert.deepStrictEqual(calculateStreaks(['2026-12-31', '2027-01-01'], '2027-01-01'), { currentStreak: 2, longestStreak: 2 });

console.log('All date and progress tests passed.');
