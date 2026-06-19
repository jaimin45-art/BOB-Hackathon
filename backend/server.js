require('dotenv').config();

const express = require('express');
const http = require('http');
const cors = require('cors');
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { authenticateToken, requireRole, JWT_SECRET } = require('./middleware/auth');
const { generateRiskExplanation } = require('./services/ai_explainer');
const { auditLogger } = require('./middleware/audit');
const { encrypt, decrypt } = require('./services/crypto');
const { calculateIdentityRisk, DEMO_SCENARIOS, RISK_THRESHOLDS } = require('./services/riskEngine');

const PORT = process.env.PORT || 5000;
const PYTHON_ENGINE_URL = process.env.PYTHON_ENGINE_URL || 'http://localhost:5001';

const app = express();
app.use(cors());
app.use(express.json());
app.use(auditLogger);

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Database Setup (MongoDB Atlas with JSON file fallback)
let dbConnected = false;
let RiskLogSchema, RiskLog;
let CaseSchema, Case;
let UserSchema, User;
let EmployeeLogSchema, EmployeeLog;

const fallbackDbPath = path.join(__dirname, 'mock_db_logs.json');
const fallbackCasesPath = path.join(__dirname, 'mock_cases.json');
const fallbackUsersPath = path.join(__dirname, 'mock_users.json');
const fallbackEmployeeLogsPath = path.join(__dirname, 'mock_employee_logs.json');

const getInitialUsersArray = () => {
  return [
    {
      username: 'bob_customer',
      passwordHash: bcrypt.hashSync('customer123', 10),
      role: 'customer'
    },
    {
      username: 'bob_employee',
      passwordHash: bcrypt.hashSync('employee123', 10),
      role: 'employee'
    },
    {
      username: 'bob_enterprise',
      passwordHash: bcrypt.hashSync('enterprise123', 10),
      role: 'enterprise'
    },
    {
      username: 'bob_admin',
      passwordHash: bcrypt.hashSync('admin123', 10),
      role: 'admin'
    }
  ];
};

const getInitialCasesArray = () => {
  return [
    {
      userId: "bob_customer",
      riskScore: 62,
      category: "Account Takeover",
      reason: "Risk Score: 62/100. Contributing Factors: New Device Fingerprint Mismatch (+35), Behavioral Biometrics Anomaly (+25), Consistent Location (-10). Final Decision: Face Verification Required.",
      status: "New",
      timestamp: new Date(Date.now() - 7200000), // 2 hours ago
      details: { device: "Apple iPhone 15", location: "Delhi, IN", ip: "103.112.43.19", transactionAmount: 0 }
    },
    {
      userId: "rahul_sharma_99",
      riskScore: 80,
      category: "KYC Fraud",
      reason: "Risk Score: 80/100. Contributing Factors: KYC identity verification confidence below 70% (+80). Final Decision: Block and Escalate.",
      status: "Assigned",
      timestamp: new Date(Date.now() - 18000000), // 5 hours ago
      details: { device: "Samsung SM-G998B", location: "Pune, IN", ip: "185.220.101.4", idNumber: "AAXX0029P", imageMatchScore: 38 }
    },
    {
      userId: "emp_priya_patel",
      riskScore: 65,
      category: "Insider Threat",
      reason: "Risk Score: 65/100. Contributing Factors: High-risk VIP account record query (+65). Final Decision: Face Verification Required.",
      status: "Investigating",
      timestamp: new Date(Date.now() - 86400000), // 1 day ago
      details: { device: "Baroda Terminal Desktop 09", location: "Mumbai HQ Branch", ip: "192.168.42.112", lookupCount: 15, accessedRecord: "VIP Customer Account Query" }
    },
    {
      userId: "bob_customer",
      riskScore: 85,
      category: "Suspicious Recovery",
      reason: "Risk Score: 85/100. Contributing Factors: Critical Account Recovery: Password Reset + New Device + New Location (+85). Final Decision: Block and Escalate.",
      status: "New",
      timestamp: new Date(Date.now() - 108000000), // 1.25 days ago
      details: { device: "Google Pixel 8", location: "Ahmedabad, IN", ip: "117.218.49.5" }
    }
  ];
};

const getInitialEmployeeLogs = () => {
  return [
    {
      timestamp: new Date(Date.now() - 3600000), // 1 hour ago
      employeeId: "EMP-3099",
      employeeName: "Rajesh Verma",
      branch: "Ahmedabad HQ",
      department: "Operations",
      action: "Bulk database export (502 records) attempted",
      riskScore: 90,
      status: "Suspended",
      details: { recordCount: 502, ip: "192.168.10.45" }
    },
    {
      timestamp: new Date(Date.now() - 7200000), // 2 hours ago
      employeeId: "EMP-2081",
      employeeName: "Priya Patel",
      branch: "Delhi Connaught Place",
      department: "Loans",
      action: "Queried VIP customer account (Amitabh B.)",
      riskScore: 65,
      status: "Warning",
      details: { recordName: "Amitabh B.", ip: "192.168.22.12" }
    },
    {
      timestamp: new Date(Date.now() - 10800000), // 3 hours ago
      employeeId: "EMP-1042",
      employeeName: "Ramesh Sharma",
      branch: "Mumbai Main",
      department: "Retail Banking",
      action: "Standard customer lookup x 2 for loan eligibility check",
      riskScore: 12,
      status: "Active",
      details: { lookupCount: 2, ip: "192.168.1.115" }
    }
  ];
};

