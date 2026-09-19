// Express 4 does not catch errors from async route handlers by itself.
// This wrapper forwards them to the central error handler in server.js.
module.exports = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
