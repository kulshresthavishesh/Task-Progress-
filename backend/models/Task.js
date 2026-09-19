// Task model - every task belongs to one user and one calendar date.
// The date is stored as a plain "YYYY-MM-DD" string. This avoids timezone bugs:
// a task planned for "2026-09-19" is on that day for the user, wherever the server runs.
const mongoose = require('mongoose');

const CATEGORIES = ['Study', 'Coding', 'Fitness', 'Personal', 'Work', 'Other'];
const PRIORITIES = ['Low', 'Medium', 'High'];

const taskSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    completed: { type: Boolean, default: false },
    category: { type: String, enum: CATEGORIES, default: 'Other' },
    priority: { type: String, enum: PRIORITIES, default: 'Medium' },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true } // adds createdAt and updatedAt automatically
);

// Almost every query filters by user + date, so index both together.
taskSchema.index({ userId: 1, date: 1 });

const Task = mongoose.model('Task', taskSchema);
Task.CATEGORIES = CATEGORIES;
Task.PRIORITIES = PRIORITIES;

module.exports = Task;
