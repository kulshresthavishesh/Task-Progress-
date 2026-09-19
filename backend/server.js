// server.js - starts Express, connects to MongoDB, serves the API and the frontend files.
require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const dns = require("dns");
dns.setServers(["1.1.1.1", "8.8.8.8"]);

const PORT = process.env.PORT || 5000;

if (!process.env.MONGO_URI || !process.env.JWT_SECRET) {
  console.error('Missing MONGO_URI or JWT_SECRET. Copy .env.example to .env and fill in the values.');
  process.exit(1);
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '10kb' }));

// --- API routes ---
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api', (req, res) => res.status(404).json({ message: 'API route not found.' }));

// --- Frontend: the backend also serves the ../frontend folder, so one server runs everything ---
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// --- Central error handler: never leaks internal details to the client ---
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'The request body is not valid JSON.' });
  }
  if (err.name === 'CastError') {
    return res.status(400).json({ message: 'Invalid ID or value.' });
  }
  if (err.name === 'ValidationError') {
    return res.status(400).json({ message: 'Some of the data you sent is invalid.' });
  }
  console.error(err); // full error stays in the server log only
  res.status(500).json({ message: 'Something went wrong on our side. Please try again.' });
});

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    app.listen(PORT, () => console.log(`TaskProgress running at http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  });
