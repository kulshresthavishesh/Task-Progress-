// Analytics routes. All numbers are calculated from real tasks in MongoDB.
//
// Important rule: month and year progress = total completed / total tasks.
// We never average daily percentages for that (1/1 and 1/10 is 2/11 = 18%, not 55%).
const express = require('express');
const Task = require('../models/Task');
const auth = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { pad, isValidDate, todayUTC, daysInMonth, calcPercent, calculateStreaks } = require('../utils/dates');

const router = express.Router();
router.use(auth);

// Returns [{ _id: 'YYYY-MM-DD', total, completed }] for the user between two dates (inclusive).
function groupByDate(userId, from, to) {
  return Task.aggregate([
    { $match: { userId, date: { $gte: from, $lte: to } } },
    { $group: { _id: '$date', total: { $sum: 1 }, completed: { $sum: { $cond: ['$completed', 1, 0] } } } },
  ]);
}

function toInt(str) {
  return /^\d+$/.test(str) ? Number(str) : NaN;
}

// GET /api/analytics/streak?today=YYYY-MM-DD
// The browser sends its own local "today" so the streak matches the user's calendar, not the server's.
router.get(
  '/streak',
  asyncHandler(async (req, res) => {
    const today = isValidDate(req.query.today) ? req.query.today : todayUTC();
    const dates = await Task.distinct('date', { userId: req.user._id, completed: true });
    res.json(calculateStreaks(dates, today));
  })
);

// GET /api/analytics/day/:date
router.get(
  '/day/:date',
  asyncHandler(async (req, res) => {
    const { date } = req.params;
    if (!isValidDate(date)) return res.status(400).json({ message: 'Please provide a valid date (YYYY-MM-DD).' });
    const [row] = await groupByDate(req.user._id, date, date);
    const total = row ? row.total : 0;
    const completed = row ? row.completed : 0;
    res.json({ date, total, completed, remaining: total - completed, progress: calcPercent(completed, total) });
  })
);

// GET /api/analytics/month/:year/:month
router.get(
  '/month/:year/:month',
  asyncHandler(async (req, res) => {
    const year = toInt(req.params.year);
    const month = toInt(req.params.month);
    if (!(year >= 2000 && year <= 2100) || !(month >= 1 && month <= 12)) {
      return res.status(400).json({ message: 'Please provide a valid year and month.' });
    }

    const mm = pad(month);
    const rows = await groupByDate(req.user._id, `${year}-${mm}-01`, `${year}-${mm}-31`);
    const byDate = {};
    rows.forEach((r) => (byDate[r._id] = r));

    // One entry for every day of the month (days without tasks have total 0).
    const days = [];
    let totalTasks = 0;
    let completedTasks = 0;
    for (let d = 1; d <= daysInMonth(year, month); d++) {
      const date = `${year}-${mm}-${pad(d)}`;
      const r = byDate[date] || { total: 0, completed: 0 };
      days.push({ date, day: d, total: r.total, completed: r.completed, progress: calcPercent(r.completed, r.total) });
      totalTasks += r.total;
      completedTasks += r.completed;
    }

    const active = days.filter((d) => d.total > 0);
    // Average daily progress: every active day counts equally (different from the overall monthly progress).
    const averageDailyProgress = active.length
      ? Math.round(active.reduce((sum, d) => sum + (d.completed / d.total) * 100, 0) / active.length)
      : 0;

    let bestDay = null;
    let worstDay = null;
    active.forEach((d) => {
      if (!bestDay || d.progress > bestDay.progress) bestDay = { date: d.date, progress: d.progress };
      if (!worstDay || d.progress < worstDay.progress) worstDay = { date: d.date, progress: d.progress };
    });

    res.json({
      year,
      month,
      totalTasks,
      completedTasks,
      incompleteTasks: totalTasks - completedTasks,
      monthlyProgress: calcPercent(completedTasks, totalTasks),
      averageDailyProgress,
      activeDays: active.length,
      bestDay,
      worstDay,
      days,
    });
  })
);

// GET /api/analytics/year/:year
router.get(
  '/year/:year',
  asyncHandler(async (req, res) => {
    const year = toInt(req.params.year);
    if (!(year >= 2000 && year <= 2100)) return res.status(400).json({ message: 'Please provide a valid year.' });

    const rows = await groupByDate(req.user._id, `${year}-01-01`, `${year}-12-31`);

    const months = [];
    for (let m = 1; m <= 12; m++) months.push({ month: m, total: 0, completed: 0, progress: 0 });
    rows.forEach((r) => {
      const bucket = months[Number(r._id.slice(5, 7)) - 1];
      bucket.total += r.total;
      bucket.completed += r.completed;
    });
    months.forEach((m) => (m.progress = calcPercent(m.completed, m.total)));

    const totalTasks = months.reduce((s, m) => s + m.total, 0);
    const completedTasks = months.reduce((s, m) => s + m.completed, 0);

    let bestMonth = null;
    let worstMonth = null;
    months
      .filter((m) => m.total > 0)
      .forEach((m) => {
        if (!bestMonth || m.progress > bestMonth.progress) bestMonth = { month: m.month, progress: m.progress };
        if (!worstMonth || m.progress < worstMonth.progress) worstMonth = { month: m.month, progress: m.progress };
      });

    res.json({
      year,
      totalTasks,
      completedTasks,
      incompleteTasks: totalTasks - completedTasks,
      yearlyProgress: calcPercent(completedTasks, totalTasks),
      bestMonth,
      worstMonth,
      months,
    });
  })
);

module.exports = router;