const initFallbackDb = () => {
  if (!fs.existsSync(fallbackDbPath)) {
    fs.writeFileSync(fallbackDbPath, JSON.stringify([], null, 2));
  }
  if (!fs.existsSync(fallbackCasesPath)) {
    fs.writeFileSync(fallbackCasesPath, JSON.stringify(getInitialCasesArray().map((c, idx) => ({ _id: `case_10${idx+1}`, ...c })), null, 2));
  }
  if (!fs.existsSync(fallbackUsersPath)) {
    fs.writeFileSync(fallbackUsersPath, JSON.stringify(getInitialUsersArray(), null, 2));
  }
  if (!fs.existsSync(fallbackEmployeeLogsPath)) {
    fs.writeFileSync(fallbackEmployeeLogsPath, JSON.stringify(getInitialEmployeeLogs().map((e, idx) => ({ _id: `emp_log_10${idx+1}`, ...e })), null, 2));
  }
};

const connectDatabase = async () => {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.log('MONGODB_URI not provided. Running with memory/JSON-file fallback DB mode.');
    initFallbackDb();
    return;
  }

  try {
    await mongoose.connect(mongoUri);
    dbConnected = true;
    console.log('Successfully connected to MongoDB Atlas.');
    
    // Schema definitions
    RiskLogSchema = new mongoose.Schema({
      timestamp: { type: Date, default: Date.now },
      userId: String,
      role: String,
      riskScore: Number,
      decision: String,
      explanation: String,
      telemetry: mongoose.Schema.Types.Mixed,
      violations: Array,
      context: mongoose.Schema.Types.Mixed
    });
    RiskLog = mongoose.model('RiskLog', RiskLogSchema);
    
    CaseSchema = new mongoose.Schema({
      timestamp: { type: Date, default: Date.now },
      userId: String,
      riskScore: Number,
      category: String,
      reason: String,
      status: { type: String, default: 'New' }, // New, Assigned, Investigating, Resolved, Closed
      details: mongoose.Schema.Types.Mixed
    });
    Case = mongoose.model('Case', CaseSchema);

    UserSchema = new mongoose.Schema({
      username: { type: String, unique: true, required: true },
      passwordHash: { type: String, required: true },
      role: { type: String, default: 'customer' }
    });
    User = mongoose.model('User', UserSchema);

    EmployeeLogSchema = new mongoose.Schema({
      timestamp: { type: Date, default: Date.now },
      employeeId: String,
      employeeName: String,
      branch: String,
      department: String,
      action: String,
      riskScore: Number,
      status: String,
      details: mongoose.Schema.Types.Mixed
    });
    EmployeeLog = mongoose.model('EmployeeLog', EmployeeLogSchema);

    // Seed database if empty
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      await User.insertMany(getInitialUsersArray());
      console.log('Seeded initial users into MongoDB Atlas.');
    }
    
    const count = await Case.countDocuments();
    if (count === 0) {
      await Case.insertMany(getInitialCasesArray());
    }

    const empLogCount = await EmployeeLog.countDocuments();
    if (empLogCount === 0) {
      await EmployeeLog.insertMany(getInitialEmployeeLogs());
    }
  } catch (err) {
    console.error('Failed to connect to MongoDB Atlas. Falling back to JSON-file DB mode.', err.message);
    initFallbackDb();
  }
};

const findUserByUsername = async (username) => {
  if (dbConnected && User) {
    try {
      const u = await User.findOne({ username });
      return u ? u.toObject() : null;
    } catch (e) {
      console.error("Failed to query Mongo user:", e.message);
    }
  }
  try {
    const users = JSON.parse(fs.readFileSync(fallbackUsersPath, 'utf8'));
    return users.find(u => u.username === username) || null;
  } catch (e) {
    return null;
  }
};

const saveUser = async (userData) => {
  if (dbConnected && User) {
    try {
      const u = new User(userData);
      await u.save();
      return u.toObject();
    } catch (e) {
      console.error("Failed to save Mongo user:", e.message);
    }
  }
  try {
    const users = JSON.parse(fs.readFileSync(fallbackUsersPath, 'utf8'));
    users.push(userData);
    fs.writeFileSync(fallbackUsersPath, JSON.stringify(users, null, 2));
    return userData;
  } catch (e) {
    console.error("Failed to save fallback user:", e.message);
    return userData;
  }
};

const getCases = async () => {
  if (dbConnected && Case) {
    try {
      return await Case.find().sort({ timestamp: -1 });
    } catch (e) {
      console.error("Failed to query Mongo cases, using fallback:", e.message);
    }
  }
  try {
    return JSON.parse(fs.readFileSync(fallbackCasesPath, 'utf8'));
  } catch (e) {
    return [];
  }
};

const saveCase = async (caseData) => {
  if (dbConnected && Case) {
    try {
      const c = new Case(caseData);
      await c.save();
      return c.toObject();
    } catch (e) {
      console.error("Failed to save Mongo case, trying fallback:", e.message);
    }
  }
  try {
    const cases = JSON.parse(fs.readFileSync(fallbackCasesPath, 'utf8'));
    const newCase = {
      _id: caseData._id || 'case_' + new Date().getTime(),
      timestamp: new Date(),
      ...caseData
    };
    cases.unshift(newCase);
    fs.writeFileSync(fallbackCasesPath, JSON.stringify(cases.slice(0, 200), null, 2));
    return newCase;
  } catch (e) {
    console.error("Failed to save fallback case:", e.message);
    return caseData;
  }
};

