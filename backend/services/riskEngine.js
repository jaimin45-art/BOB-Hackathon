/**
 * BoB Identity Trust Platform — Risk Scoring Engine
 * Continuously calculates identity trust (0-100) from device, behavior, and context signals.
 */

const RISK_THRESHOLDS = {
  trusted: 30,
  elevated: 60,
  high: 80
};

const getRiskLevel = (riskScore) => {
  if (riskScore <= RISK_THRESHOLDS.trusted) return 'Trusted';
  if (riskScore <= RISK_THRESHOLDS.elevated) return 'Elevated';
  if (riskScore <= RISK_THRESHOLDS.high) return 'High Risk';
  return 'Critical';
};

const getDecision = (riskScore) => {
  if (riskScore > RISK_THRESHOLDS.high) return 'Block and Escalate';
  if (riskScore > RISK_THRESHOLDS.elevated) return 'Face Verification Required';
  if (riskScore > RISK_THRESHOLDS.trusted) return 'OTP Verification Required';
  return 'Allow Access';
};

const calculateIdentityRisk = (telemetry, context = {}, channel = 'web') => {
  let riskScore = 25;
  const violations = [];

  const isNewDevice = Boolean(context.new_device_fingerprint || context.device_change);
  const isRecovery = Boolean(context.password_reset || context.forgot_password_attempt);
  const isNewLocation = Boolean(context.location_change || context.new_city);

  // Module 1 — Trusted customer signals (only when no elevated-risk event)
  if (!isNewDevice && !isRecovery) {
    if (context.device_change === false || context.known_device) {
      violations.push({ desc: 'Known Device', weight: -10 });
      riskScore -= 10;
    }
    if (!isNewLocation) {
      violations.push({ desc: 'Consistent Location', weight: -5 });
      riskScore -= 5;
    }
    if (context.behavioral_normal || context.normal_login_pattern) {
      violations.push({ desc: 'Normal Login Pattern', weight: -5 });
      riskScore -= 5;
    }
    if (context.account_age_days >= 365) {
      violations.push({ desc: 'Mature Account History', weight: -5 });
      riskScore -= 5;
    }
  }

  // Module 2 — New device detection
  // Module 4 — Account recovery (combined to avoid double-counting)
  if (isRecovery && isNewDevice) {
    if (isNewLocation) {
      violations.push({ desc: 'Password Reset + New Device + New Location', weight: 75 });
      riskScore += 75;
    } else {
      violations.push({ desc: 'Password Reset + New Device', weight: 37 });
      riskScore += 37;
    }
  } else if (isRecovery) {
    violations.push({ desc: 'Account Recovery Request', weight: 15 });
    riskScore += 15;
  } else if (isNewDevice) {
    if (isNewLocation) {
      violations.push({ desc: 'New Device + New City', weight: 55 });
      riskScore += 55;
    } else {
      violations.push({ desc: 'New Device', weight: 13 });
      riskScore += 13;
    }
  }

  // Module 3 — Behavioral biometrics
  if (context.behavioral_anomaly) {
    violations.push({ desc: 'Abnormal Typing / Navigation Pattern', weight: 25 });
    riskScore += 25;
  } else if (context.behavioral_normal && isNewDevice) {
    violations.push({ desc: 'Behavior Matches Profile', weight: -10 });
    riskScore -= 10;
  }

  // Module 5 — KYC fraud
  if (context.kyc_onboarding) {
    if (context.duplicate_onboarding || context.duplicate_identity) {
      violations.push({ desc: 'Duplicate Identity Onboarding', weight: 75 });
      riskScore += 75;
    } else if (context.suspicious_identity || (context.low_image_confidence ?? context.imageMatchScore < 70)) {
      violations.push({ desc: 'Low KYC Document Confidence', weight: 55 });
      riskScore += 55;
    } else {
      violations.push({ desc: 'Standard KYC Processing', weight: 10 });
      riskScore += 10;
    }
  }

  // Module 6 — Employee / insider monitoring
  if (channel === 'employee' || context.role === 'employee') {
    const lookupCount = context.lookup_count || 0;
    if (context.bulk_export) {
      violations.push({ desc: 'Bulk Customer Data Export', weight: 90 });
      riskScore += 90;
    } else if (context.vip_record_accessed || context.vipAccessed) {
      violations.push({ desc: 'VIP Account Access Without Approval', weight: 65 });
      riskScore += 65;
    } else if (lookupCount >= 50) {
      violations.push({ desc: 'Excessive Customer Searches (50+ in 10 min)', weight: 40 });
      riskScore += 40;
    } else if (lookupCount > 5) {
      violations.push({ desc: 'Elevated Customer Record Lookups', weight: 15 });
      riskScore += 15;
    }
    if (context.off_hours_access) {
      violations.push({ desc: 'Off-Hours System Access', weight: 20 });
      riskScore += 20;
    }
    if (context.unknown_device) {
      violations.push({ desc: 'Unregistered Employee Device', weight: 25 });
      riskScore += 25;
    }
  }

  // Transaction & profile change risk
  if (context.transaction_amount && parseFloat(context.transaction_amount) > 100000) {
    violations.push({ desc: 'High-Value Transfer (> ₹1,00,000)', weight: 20 });
    riskScore += 20;
  }
  if (context.beneficiary_addition) {
    violations.push({ desc: 'New Beneficiary Addition', weight: 15 });
    riskScore += 15;
  }
  if (context.mobile_update || context.email_update) {
    violations.push({ desc: 'Contact Information Update', weight: 20 });
    riskScore += 20;
  }
  if (context.failed_logins_count >= 3) {
    violations.push({ desc: 'Multiple Failed Login Attempts', weight: 30 });
    riskScore += 30;
  }

  riskScore = Math.max(0, Math.min(100, riskScore));
  const trustScore = 100 - riskScore;

  return {
    riskScore,
    trustScore,
    riskLevel: getRiskLevel(riskScore),
    decision: getDecision(riskScore),
    violations,
    factors: {
      deviceTrust: isNewDevice ? 'Low' : 'High',
      locationConfidence: isNewLocation ? 'Low' : 'High',
      sessionRisk: getRiskLevel(riskScore),
      behavioralStatus: context.behavioral_anomaly ? 'Anomaly' : 'Normal'
    }
  };
};

