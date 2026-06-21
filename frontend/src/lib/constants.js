export const API = process.env.NEXT_PUBLIC_API_URL || 'https://bob-hackathon-production.up.railway.app';

export const PRODUCT = {
  name: 'BoB Identity Trust Platform',
  bank: 'Bank of Baroda',
  tagline: 'Identity access and risk management for banking operations.'
};

export const CHANNELS = [
  { id: 'web', name: 'Internet Banking', icon: 'Globe' },
  { id: 'mobile', name: 'Mobile Banking', icon: 'Smartphone' },
  { id: 'atm', name: 'ATM', icon: 'CreditCard' },
  { id: 'employee', name: 'Employee Portal', icon: 'Users' },
  { id: 'support', name: 'Customer Support', icon: 'Headphones' }
];

export const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', roles: ['employee', 'admin'] },
  { id: 'customer_trust', label: 'Customer Trust', roles: ['employee', 'admin', 'customer'] },
  { id: 'risk_center', label: 'Risk Center', roles: ['employee', 'admin'] },
  { id: 'fraud', label: 'Fraud Detection', roles: ['employee', 'admin'] },
  { id: 'employee', label: 'Employee Monitoring', roles: ['employee', 'admin'] },
  { id: 'cases', label: 'Case Management', roles: ['employee', 'admin'] },
  { id: 'reports', label: 'Reports', roles: ['employee', 'admin'] },
  { id: 'settings', label: 'Settings', roles: ['employee', 'admin'] }
];

export const SCENARIOS = [
  {
    id: 'scenario_1',
    title: 'Trusted Customer Login',
    badge: 'Allow Access',
    badgeClass: 'badge-green',
    expectedTrust: 95,
    expectedDecision: 'Allow Access',
    desc: 'Customer logs in from registered laptop in Mumbai with normal behavior.',
    steps: [
      { label: 'Problem', text: 'How can we trust returning customers without forcing OTP every time?' },
      { label: 'Detection', text: 'Known device fingerprint. Usual location (Mumbai). Normal typing rhythm.' },
      { label: 'Risk Calculation', text: 'Base 25 − Known Device (−10) − Consistent Location (−5) − Normal Pattern (−5) = Risk 5' },
      { label: 'Decision', text: 'Allow Access — customer enters NetBanking without any step-up.' },
      { label: 'Outcome', text: 'Frictionless banking experience. Trust Score: 95/100.' }
    ]
  },
  {
    id: 'scenario_2',
    title: 'New Device Login',
    badge: 'OTP Required',
    badgeClass: 'badge-yellow',
    expectedTrust: 62,
    expectedDecision: 'OTP Verification Required',
    desc: 'Customer logs in from a new tablet. Device unknown but location is familiar.',
    steps: [
      { label: 'Problem', text: 'Unrecognized device — could be the customer or stolen credentials.' },
      { label: 'Detection', text: 'Device fingerprint does not match any registered device.' },
      { label: 'Risk Calculation', text: 'Base 25 + New Device (+13) = Risk 38. Trust Score: 62' },
      { label: 'Decision', text: 'OTP Verification Required — SMS sent to registered mobile.' },
      { label: 'Outcome', text: 'Customer verifies OTP. Device registered for future sessions.' }
    ]
  },
  {
    id: 'scenario_3',
    title: 'Password Reset + New Device',
    badge: 'Face Verification',
    badgeClass: 'badge-red',
    expectedTrust: 38,
    expectedDecision: 'Face Verification Required',
    desc: 'Account recovery from an unknown device — classic account takeover pattern.',
    steps: [
      { label: 'Problem', text: 'Password reset from unknown device indicates possible account takeover.' },
      { label: 'Detection', text: 'New device + password reset request detected simultaneously.' },
      { label: 'Risk Calculation', text: 'Base 25 + Password Reset + New Device (+37) = Risk 62. Trust Score: 38' },
      { label: 'Decision', text: 'Face Verification Required — live selfie match against stored KYC photo.' },
      { label: 'Outcome', text: 'If verified, access granted. If not, account locked and case escalated.' }
    ]
  },
  {
    id: 'scenario_4',
    title: 'Suspicious KYC Application',
    badge: 'Fraud Alert',
    badgeClass: 'badge-red',
    expectedTrust: 0,
    expectedDecision: 'Block and Escalate',
    desc: 'Duplicate Aadhaar, low face match, and suspicious network detected during onboarding.',
    steps: [
      { label: 'Problem', text: 'Fraudster attempting to open account with stolen identity documents.' },
      { label: 'Detection', text: 'Duplicate ID in system. Face match 38%. Application from proxy network.' },
      { label: 'Risk Calculation', text: 'Duplicate ID (+75) + Low Face Match (+55) + Suspicious IP (+20) = Critical' },
      { label: 'Decision', text: 'Block and Escalate — application rejected, fraud case created.' },
      { label: 'Outcome', text: 'Zero fraudulent accounts opened. Investigation team notified.' }
    ]
  },
  {
    id: 'scenario_5',
    title: 'Employee VIP Account Access',
    badge: 'Insider Alert',
    badgeClass: 'badge-red',
    expectedTrust: 0,
    expectedDecision: 'Block and Escalate',
    desc: 'Bank employee accesses VIP customer profile after business hours without approval.',
    steps: [
      { label: 'Problem', text: 'Insider threat — unauthorized access to sensitive customer data.' },
      { label: 'Detection', text: 'VIP account accessed. Off-hours query. No linked service ticket.' },
      { label: 'Risk Calculation', text: 'VIP Access (+65) + Off-Hours Access (+20) = Risk 85+' },
      { label: 'Decision', text: 'Block and Escalate — employee session terminated immediately.' },
      { label: 'Outcome', text: 'CISO notified. Full audit trail preserved for compliance review.' }
    ]
  }
];

export function riskLevel(score) {
  if (score > 80) return { color: 'var(--red-400)', label: 'Critical', dotClass: 'dot-red', badgeClass: 'badge-red' };
  if (score > 60) return { color: 'var(--red-400)', label: 'High Risk', dotClass: 'dot-red', badgeClass: 'badge-red' };
  if (score > 30) return { color: 'var(--yellow-400)', label: 'Elevated', dotClass: 'dot-yellow', badgeClass: 'badge-yellow' };
  return { color: 'var(--green-400)', label: 'Trusted', dotClass: 'dot-green', badgeClass: 'badge-green' };
}
