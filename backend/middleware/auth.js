const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'bob_trust_secret_key_1001';

/**
 * Main authentication middleware checking for a valid JWT in headers
 */
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Format: Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access Denied: No token provided' });
  }

  try {
    const verified = jwt.verify(token, JWT_SECRET);
    req.user = verified;
    next();
  } catch (err) {
    res.status(403).json({ error: 'Invalid or expired session token' });
  }
};

/**
 * Role-Based Access Control middleware. Matches user's role against allowed roles list.
 * Allowed roles: 'customer', 'employee', 'enterprise', 'admin'
 */
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({ error: 'Access Denied: Unrecognized role' });
    }

    const hasRole = allowedRoles.includes(req.user.role.toLowerCase());
    if (!hasRole) {
      return res.status(403).json({ error: `Access Denied: Requires role in [${allowedRoles.join(', ')}]` });
    }

    next();
  };
};

module.exports = {
  authenticateToken,
  requireRole,
  JWT_SECRET
};
