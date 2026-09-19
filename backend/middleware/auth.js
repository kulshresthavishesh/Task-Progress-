// JWT middleware - put in front of every private route.
// It reads "Authorization: Bearer <token>", verifies it, and attaches the user as req.user.
const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async function auth(req, res, next) {
  try {
    const [scheme, token] = (req.headers.authorization || '').split(' ');
    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({ message: 'Please log in to continue.' });
    }

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      const message =
        err.name === 'TokenExpiredError'
          ? 'Your session has expired. Please log in again.'
          : 'Your login session is invalid. Please log in again.';
      return res.status(401).json({ message });
    }

    const user = await User.findById(payload.id);
    if (!user) {
      return res.status(401).json({ message: 'We could not find your account. Please log in again.' });
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};