const DEMO_SCENARIOS = {
  scenario_1: {
    action: 'login',
    channel: 'web',
    context: {
      device_change: false,
      location_change: false,
      behavioral_normal: true,
      known_device: true,
      device_name: 'Dell Laptop (Registered)',
      location_name: 'Mumbai, MH'
    },
    telemetry: [242, 120, 425]
  },
  scenario_2: {
    action: 'login',
    channel: 'mobile',
    context: {
      new_device_fingerprint: true,
      location_change: false,
      device_name: 'Samsung Galaxy Tab',
      location_name: 'Mumbai, MH'
    },
    telemetry: [242, 120, 425]
  },
  scenario_3: {
    action: 'password_reset',
    channel: 'web',
    context: {
      new_device_fingerprint: true,
      password_reset: true,
      location_change: false,
      device_name: 'Unknown Browser',
      location_name: 'Pune, MH'
    },
    telemetry: [200, 150, 320]
  },
  scenario_4: {
    action: 'kyc_onboarding',
    channel: 'web',
    kyc: {
      applicantName: 'Rahul Sharma',
      idNumber: 'AAXX0029P',
      imageMatchScore: 38,
      isDuplicate: true,
      isHostingIp: true
    }
  },
  scenario_5: {
    action: 'employee_access',
    channel: 'employee',
    context: {
      role: 'employee',
      vip_record_accessed: true,
      off_hours_access: true,
      lookup_count: 1,
      location_name: 'Delhi CP Branch'
    },
    employee: {
      employeeId: 'EMP-2081',
      employeeName: 'Priya Patel',
      branch: 'Delhi Connaught Place',
      department: 'Loans'
    }
  }
};

module.exports = {
  RISK_THRESHOLDS,
  calculateIdentityRisk,
  getRiskLevel,
  getDecision,
  DEMO_SCENARIOS
};
