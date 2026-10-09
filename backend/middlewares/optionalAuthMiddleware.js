const jwt = require('jsonwebtoken');

const optionalAuthMiddleware = (req, res, next) => {
  const token = req.header('Authorization');

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token.replace('Bearer ', ''), process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    // Invalid token, proceed as unauthenticated guest
    req.user = null;
    next();
  }
};

module.exports = optionalAuthMiddleware;