const resolveCase = async (id, status) => {
  if (dbConnected && Case) {
    try {
      const updated = await Case.findByIdAndUpdate(id, { status }, { new: true });
      if (updated) return updated.toObject();
    } catch (e) {
      console.error("Failed to update Mongo case, trying fallback:", e.message);
    }
  }
  try {
    const cases = JSON.parse(fs.readFileSync(fallbackCasesPath, 'utf8'));
    const idx = cases.findIndex(c => c._id === id);
    if (idx !== -1) {
      cases[idx].status = status;
      fs.writeFileSync(fallbackCasesPath, JSON.stringify(cases, null, 2));
      return cases[idx];
    }
  } catch (e) {
    console.error("Failed to update fallback case status:", e.message);
  }
  return null;
};

const saveRiskLog = async (logData) => {
  // Encrypt sensitive behavioral and environmental signals
  const encryptedLogData = {
    ...logData,
    telemetry: encrypt(logData.telemetry),
    context: encrypt(logData.context)
  };

  if (dbConnected && RiskLog) {
    try {
      const log = new RiskLog(encryptedLogData);
      await log.save();
      return {
        ...encryptedLogData,
        _id: log._id,
        timestamp: log.timestamp,
        telemetry: logData.telemetry,
        context: logData.context
      };
    } catch (e) {
      console.error('Error saving log to MongoDB, appending to JSON file instead:', e.message);
    }
  }

  try {
    const logs = JSON.parse(fs.readFileSync(fallbackDbPath, 'utf8'));
    const entry = {
      _id: new Date().getTime().toString(),
      timestamp: new Date(),
      ...encryptedLogData
    };
    logs.unshift(entry);
    fs.writeFileSync(fallbackDbPath, JSON.stringify(logs.slice(0, 500), null, 2));
    return {
      ...entry,
      telemetry: logData.telemetry,
      context: logData.context
    };
  } catch (e) {
    console.error('Error saving fallback log:', e.message);
    return logData;
  }
};

const getRiskLogs = async () => {
  let rawLogs = [];
  if (dbConnected && RiskLog) {
    try {
      rawLogs = await RiskLog.find().sort({ timestamp: -1 }).limit(100);
      rawLogs = rawLogs.map(r => r.toObject());
    } catch (err) {
      console.error('Failed to query Mongo logs, trying fallback:', err.message);
    }
  }
  
  if (rawLogs.length === 0) {
    try {
      rawLogs = JSON.parse(fs.readFileSync(fallbackDbPath, 'utf8'));
    } catch (e) {
      rawLogs = [];
    }
  }

  return rawLogs.map(log => {
    return {
      ...log,
      telemetry: typeof log.telemetry === 'string' ? decrypt(log.telemetry) : log.telemetry,
      context: typeof log.context === 'string' ? decrypt(log.context) : log.context
    };
  });
};

const getEmployeeLogs = async () => {
  if (dbConnected && EmployeeLog) {
    try {
      return await EmployeeLog.find().sort({ timestamp: -1 });
    } catch (e) {
      console.error("Failed to query Employee logs, using fallback:", e.message);
    }
  }
  try {
    return JSON.parse(fs.readFileSync(fallbackEmployeeLogsPath, 'utf8'));
  } catch (e) {
    return [];
  }
};

const saveEmployeeLog = async (logData) => {
  if (dbConnected && EmployeeLog) {
    try {
      const e = new EmployeeLog(logData);
      await e.save();
      return e.toObject();
    } catch (err) {
      console.error("Failed to save Employee log to Mongo:", err.message);
    }
  }
  try {
    const logs = JSON.parse(fs.readFileSync(fallbackEmployeeLogsPath, 'utf8'));
    const entry = {
      _id: 'emp_log_' + new Date().getTime(),
      timestamp: new Date(),
      ...logData
    };
    logs.unshift(entry);
    fs.writeFileSync(fallbackEmployeeLogsPath, JSON.stringify(logs.slice(0, 500), null, 2));
    return entry;
  } catch (e) {
    console.error("Failed to save fallback employee log:", e.message);
    return logData;
  }
};

// ==========================================
// Active Sessions State Machine
// ==========================================
const activeSessions = {};

