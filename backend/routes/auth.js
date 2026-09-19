// Authentication routes: register, login, current user, profile and password updates.
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function signToken(user) {
  return jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

// POST /api/auth/register
router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    if (!name || name.length > 50) return res.status(400).json({ message: 'Please enter your name (up to 50 characters).' });
    if (!EMAIL_RE.test(email)) return res.status(400).json({ message: 'Please enter a valid email address.' });
    if (password.length < 8) return res.status(400).json({ message: 'Your password must be at least 8 characters long.' });
    if (password.length > 72) return res.status(400).json({ message: 'Your password must be 72 characters or fewer.' });

    if (await User.findOne({ email })) {
      return res.status(409).json({ message: 'An account with this email already exists. Try logging in.' });
    }

    const hashed = await bcrypt.hash(password, 10);
    let user;
    try {
      user = await User.create({ name, email, password: hashed });
    } catch (err) {
      if (err.code === 11000) {
        return res.status(409).json({ message: 'An account with this email already exists. Try logging in.' });
      }
      throw err;
    }

    res.status(201).json({ token: signToken(user), user });
  })
);

// POST /api/auth/login
router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    if (!email || !password) return res.status(400).json({ message: 'Please enter your email and password.' });

    const user = await User.findOne({ email }).select('+password');
    // Same message for "no such user" and "wrong password" so attackers can't tell which emails exist.
    const ok = user && (await bcrypt.compare(password, user.password));
    if (!ok) return res.status(401).json({ message: 'Incorrect email or password.' });

    res.json({ token: signToken(user), user });
  })
);

// GET /api/auth/me
router.get('/me', auth, (req, res) => {
  res.json({ user: req.user });
});

// PUT /api/auth/profile  { name }
router.put(
  '/profile',
  auth,
  asyncHandler(async (req, res) => {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    if (!name || name.length > 50) return res.status(400).json({ message: 'Please enter your name (up to 50 characters).' });
    req.user.name = name;
    await req.user.save();
    res.json({ user: req.user });
  })
);

// PUT /api/auth/password  { currentPassword, newPassword }
router.put(
  '/password',
  auth,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
      return res.status(400).json({ message: 'Please fill in both password fields.' });
    }
    if (newPassword.length < 8 || newPassword.length > 72) {
      return res.status(400).json({ message: 'Your new password must be 8 to 72 characters long.' });
    }
    const user = await User.findById(req.user._id).select('+password');
    if (!(await bcrypt.compare(currentPassword, user.password))) {
      return res.status(400).json({ message: 'Your current password is incorrect.' });
    }
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.json({ message: 'Password updated.' });
  })
);

module.exports = router;
