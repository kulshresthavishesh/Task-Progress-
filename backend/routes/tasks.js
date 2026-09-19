// Task routes. Every query includes userId: req.user._id, so a user can only ever touch their own tasks.
const express = require('express');
const mongoose = require('mongoose');
const Task = require('../models/Task');
const auth = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { isValidDate, calcPercent } = require('../utils/dates');

const router = express.Router();
router.use(auth); // every route below needs a valid JWT

// Checks the request body. Returns { error } or { data } with only the fields we allow.
// partial = true is used for updates, where every field is optional.
function validateTaskInput(body, partial) {
  const data = {};

  if (!partial || body.title !== undefined) {
    if (typeof body.title !== 'string' || !body.title.trim()) return { error: 'Task name cannot be empty.' };
    if (body.title.trim().length > 200) return { error: 'Task name must be 200 characters or fewer.' };
    data.title = body.title.trim();
  }
  if (body.category !== undefined) {
    if (!Task.CATEGORIES.includes(body.category)) return { error: 'Please choose a valid category.' };
    data.category = body.category;
  }
  if (body.priority !== undefined) {
    if (!Task.PRIORITIES.includes(body.priority)) return { error: 'Please choose a valid priority.' };
    data.priority = body.priority;
  }
  if (!partial || body.date !== undefined) {
    if (!isValidDate(body.date)) return { error: 'Please choose a valid date.' };
    data.date = body.date;
  }
  return { data };
}

// Finds a task by id AND owner. Returns null if the id is malformed or belongs to someone else.
async function findOwnedTask(req) {
  if (!mongoose.isValidObjectId(req.params.id)) return null;
  return Task.findOne({ _id: req.params.id, userId: req.user._id });
}

// POST /api/tasks
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { error, data } = validateTaskInput(req.body, false);
    if (error) return res.status(400).json({ message: error });
    const task = await Task.create({ ...data, userId: req.user._id });
    res.status(201).json({ task });
  })
);

// GET /api/tasks?from=YYYY-MM-DD&to=YYYY-MM-DD   (both optional)
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const filter = { userId: req.user._id };
    const { from, to } = req.query;
    if (from !== undefined || to !== undefined) {
      filter.date = {};
      if (from !== undefined) {
        if (!isValidDate(from)) return res.status(400).json({ message: 'Invalid "from" date.' });
        filter.date.$gte = from;
      }
      if (to !== undefined) {
        if (!isValidDate(to)) return res.status(400).json({ message: 'Invalid "to" date.' });
        filter.date.$lte = to;
      }
    }
    const tasks = await Task.find(filter).sort({ date: -1, createdAt: 1 });
    res.json({ tasks });
  })
);

// GET /api/tasks/:date
router.get(
  '/:date',
  asyncHandler(async (req, res) => {
    const { date } = req.params;
    if (!isValidDate(date)) return res.status(400).json({ message: 'Please provide a valid date (YYYY-MM-DD).' });
    const tasks = await Task.find({ userId: req.user._id, date }).sort({ createdAt: 1 });
    const completed = tasks.filter((t) => t.completed).length;
    res.json({ date, tasks, total: tasks.length, completed, progress: calcPercent(completed, tasks.length) });
  })
);

// PUT /api/tasks/:id   (title, category, priority, date - all optional)
router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const task = await findOwnedTask(req);
    if (!task) return res.status(404).json({ message: 'Task not found.' });
    const { error, data } = validateTaskInput(req.body, true);
    if (error) return res.status(400).json({ message: error });
    Object.assign(task, data);
    await task.save();
    res.json({ task });
  })
);

// PATCH /api/tasks/:id/toggle   optional body { completed: true|false }; otherwise flips the value
router.patch(
  '/:id/toggle',
  asyncHandler(async (req, res) => {
    const task = await findOwnedTask(req);
    if (!task) return res.status(404).json({ message: 'Task not found.' });
    task.completed = typeof req.body.completed === 'boolean' ? req.body.completed : !task.completed;
    task.completedAt = task.completed ? new Date() : null;
    await task.save();
    res.json({ task });
  })
);

// DELETE /api/tasks/:id
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const task = await findOwnedTask(req);
    if (!task) return res.status(404).json({ message: 'Task not found.' });
    await task.deleteOne();
    res.json({ message: 'Task deleted.' });
  })
);

module.exports = router;