io.on('connection', (socket) => {
  console.log(`Socket client connected: ${socket.id}`);
  
  // Default session profile
  activeSessions[socket.id] = {
    socketId: socket.id,
    userId: 'anonymous',
    role: 'guest',
    channel: 'web',
    riskScore: 10,
    trustScore: 90,
    decision: 'Allow Access',
    explanation: 'Session is secure. Behavioral signals and location context match guidelines.',
    telemetry: { cpm: 240, flightTime: 120, scrollSpeed: 300 },
    violations: [],
    context: {},
    timestamp: new Date()
  };

  io.emit('active-sessions-list', Object.values(activeSessions));

  // Process live telemetry telemetry packets
  socket.on('session-telemetry-update', async (data) => {
    const { userId, role, channel, telemetry, context } = data;
    
    if (!activeSessions[socket.id]) {
      activeSessions[socket.id] = { socketId: socket.id };
    }
    
    const session = activeSessions[socket.id];
    session.userId = userId || session.userId || 'anonymous';
    session.role = role || session.role || 'guest';
    session.channel = channel || session.channel || 'web';
    session.telemetry = telemetry || session.telemetry || [240.0, 120.0, 300.0];
    session.context = context || session.context || {};
    session.timestamp = new Date();

    // Fetch ML behavioral anomaly score from Python model
    let mlScore = 0.0;
    try {
      const response = await axios.post(`${PYTHON_ENGINE_URL}/predict`, {
        features: session.telemetry
      }, { timeout: 1000 });
      mlScore = response.data.anomaly_score;
    } catch (err) {
      // Local fallback Z-Score engine
      const cpm = session.telemetry[0] || 240.0;
      const ft = session.telemetry[1] || 120.0;
      const ss = session.telemetry[2] || 300.0;
      const avg_z = (Math.abs(cpm - 242.0)/4.0 + Math.abs(ft - 120.0)/2.0 + Math.abs(ss - 425.0)/8.0) / 3.0;
      mlScore = 1.0 - Math.exp(-avg_z / 1.5);
    }

    // Add ML anomaly context if high
    if (mlScore > 0.6) {
      session.context.behavioral_anomaly = true;
    } else if (mlScore > 0 && mlScore <= 0.3) {
      session.context.behavioral_normal = true;
    }

    // Evaluate Risk using Core Identity Trust Engine
    const evaluation = calculateIdentityRisk(session.telemetry, session.context, session.channel);
    
    session.riskScore = evaluation.riskScore;
    session.trustScore = evaluation.trustScore;
    session.violations = evaluation.violations;
    session.decision = evaluation.decision;

    // AI Explainer logic
    if (session.riskScore > 10 && (!session.explanation || Math.abs(session.riskScore - (session.lastExplainedScore || 0)) > 15)) {
      session.explanation = await generateRiskExplanation({
        finalScore: session.riskScore,
        mlScore,
        violations: session.violations
      });
      session.lastExplainedScore = session.riskScore;
    } else if (session.riskScore <= 10) {
      session.explanation = 'Session is secure. Behavioral signals and location context match guidelines.';
    }

    // Write critical events directly to logs & create a Case
    if (session.riskScore > 30 || session.context.transaction_amount || session.channel === 'employee') {
      const logData = {
        userId: session.userId,
        role: session.role,
        riskScore: session.riskScore,
        decision: session.decision,
        explanation: session.explanation,
        telemetry: {
          cpm: session.telemetry[0],
          flightTime: session.telemetry[1],
          scrollSpeed: session.telemetry[2]
        },
        violations: session.violations,
        context: session.context
      };
      
      saveRiskLog(logData).catch(err => console.error('Failed to save continuous log:', err.message));

      // Trigger automatic alert cases
      if (session.riskScore > 60 && session.userId !== 'anonymous') {
        let category = 'Account Takeover';
        if (session.channel === 'employee' || session.context.role === 'employee') {
          category = 'Insider Threat';
        } else if (session.context.password_reset || session.context.forgot_password_attempt) {
          category = 'Suspicious Recovery';
        } else if (session.context.kyc_onboarding) {
          category = 'KYC Fraud';
        }

        saveCase({
          userId: session.userId,
          riskScore: session.riskScore,
          category,
          reason: session.explanation || `Critical risk score detected on ${session.channel} channel.`,
          status: 'New',
          details: {
            device: session.context.device_name || (session.channel === 'employee' ? 'Branch Terminal' : 'Customer Device'),
            location: session.context.location_name || 'Mumbai, IN',
            ip: session.context.ip_address || '127.0.0.1',
            transactionAmount: session.context.transaction_amount || 0,
            lookupCount: session.context.lookup_count || 0
          }
        }).then(newCase => {
          io.emit('new-case-alert', newCase);
        }).catch(e => console.error("Auto case generation failed:", e.message));
      }
    }

    // Stream live metrics to clients
    socket.emit('risk-score-updated', {
      riskScore: session.riskScore,
      trustScore: session.trustScore,
      decision: session.decision,
      explanation: session.explanation,
      violations: session.violations
    });

    io.emit('active-sessions-list', Object.values(activeSessions));
  });

  socket.on('get-active-sessions', () => {
    socket.emit('active-sessions-list', Object.values(activeSessions));
  });

  socket.on('disconnect', () => {
    delete activeSessions[socket.id];
    io.emit('active-sessions-list', Object.values(activeSessions));
  });
});

// ==========================================
// REST API ROUTES
// ==========================================

