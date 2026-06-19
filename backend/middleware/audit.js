const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const fallbackAuditPath = path.join(__dirname, '..', 'mock_audit_trail.json');

// Define Schema for MongoDB Audit Trail
let AuditLog;
const getAuditModel = () => {
  if (AuditLog) return AuditLog;
  try {
    const schema = new mongoose.Schema({
      timestamp: { type: Date, default: Date.now },
      userId: String,
      role: String,
      action: String,
      method: String,
      url: String,
      ip: String,
      userAgent: String,
      status: Number,
      details: String
    });
    AuditLog = mongoose.model('AuditLog', schema);
    return AuditLog;
  } catch (err) {
    // If model is already compiled, retrieve it
    AuditLog = mongoose.model('AuditLog');
    return AuditLog;
  }
};

// Local file writer fallback
const saveFallbackAudit = (logEntry) => {
  try {
    if (!fs.existsSync(fallbackAuditPath)) {
      fs.writeFileSync(fallbackAuditPath, JSON.stringify([], null, 2));
    }
    const logs = JSON.parse(fs.readFileSync(fallbackAuditPath, 'utf8'));
    logs.unshift({
      _id: new Date().getTime().toString() + '-' + Math.random().toString(36).substr(2, 5),
      ...logEntry
    });
    fs.writeFileSync(fallbackAuditPath, JSON.stringify(logs.slice(0, 1000), null, 2)); // cap at 1000 logs
  } catch (err) {
    console.error('Failed to write to fallback audit trail:', err.message);
  }
};

/**
 * Express middleware to audit operations
 */
const auditLogger = (req, res, next) => {
  // Capture request metadata
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;
  const userAgent = req.headers['user-agent'] || 'unknown';
  const timestamp = new Date();
  
  // Track response completion
  res.on('finish', async () => {
    // Determine the userId and role if available
    let userId = 'anonymous';
    let role = 'guest';
    
    if (req.user) {
      userId = req.user.username;
      role = req.user.role;
    } else if (req.body && req.body.username) {
      userId = req.body.username;
    }
    
    // Ignore boring resource files if any, only log API and critical calls
    if (!req.originalUrl.startsWith('/api')) {
      return;
    }

    // Determine Action label
    let action = `${req.method} ${req.originalUrl}`;
    if (req.originalUrl.includes('/api/auth/login')) {
      action = 'USER_LOGIN';
    } else if (req.originalUrl.includes('/api/auth/register')) {
      action = 'USER_REGISTRATION';
    } else if (req.originalUrl.includes('/api/auth/verify-step-up')) {
      action = 'STEP_UP_VERIFICATION';
    } else if (req.originalUrl.includes('/api/admin/logs')) {
      action = 'VIEW_RISK_LOGS';
    } else if (req.originalUrl.includes('/api/admin/stats')) {
      action = 'VIEW_SYSTEM_STATS';
    }

    const logEntry = {
      timestamp,
      userId,
      role,
      action,
      method: req.method,
      url: req.originalUrl,
      ip,
      userAgent,
      status: res.statusCode,
      details: res.statusMessage || ''
    };

    // Save to Mongo if active, else JSON file
    if (mongoose.connection.readyState === 1) {
      try {
        const Model = getAuditModel();
        const auditRecord = new Model(logEntry);
        await auditRecord.save();
      } catch (err) {
        console.warn('Error saving audit log to MongoDB, falling back to JSON:', err.message);
        saveFallbackAudit(logEntry);
      }
    } else {
      saveFallbackAudit(logEntry);
    }
  });

  next();
};

module.exports = {
  auditLogger
};