// Register Route
app.post('/api/auth/register', async (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const existing = await findUserByUsername(username);
    if (existing) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const newUser = {
      username,
      passwordHash: bcrypt.hashSync(password, 10),
      role: role || 'customer'
    };
    await saveUser(newUser);
    res.json({ message: 'User registered successfully', username, role: newUser.role });
  } catch (e) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login and Security Evaluation Route
app.post('/api/auth/login', async (req, res) => {
  const { username, password, telemetry, context } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Missing username or password' });
  }

  // 1. Verify credentials
  const user = await findUserByUsername(username);
  if (!user) {
    io.emit('risk-signal', {
      timestamp: new Date(),
      userId: username,
      role: 'unknown',
      riskScore: 90,
      decision: 'Block and Escalate',
      explanation: 'Attempted login with non-existent username.',
      violations: [{ desc: 'Credential querying for non-existent account', weight: 80 }]
    });
    return res.status(400).json({ error: 'Invalid credentials' });
  }

  const passwordValid = bcrypt.compareSync(password, user.passwordHash);
  const telemetryFeatures = telemetry || [242.0, 120.0, 420.0];
  const evaluatedContext = context || {};

  if (!passwordValid) {
    evaluatedContext.failed_logins_count = (evaluatedContext.failed_logins_count || 0) + 1;
  }

  // 2. Fetch ML Anomaly score from Python
  let mlScore = 0.0;
  try {
    const response = await axios.post(`${PYTHON_ENGINE_URL}/predict`, {
      features: telemetryFeatures
    }, { timeout: 1500 });
    mlScore = response.data.anomaly_score;
  } catch (err) {
    const avg_z = (Math.abs(telemetryFeatures[0] - 242.0)/4.0 + Math.abs(telemetryFeatures[1] - 120.0)/2.0 + Math.abs(telemetryFeatures[2] - 425.0)/8.0) / 3.0;
    mlScore = 1.0 - Math.exp(-avg_z / 1.5);
  }

  if (mlScore > 0.6) {
    evaluatedContext.behavioral_anomaly = true;
  } else if (mlScore > 0 && mlScore <= 0.3) {
    evaluatedContext.behavioral_normal = true;
  }

  // 3. Evaluate rules
  const evaluation = calculateIdentityRisk(telemetryFeatures, evaluatedContext, user.role);

  // If password mismatches, explicitly force high risk & block
  if (!passwordValid) {
    evaluation.riskScore = Math.max(evaluation.riskScore, 65);
    evaluation.decision = 'Block and Escalate';
    evaluation.violations.push({ desc: 'Invalid credential match attempt', weight: 40 });
  }

  // 4. Generate AI explanations
  const explanation = await generateRiskExplanation({
    finalScore: evaluation.riskScore,
    mlScore,
    violations: evaluation.violations
  });

  // 5. Store Session and Log details in DB
  const logData = {
    userId: user.username,
    role: user.role,
    riskScore: evaluation.riskScore,
    decision: evaluation.decision,
    explanation,
    telemetry: {
      cpm: telemetryFeatures[0],
      flightTime: telemetryFeatures[1],
      scrollSpeed: telemetryFeatures[2]
    },
    violations: evaluation.violations,
    context: evaluatedContext
  };

  const savedLog = await saveRiskLog(logData);

  // Broadcast risk signal to ops dashboard
  io.emit('risk-signal', {
    ...logData,
    timestamp: savedLog.timestamp || new Date()
  });

  // Handle employee logs if user is an employee
  if (user.role === 'employee') {
    const empActionText = evaluatedContext.vip_record_accessed 
      ? 'Queried VIP customer account profile'
      : (evaluatedContext.bulk_export ? 'Bulk customer data export attempt' : 'Standard database search query');
      
    await saveEmployeeLog({
      employeeId: 'EMP-' + user.username.slice(-4).toUpperCase(),
      employeeName: user.username,
      branch: evaluatedContext.location_name || 'Mumbai Main',
      department: 'Operations',
      action: empActionText,
      riskScore: evaluation.riskScore,
      status: evaluation.riskScore > 80 ? 'Suspended' : (evaluation.riskScore > 40 ? 'Warning' : 'Active'),
      details: evaluatedContext
    });
  }

  // Handle Case creation for high/critical risks
  if (evaluation.riskScore > 60) {
    let category = 'Account Takeover';
    if (user.role === 'employee') {
      category = 'Insider Threat';
    } else if (evaluatedContext.password_reset || evaluatedContext.forgot_password_attempt) {
      category = 'Suspicious Recovery';
    } else if (evaluatedContext.kyc_onboarding) {
      category = 'KYC Fraud';
    }

    await saveCase({
      userId: user.username,
      riskScore: evaluation.riskScore,
      category,
      reason: explanation,
      status: 'New',
      details: {
        device: evaluatedContext.device_name || 'Corporate Terminal',
        location: evaluatedContext.location_name || 'Mumbai, IN',
        ip: evaluatedContext.ip_address || '192.168.1.1',
        transactionAmount: evaluatedContext.transaction_amount || 0
      }
    }).then(newCase => {
      io.emit('new-case-alert', newCase);
    });
  }

  if (!passwordValid) {
    return res.status(400).json({ error: 'Invalid credentials', riskScore: evaluation.riskScore });
  }

  let token = null;
  if (evaluation.decision === 'Allow Access') {
    token = jwt.sign(
      { username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
  }

  res.json({
    message: evaluation.decision === 'Allow Access' ? 'Login successful' : 'Security challenge active',
    decision: evaluation.decision,
    riskScore: evaluation.riskScore,
    trustScore: evaluation.trustScore,
    riskLevel: evaluation.riskLevel,
    role: user.role,
    token,
    explanation,
    violations: evaluation.violations,
    factors: evaluation.factors
  });
});

// Step-Up Verification route
app.post('/api/auth/verify-step-up', async (req, res) => {
  const { username, stepUpSuccess, originalScore } = req.body;
  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  const user = await findUserByUsername(username);
  if (!user) {
    return res.status(400).json({ error: 'User profile not found' });
  }

  let finalDecision = 'Block and Escalate';
  let token = null;
  let newScore = originalScore || 50;

  if (stepUpSuccess) {
    finalDecision = 'Allow Access';
    newScore = Math.max(10, newScore - 40); // Drop risk score on verification
    token = jwt.sign(
      { username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
  }

  const logData = {
    userId: user.username,
    role: user.role,
    riskScore: newScore,
    decision: finalDecision,
    explanation: stepUpSuccess 
      ? `Step-up biometric verification passed successfully. Risk dropped from ${originalScore} to ${newScore}.`
      : 'Step-up biometric check failed.',
    telemetry: { cpm: 0, flightTime: 0, scrollSpeed: 0 },
    violations: [{ desc: 'Biometric Verification Passed', weight: stepUpSuccess ? -40 : 0 }],
    context: { step_up_attempted: true, step_up_success: stepUpSuccess }
  };

  const savedLog = await saveRiskLog(logData);
  io.emit('risk-signal', {
    ...logData,
    timestamp: savedLog.timestamp || new Date()
  });

  if (!stepUpSuccess) {
    return res.status(403).json({ error: 'Step-up challenge failed', riskScore: newScore });
  }

  res.json({
    message: 'Identity verified successfully',
    token,
    riskScore: newScore,
    decision: finalDecision
  });
});

// KYC Onboarding Assessment Endpoint
app.post('/api/kyc/onboard', async (req, res) => {
  const { applicantName, idNumber, imageMatchScore, isDuplicate, isHostingIp } = req.body;
  
  let kycRisk = 10;
  const violations = [];
  
  if (isDuplicate) {
    violations.push({ desc: 'Duplicate identity onboarding attempt', weight: 75 });
    kycRisk += 75;
  }
  if (imageMatchScore && imageMatchScore < 70) {
    violations.push({ desc: `Biometric matching confidence (${imageMatchScore}%) below threshold (70%)`, weight: 80 });
    kycRisk += 80;
  }
  if (isHostingIp) {
    violations.push({ desc: 'Onboarding routed from an anonymous cloud network proxy', weight: 20 });
    kycRisk += 20;
  }

  kycRisk = Math.max(0, Math.min(100, kycRisk));
  const trustScore = 100 - kycRisk;

  let decision = 'Allow Onboarding';
  if (kycRisk > 80) {
    decision = 'Reject Onboarding';
  } else if (kycRisk > 50) {
    decision = 'Manual Review Required';
  }

  const explanation = kycRisk > 50 
    ? `KYC application flagged. Suspicious parameters detected: ${violations.map(v => v.desc).join(', ')}.`
    : `KYC application approved. Identity parameters match historical databases.`;

  const kycCase = {
    userId: applicantName || 'anonymous_onboarding_applicant',
    riskScore: kycRisk,
    category: 'KYC Fraud',
    reason: explanation,
    status: 'New',
    details: {
      idNumber,
      imageMatchScore,
      isDuplicate,
      isHostingIp,
      location: 'Delhi, IN',
      ip: '185.220.101.4',
      device: 'Chrome Browser'
    }
  };

  if (kycRisk > 50) {
    const saved = await saveCase(kycCase);
    io.emit('new-case-alert', saved);
  }

  res.json({
    success: kycRisk <= 50,
    riskScore: kycRisk,
    trustScore,
    decision,
    explanation,
    violations
  });
});

// Trust evaluation endpoint — used by all banking channels
app.post('/api/trust/evaluate', async (req, res) => {
  const { action, channel, telemetry, context, userId } = req.body;
  const telemetryFeatures = telemetry || [242.0, 120.0, 420.0];
  const evaluatedContext = { ...context, action };

  let mlScore = 0.0;
  try {
    const response = await axios.post(`${PYTHON_ENGINE_URL}/predict`, {
      features: telemetryFeatures
    }, { timeout: 1500 });
    mlScore = response.data.anomaly_score;
  } catch (err) {
    const avg_z = (Math.abs(telemetryFeatures[0] - 242.0) / 4.0 + Math.abs(telemetryFeatures[1] - 120.0) / 2.0 + Math.abs(telemetryFeatures[2] - 425.0) / 8.0) / 3.0;
    mlScore = 1.0 - Math.exp(-avg_z / 1.5);
  }

  if (mlScore > 0.6) evaluatedContext.behavioral_anomaly = true;
  else if (mlScore > 0 && mlScore <= 0.3) evaluatedContext.behavioral_normal = true;

  const evaluation = calculateIdentityRisk(telemetryFeatures, evaluatedContext, channel || 'web');
  const explanation = await generateRiskExplanation({
    finalScore: evaluation.riskScore,
    mlScore,
    violations: evaluation.violations
  });

  const logData = {
    userId: userId || 'anonymous',
    role: evaluatedContext.role || 'customer',
    riskScore: evaluation.riskScore,
    decision: evaluation.decision,
    explanation,
    telemetry: { cpm: telemetryFeatures[0], flightTime: telemetryFeatures[1], scrollSpeed: telemetryFeatures[2] },
    violations: evaluation.violations,
    context: { ...evaluatedContext, channel, action }
  };

  const savedLog = await saveRiskLog(logData);
  io.emit('risk-signal', { ...logData, timestamp: savedLog.timestamp || new Date() });

  res.json({
    action,
    channel: channel || 'web',
    trustScore: evaluation.trustScore,
    riskScore: evaluation.riskScore,
    riskLevel: evaluation.riskLevel,
    decision: evaluation.decision,
    explanation,
    violations: evaluation.violations,
    factors: evaluation.factors,
    contributingFactors: evaluation.violations.map(v => ({
      factor: v.desc,
      impact: v.weight > 0 ? `+${v.weight}` : `${v.weight}`
    }))
  });
});

// Demo scenarios for hackathon judges
app.get('/api/demo/scenarios', (req, res) => {
  res.json({
    product: 'BoB Identity Trust Platform',
    tagline: 'Continuous Trust. Frictionless Banking.',
    scenarios: Object.keys(DEMO_SCENARIOS)
  });
});

app.post('/api/demo/run/:scenarioId', async (req, res) => {
  const scenario = DEMO_SCENARIOS[req.params.scenarioId];
  if (!scenario) {
    return res.status(404).json({ error: 'Scenario not found' });
  }

  if (scenario.kyc) {
    const { applicantName, idNumber, imageMatchScore, isDuplicate, isHostingIp } = scenario.kyc;
    let kycRisk = 10;
    const violations = [];
    if (isDuplicate) {
      violations.push({ desc: 'Duplicate identity onboarding attempt', weight: 75 });
      kycRisk += 75;
    }
    if (imageMatchScore < 70) {
      violations.push({ desc: `Face match confidence (${imageMatchScore}%) below threshold`, weight: 55 });
      kycRisk += 55;
    }
    if (isHostingIp) {
      violations.push({ desc: 'Application from suspicious network', weight: 20 });
      kycRisk += 20;
    }
    kycRisk = Math.max(0, Math.min(100, kycRisk));
    const explanation = await generateRiskExplanation({ finalScore: kycRisk, mlScore: 0, violations });
    const kycCase = {
      userId: applicantName,
      riskScore: kycRisk,
      category: 'KYC Fraud',
      reason: explanation,
      status: 'New',
      details: { idNumber, imageMatchScore, isDuplicate, isHostingIp, location: 'Delhi, IN' }
    };
    if (kycRisk > 50) {
      const saved = await saveCase(kycCase);
      io.emit('new-case-alert', saved);
    }
    return res.json({
      scenarioId: req.params.scenarioId,
      trustScore: 100 - kycRisk,
      riskScore: kycRisk,
      riskLevel: kycRisk > 80 ? 'Critical' : kycRisk > 50 ? 'High Risk' : 'Elevated',
      decision: kycRisk > 80 ? 'Block and Escalate' : kycRisk > 50 ? 'Manual Review Required' : 'Allow Onboarding',
      explanation,
      violations,
      alertGenerated: kycRisk > 50
    });
  }

  if (scenario.employee) {
    const ctx = { ...scenario.context, role: 'employee' };
    const evaluation = calculateIdentityRisk([242, 120, 425], ctx, 'employee');
    const explanation = await generateRiskExplanation({ finalScore: evaluation.riskScore, mlScore: 0, violations: evaluation.violations });
    const empLog = {
      employeeId: scenario.employee.employeeId,
      employeeName: scenario.employee.employeeName,
      branch: scenario.employee.branch,
      department: scenario.employee.department,
      action: 'VIP customer account accessed after business hours',
      riskScore: evaluation.riskScore,
      status: evaluation.riskScore > 80 ? 'Suspended' : evaluation.riskScore > 40 ? 'Warning' : 'Active',
      details: ctx
    };
    await saveEmployeeLog(empLog);
    io.emit('employee-signal', empLog);
    if (evaluation.riskScore > 40) {
      await saveCase({
        userId: scenario.employee.employeeName,
        riskScore: evaluation.riskScore,
        category: 'Insider Threat',
        reason: explanation,
        status: 'New',
        details: { device: 'Branch Terminal', location: scenario.employee.branch, ip: '192.168.22.12' }
      }).then(c => io.emit('new-case-alert', c));
    }
    return res.json({
      scenarioId: req.params.scenarioId,
      trustScore: evaluation.trustScore,
      riskScore: evaluation.riskScore,
      riskLevel: evaluation.riskLevel,
      decision: evaluation.decision,
      explanation,
      violations: evaluation.violations,
      alertGenerated: evaluation.riskScore > 40
    });
  }

  const evaluation = calculateIdentityRisk(scenario.telemetry, scenario.context, scenario.channel);
  const explanation = await generateRiskExplanation({ finalScore: evaluation.riskScore, mlScore: 0, violations: evaluation.violations });

  if (evaluation.riskScore > 60) {
    await saveCase({
      userId: 'bob_customer',
      riskScore: evaluation.riskScore,
      category: scenario.action === 'password_reset' ? 'Suspicious Recovery' : 'Account Takeover',
      reason: explanation,
      status: 'New',
      details: {
        device: scenario.context.device_name,
        location: scenario.context.location_name,
        ip: '103.112.43.19'
      }
    }).then(c => io.emit('new-case-alert', c));
  }

  res.json({
    scenarioId: req.params.scenarioId,
    action: scenario.action,
    channel: scenario.channel,
    trustScore: evaluation.trustScore,
    riskScore: evaluation.riskScore,
    riskLevel: evaluation.riskLevel,
    decision: evaluation.decision,
    explanation,
    violations: evaluation.violations,
    factors: evaluation.factors,
    contributingFactors: evaluation.violations.map(v => ({
      factor: v.desc,
      impact: v.weight > 0 ? `+${v.weight}` : `${v.weight}`
    }))
  });
});

// Employee activity monitoring (replaces simulator endpoint)
const handleEmployeeActivity = async (req, res) => {
  const { employeeId, employeeName, branch, department, actionType, lookupCount, vipAccessed, bulkExport } = req.body;
  
  const ctx = {
    role: 'employee',
    lookup_count: lookupCount || 0,
    vip_record_accessed: vipAccessed,
    bulk_export: bulkExport,
    off_hours_access: req.body.offHoursAccess
  };
  const evaluation = calculateIdentityRisk([242, 120, 425], ctx, 'employee');
  const riskScore = evaluation.riskScore;
  const violations = evaluation.violations;
  const status = riskScore > 80 ? 'Suspended' : (riskScore > 40 ? 'Warning' : 'Active');

  const actionText = bulkExport 
    ? `Bulk database export (${lookupCount || 500} records) attempted`
    : (vipAccessed ? 'Queried VIP customer account' : `Standard customer lookup × ${lookupCount || 2}`);

  const empLog = {
    employeeId: employeeId || 'EMP-1042',
    employeeName: employeeName || req.user.username,
    branch: branch || 'Mumbai HQ',
    department: department || 'Operations',
    action: actionText,
    riskScore,
    status,
    details: { lookupCount, vipAccessed, bulkExport, ip: req.ip }
  };

  const saved = await saveEmployeeLog(empLog);
  io.emit('employee-signal', saved);

  if (riskScore > 40) {
    const empCase = {
      userId: employeeName || req.user.username,
      riskScore,
      category: 'Insider Threat',
      reason: `Insider threat alarm. Action: ${actionText}. Status: ${status}.`,
      status: 'New',
      details: {
        device: 'Branch Terminal Desktop 09',
        location: branch || 'Mumbai HQ',
        ip: req.ip,
        lookupCount
      }
    };
    await saveCase(empCase).then(newCase => {
      io.emit('new-case-alert', newCase);
    });
  }

  res.json({
    success: riskScore <= 80,
    riskScore,
    trustScore: 100 - riskScore,
    status,
    decision: getDecisionFromScore(riskScore),
    log: saved
  });
};

function getDecisionFromScore(riskScore) {
  if (riskScore > 80) return 'Block and Escalate';
  if (riskScore > 60) return 'Face Verification Required';
  if (riskScore > 30) return 'OTP Verification Required';
  return 'Allow Access';
}

app.post('/api/employee/activity', authenticateToken, requireRole(['employee', 'admin']), handleEmployeeActivity);
app.post('/api/employee/simulate', authenticateToken, requireRole(['employee', 'admin']), handleEmployeeActivity);

// Secure endpoint for administrators to fetch logs
app.get('/api/admin/logs', authenticateToken, requireRole(['employee', 'admin']), async (req, res) => {
  try {
    const logs = await getRiskLogs();
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// Secure endpoint to get employee logs
app.get('/api/admin/employee-logs', authenticateToken, requireRole(['employee', 'admin']), async (req, res) => {
  try {
    const logs = await getEmployeeLogs();
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch employee logs' });
  }
});

// Secure endpoint to get all security cases
app.get('/api/admin/cases', authenticateToken, requireRole(['employee', 'admin']), async (req, res) => {
  try {
    const cases = await getCases();
    res.json(cases);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch cases' });
  }
});

// Secure endpoint to resolve a security case
app.post('/api/admin/cases/:id/resolve', authenticateToken, requireRole(['employee', 'admin']), async (req, res) => {
  const { status } = req.body;
  const { id } = req.params;
  if (!status) {
    return res.status(400).json({ error: 'Status is required' });
  }
  try {
    const updated = await resolveCase(id, status);
    if (!updated) {
      return res.status(404).json({ error: 'Case not found' });
    }
    io.emit('case-resolved', updated);
    res.json({ message: 'Case status updated successfully', case: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update case' });
  }
});

// Aggregated metrics endpoint
app.get('/api/admin/stats', authenticateToken, requireRole(['employee', 'admin']), async (req, res) => {
  try {
    const logs = await getRiskLogs();
    const cases = await getCases();
    const employeeLogs = await getEmployeeLogs();
    
    const totalLogs = logs.length;
    if (totalLogs === 0) {
      return res.json({ totalAlerts: 0, avgRiskScore: 0, frictionlessRate: 100, distribution: { frictionless: 100, stepUp: 0, blocked: 0 } });
    }

    const avgRisk = Math.round(logs.reduce((sum, log) => sum + (log.riskScore || 0), 0) / totalLogs);
    const frictionlessCount = logs.filter(log => log.decision.includes('Allow')).length;
    const blockedCount = logs.filter(log => log.decision.includes('Block')).length;
    const stepUpCount = logs.filter(log => log.decision.includes('Verification')).length;

    res.json({
      totalAlerts: cases.filter(c => c.status !== 'Resolved' && c.status !== 'Closed').length,
      avgRiskScore: avgRisk,
      frictionlessRate: Math.round((frictionlessCount / totalLogs) * 100) || 85,
      distribution: {
        frictionless: Math.round((frictionlessCount / totalLogs) * 100) || 85,
        stepUp: Math.round((stepUpCount / totalLogs) * 100) || 12,
        blocked: Math.round((blockedCount / totalLogs) * 100) || 3
      }
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to aggregate system statistics' });
  }
});

// Reports endpoint
app.get('/api/admin/reports', authenticateToken, requireRole(['employee', 'admin']), async (req, res) => {
  try {
    const logs = await getRiskLogs();
    const cases = await getCases();
    const employeeLogs = await getEmployeeLogs();

    const resolvedToday = cases.filter(c => {
      const d = new Date(c.timestamp);
      const today = new Date();
      return (c.status === 'Resolved' || c.status === 'Closed') &&
        d.toDateString() === today.toDateString();
    }).length;

    const byCategory = {
      'Account Takeover': cases.filter(c => c.category === 'Account Takeover').length,
      'KYC Fraud': cases.filter(c => c.category === 'KYC Fraud').length,
      'Insider Threat': cases.filter(c => c.category === 'Insider Threat').length,
      'Suspicious Recovery': cases.filter(c => c.category === 'Suspicious Recovery').length
    };

    const bySeverity = {
      low: logs.filter(l => l.riskScore <= 30).length,
      medium: logs.filter(l => l.riskScore > 30 && l.riskScore <= 60).length,
      high: logs.filter(l => l.riskScore > 60 && l.riskScore <= 80).length,
      critical: logs.filter(l => l.riskScore > 80).length
    };

    res.json({
      totalSessions: logs.length,
      openCases: cases.filter(c => !['Resolved', 'Closed'].includes(c.status)).length,
      resolvedToday,
      employeeAlerts: employeeLogs.filter(e => e.riskScore > 40).length,
      casesByCategory: byCategory,
      alertsBySeverity: bySeverity,
      channels: ['Internet Banking', 'Mobile Banking', 'ATM', 'Employee Portal', 'Customer Support']
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to generate reports' });
  }
});

// Risk policy thresholds
app.get('/api/admin/policy', authenticateToken, requireRole(['employee', 'admin']), (req, res) => {
  res.json({
    thresholds: RISK_THRESHOLDS,
    actions: {
      trusted: 'Allow Access',
      elevated: 'OTP Verification',
      high: 'Face Verification',
      critical: 'Block and Escalate'
    }
  });
});

// Start Server
connectDatabase().then(() => {
  server.listen(PORT, () => {
    console.log(`Node.js Express Server running on port ${PORT}...`);
  });
});
