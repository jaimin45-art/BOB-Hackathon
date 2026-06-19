'use client';

import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import {
  Shield, Activity, Users, CheckCircle, XCircle, Clock, UserCheck, UserX,
  LogOut, ChevronRight, MapPin, Key, Landmark, BarChart2, Inbox, ShieldCheck,
  RefreshCw, BellRing, Fingerprint, Smartphone, CreditCard, Info, Sliders,
  Globe, Headphones, FileText, AlertTriangle, TrendingUp, Lock
} from 'lucide-react';
import { API, PRODUCT, CHANNELS, NAV_ITEMS, SCENARIOS, riskLevel } from '../lib/constants';

const ICON_MAP = { Globe, Smartphone, CreditCard, Users, Headphones };

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [role, setRole] = useState(null);
  const [username, setUsername] = useState('');
  const [token, setToken] = useState('');
  const [authTab, setAuthTab] = useState('login');
  const [formUser, setFormUser] = useState('');
  const [formPass, setFormPass] = useState('');
  const [formRole, setFormRole] = useState('customer');
  const [authMsg, setAuthMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  const [tab, setTab] = useState('dashboard');
  const [logs, setLogs] = useState([]);
  const [cases, setCases] = useState([]);
  const [empLogs, setEmpLogs] = useState([]);
  const [reports, setReports] = useState(null);
  const [stats, setStats] = useState({ totalAlerts: 0, frictionlessRate: 85, distribution: { frictionless: 85, stepUp: 12, blocked: 3 } });
  const [wsStatus, setWsStatus] = useState('offline');

  const [selLog, setSelLog] = useState(null);
  const [selCase, setSelCase] = useState(null);
  const [selScenario, setSelScenario] = useState(null);
  const [scenarioLoading, setScenarioLoading] = useState(false);
  const [scenarioResult, setScenarioResult] = useState(null);

  const [stepUp, setStepUp] = useState(null);
  const [otp, setOtp] = useState('');
  const [customerTrust, setCustomerTrust] = useState({ trustScore: 95, riskScore: 5, decision: 'Allow Access', reasons: ['Known Device', 'Consistent Location', 'Normal Login Pattern'] });

  const [txPayee, setTxPayee] = useState('');
  const [txName, setTxName] = useState('');
  const [txIfsc, setTxIfsc] = useState('');
  const [txAmt, setTxAmt] = useState('');
  const [txLoading, setTxLoading] = useState(false);
  const [txMsg, setTxMsg] = useState(null);

  const [kycName, setKycName] = useState('');
  const [kycId, setKycId] = useState('');
  const [kycMatch, setKycMatch] = useState(85);
  const [kycDup, setKycDup] = useState(false);
  const [kycSuspiciousIp, setKycSuspiciousIp] = useState(false);

  const [empName, setEmpName] = useState('Ramesh Sharma');
  const [empId, setEmpId] = useState('EMP-1042');
  const [empLookups, setEmpLookups] = useState(2);
  const [empVip, setEmpVip] = useState(false);
  const [empBulk, setEmpBulk] = useState(false);

  const socketRef = useRef(null);

  useEffect(() => {
    if (!loggedIn || (role !== 'employee' && role !== 'admin')) return;
    const socket = io(API);
    socketRef.current = socket;
    socket.on('connect', () => { setWsStatus('online'); socket.emit('get-active-sessions'); });
    socket.on('disconnect', () => setWsStatus('offline'));
    socket.on('risk-signal', (log) => { setLogs(prev => [log, ...prev.slice(0, 99)]); });
    socket.on('employee-signal', (l) => { setEmpLogs(prev => [l, ...prev.slice(0, 99)]); });
    socket.on('new-case-alert', (c) => { setCases(prev => [c, ...prev]); });
    socket.on('case-resolved', (u) => { setCases(prev => prev.map(c => c._id === u._id ? u : c)); });
    loadData(token);
    return () => { socket.disconnect(); socketRef.current = null; };
  }, [loggedIn, role]);

  async function loadData(t) {
    if (!t) return;
    const h = { Authorization: `Bearer ${t}` };
    try {
      const [r1, r2, r3, r4, r5] = await Promise.all([
        fetch(`${API}/api/admin/logs`, { headers: h }),
        fetch(`${API}/api/admin/cases`, { headers: h }),
        fetch(`${API}/api/admin/employee-logs`, { headers: h }),
        fetch(`${API}/api/admin/stats`, { headers: h }),
        fetch(`${API}/api/admin/reports`, { headers: h })
      ]);
      if (r1.ok) { const d = await r1.json(); setLogs(d); if (d.length) setSelLog(d[0]); }
      if (r2.ok) { const d = await r2.json(); setCases(d); if (d.length) setSelCase(d[0]); }
      if (r3.ok) setEmpLogs(await r3.json());
      if (r4.ok) setStats(await r4.json());
      if (r5.ok) setReports(await r5.json());
    } catch (e) { console.error(e); }
  }

  async function handleAuth(e) {
    e.preventDefault();
    setLoading(true);
    setAuthMsg(null);
    const isLogin = authTab === 'login';
    const url = isLogin ? `${API}/api/auth/login` : `${API}/api/auth/register`;
    const body = isLogin
      ? { username: formUser, password: formPass, telemetry: [242, 120, 425], context: { device_change: false, location_change: false, behavioral_normal: true, known_device: true, device_name: 'Chrome Browser', location_name: 'Mumbai, MH' } }
      : { username: formUser, password: formPass, role: formRole };

    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) {
        setAuthMsg({ type: 'error', text: data.error || 'Authentication failed.' });
      } else if (!isLogin) {
        setAuthMsg({ type: 'success', text: 'Account created. Please sign in.' });
        setAuthTab('login');
        setFormPass('');
      } else if (data.decision?.includes('OTP') || data.decision?.includes('Face')) {
        setStepUp({ type: data.decision.includes('OTP') ? 'OTP' : 'Face', score: data.riskScore, role: data.role });
      } else {
        completeLogin(formUser, data.role, data.token, data);
      }
    } catch {
      setAuthMsg({ type: 'error', text: 'Cannot reach server. Start backend on port 5000.' });
    } finally {
      setLoading(false);
    }
  }

  function completeLogin(user, userRole, userToken, data) {
    setLoggedIn(true);
    setUsername(user);
    setRole(userRole);
    setToken(userToken);
    if (data) {
      setCustomerTrust({
        trustScore: data.trustScore || 95,
        riskScore: data.riskScore || 5,
        decision: data.decision || 'Allow Access',
        reasons: (data.violations || []).filter(v => v.weight < 0).map(v => v.desc).slice(0, 3)
      });
    }
    if (userRole === 'employee' || userRole === 'admin') setTab('dashboard');
  }

  async function verifyStepUp(success) {
    try {
      const res = await fetch(`${API}/api/auth/verify-step-up`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: formUser, stepUpSuccess: success, originalScore: stepUp.score })
      });
      const data = await res.json();
      if (res.ok) completeLogin(formUser, stepUp.role || data.role || 'customer', data.token, data);
      else setAuthMsg({ type: 'error', text: 'Verification failed. Session blocked.' });
    } catch (e) { console.error(e); }
    setStepUp(null);
  }

  function logout() {
    setLoggedIn(false); setRole(null); setUsername(''); setToken('');
    setScenarioResult(null); setSelScenario(null);
    if (socketRef.current) socketRef.current.disconnect();
  }

  async function runScenario(s) {
    setSelScenario(s);
    setScenarioLoading(true);
    setScenarioResult(null);
    try {
      const res = await fetch(`${API}/api/demo/run/${s.id}`, { method: 'POST' });
      const data = await res.json();
      setScenarioResult(data);
      loadData(token);
    } catch {
      setScenarioResult({ decision: 'Error', riskScore: 0, trustScore: 0 });
    } finally {
      setScenarioLoading(false);
    }
  }

  async function handleTransfer(e) {
    e.preventDefault();
    setTxLoading(true); setTxMsg(null);
    try {
      const res = await fetch(`${API}/api/trust/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'fund_transfer',
          channel: 'web',
          userId: username,
          telemetry: [242, 120, 425],
          context: { transaction_amount: parseFloat(txAmt), known_device: true, device_name: 'Registered Device', location_name: 'Mumbai, IN', behavioral_normal: true }
        })
      });
      const data = await res.json();
      setCustomerTrust({ trustScore: data.trustScore, riskScore: data.riskScore, decision: data.decision, reasons: data.violations?.map(v => v.desc) || [] });
      if (data.decision === 'Allow Access') {
        setTxMsg({ type: 'success', text: `₹${parseFloat(txAmt).toLocaleString('en-IN')} transferred to ${txName} successfully.` });
        setTxPayee(''); setTxName(''); setTxIfsc(''); setTxAmt('');
      } else {
        setTxMsg({ type: 'warning', text: `${data.decision} — Trust Score: ${data.trustScore}/100` });
      }
    } catch { setTxMsg({ type: 'error', text: 'Transfer evaluation failed.' }); }
    setTxLoading(false);
  }

  async function submitKyc(e) {
    e.preventDefault();
    const res = await fetch(`${API}/api/kyc/onboard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applicantName: kycName, idNumber: kycId, imageMatchScore: parseInt(kycMatch), isDuplicate: kycDup, isHostingIp: kycSuspiciousIp })
    });
    const d = await res.json();
    alert(d.success ? `Application approved. Trust Score: ${d.trustScore}` : `Flagged: ${d.decision} (Risk: ${d.riskScore})`);
    setKycName(''); setKycId(''); setKycDup(false); setKycSuspiciousIp(false);
    loadData(token);
  }

  async function submitEmployeeActivity(e) {
    e.preventDefault();
    const res = await fetch(`${API}/api/employee/activity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ employeeId: empId, employeeName: empName, lookupCount: parseInt(empLookups), vipAccessed: empVip, bulkExport: empBulk })
    });
    const d = await res.json();
    alert(`Activity logged: ${d.status} — Risk ${d.riskScore}/100 — ${d.decision || d.log?.action}`);
    setEmpVip(false); setEmpBulk(false);
    loadData(token);
  }

  async function resolveCase(id, status) {
    await fetch(`${API}/api/admin/cases/${id}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status })
    });
    loadData(token);
  }

  const visibleNav = NAV_ITEMS.filter(n => n.roles.includes(role));

  // ─── AUTH / LANDING ───
  if (!loggedIn) {
    return (
      <div className="landing-page">
        <div className="landing-hero">
          <div className="landing-brand">
            <div className="auth-logo-icon" style={{ marginBottom: 16 }}><Landmark size={28} /></div>
            <h1>{PRODUCT.name}</h1>
            <p className="tagline">{PRODUCT.tagline}</p>
            <p className="subtitle">
              A privacy-first, risk-based identity trust framework that continuously validates customer and enterprise identities across all banking channels — triggering verification only when risk increases.
            </p>
            <div className="landing-modules">
              {['Identity Trust Engine', 'Device Intelligence', 'Behavioral Analytics', 'Fraud Detection', 'Insider Threat Engine', 'Case Management', 'Explainable AI', 'Verification Orchestrator', 'Audit & Compliance'].map(m => (
                <div key={m} className="module-pill">{m}</div>
              ))}
            </div>
          </div>

          <div className="auth-card" style={{ width: 380 }}>
            <div className="card">
              <div className="card-body">
                <p style={{ textAlign: 'center', fontSize: 13, fontWeight: 600, color: 'var(--gray-700)', marginBottom: 4 }}>{PRODUCT.bank}</p>
                <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--gray-400)', marginBottom: 16 }}>Secure Sign In</p>

                <div className="auth-tabs">
                  <button className={`auth-tab ${authTab === 'login' ? 'active' : ''}`} onClick={() => { setAuthTab('login'); setAuthMsg(null); }}>Sign In</button>
                  <button className={`auth-tab ${authTab === 'register' ? 'active' : ''}`} onClick={() => { setAuthTab('register'); setAuthMsg(null); }}>Register</button>
                </div>

                {authMsg && (
                  <div className={`info-box ${authMsg.type === 'error' ? 'red' : 'green'} mb-12`}>
                    {authMsg.type === 'error' ? <XCircle size={14} /> : <CheckCircle size={14} />}
                    <span>{authMsg.text}</span>
                  </div>
                )}

                <form className="auth-form" onSubmit={handleAuth}>
                  <div className="form-group">
                    <label className="form-label">Username</label>
                    <input className="form-input" type="text" placeholder="Enter username" value={formUser} onChange={e => setFormUser(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Password</label>
                    <input className="form-input" type="password" placeholder="••••••••" value={formPass} onChange={e => setFormPass(e.target.value)} required />
                  </div>
                  {authTab === 'register' && (
                    <div className="form-group">
                      <label className="form-label">Account Type</label>
                      <select className="form-input" value={formRole} onChange={e => setFormRole(e.target.value)}>
                        <option value="customer">Retail Customer</option>
                        <option value="employee">Fraud Operations Team</option>
                      </select>
                    </div>
                  )}
                  <button className="btn btn-primary" type="submit" disabled={loading}>
                    {loading ? <RefreshCw size={14} className="spin" /> : <ShieldCheck size={14} />}
                    {authTab === 'login' ? 'Sign In Securely' : 'Create Account'}
                  </button>
                </form>

                <div className="auth-hint">
                  <div className="hint-title">Demo Credentials</div>
                  <div className="hint-grid">
                    <span>Customer:</span><strong>bob_customer / customer123</strong>
                    <span>Fraud Ops:</span><strong>bob_employee / employee123</strong>
                    <span>Admin:</span><strong>bob_admin / admin123</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {stepUp && (
          <div className="modal-overlay">
            <div className="modal-card">
              <div className="modal-icon">{stepUp.type === 'OTP' ? <Key size={22} /> : <Fingerprint size={22} />}</div>
              <h3>Step-Up Verification Required</h3>
              <p className="modal-desc">
                {stepUp.type === 'OTP'
                  ? 'Risk-based authentication triggered. Enter the OTP sent to your registered mobile number.'
                  : 'Elevated risk detected. Please complete face verification to continue.'}
              </p>
              {stepUp.type === 'OTP' ? (
                <>
                  <input className="form-input mb-12" type="text" placeholder="Enter 6-digit OTP" value={otp} onChange={e => setOtp(e.target.value)} style={{ textAlign: 'center', letterSpacing: 4, fontSize: 16 }} />
                  <div className="flex-center gap-8">
                    <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => verifyStepUp(otp === '123456')}>Verify OTP</button>
                    <button className="btn btn-outline" onClick={() => setStepUp(null)}>Cancel</button>
                  </div>
                  <p className="text-xs text-gray mt-8">Demo OTP: <strong>123456</strong></p>
                </>
              ) : (
                <div className="flex-center gap-8">
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => verifyStepUp(true)}>Complete Face Verification</button>
                  <button className="btn btn-outline" onClick={() => setStepUp(null)}>Cancel</button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── CUSTOMER NETBANKING ───
  if (role === 'customer') {
    const rl = riskLevel(customerTrust.riskScore);
    return (
      <div style={{ minHeight: '100vh', background: 'var(--gray-50)' }}>
        <header className="customer-header">
          <div className="customer-header-left">
            <div className="sidebar-logo-icon"><Landmark size={16} /></div>
            <div>
              <strong style={{ fontSize: 13 }}>BoB NetBanking</strong>
              <p className="text-xxs text-gray">{PRODUCT.bank}</p>
            </div>
          </div>
          <div className="customer-header-right">
            <span className={`badge ${rl.badgeClass} flex-center`}><ShieldCheck size={10} /> {customerTrust.decision}</span>
            <span className="text-sm text-gray">Welcome, <strong>{username}</strong></span>
            <button className="btn btn-outline btn-sm" onClick={logout}><LogOut size={12} /> Logout</button>
          </div>
        </header>

        <div className="customer-body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card account-card">
              <p className="text-xs text-gray">Savings Account — ****8921</p>
              <div className="balance">₹4,82,410.50</div>
              <p className="account-info">Mumbai HQ Branch • IFSC: BARB0MUMNAG</p>
              <div className="action-btns">
                {['Fund Transfer', 'Pay Bills', 'FD Booking', 'Statement'].map(a => (
                  <button key={a} className="action-btn">{a}</button>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="card-header flex-center"><CreditCard size={14} /> Fund Transfer</div>
              <div className="card-body">
                {txMsg && <div className={`info-box ${txMsg.type === 'success' ? 'green' : txMsg.type === 'warning' ? 'orange' : 'red'} mb-12`}>{txMsg.text}</div>}
                <form onSubmit={handleTransfer}>
                  <div className="form-row mb-12">
                    <div className="form-group"><label className="form-label">Payee Account</label><input className="form-input" placeholder="50921004812" value={txPayee} onChange={e => setTxPayee(e.target.value)} required /></div>
                    <div className="form-group"><label className="form-label">Beneficiary Name</label><input className="form-input" placeholder="Rahul Mehta" value={txName} onChange={e => setTxName(e.target.value)} required /></div>
                  </div>
                  <div className="form-row mb-12">
                    <div className="form-group"><label className="form-label">IFSC Code</label><input className="form-input" placeholder="BARB0DELCP" value={txIfsc} onChange={e => setTxIfsc(e.target.value)} required /></div>
                    <div className="form-group"><label className="form-label">Amount (₹)</label><input className="form-input" type="number" placeholder="25000" value={txAmt} onChange={e => setTxAmt(e.target.value)} required /></div>
                  </div>
                  <div className="flex-between">
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => { setTxPayee(''); setTxName(''); setTxIfsc(''); setTxAmt(''); setTxMsg(null); }}>Clear</button>
                    <button type="submit" className="btn btn-primary btn-sm" disabled={txLoading} style={{ width: 'auto' }}>{txLoading ? 'Evaluating...' : 'Authorize Transfer'}</button>
                  </div>
                </form>
              </div>
            </div>

            <div className="card">
              <div className="card-header flex-center"><Activity size={14} /> Recent Transactions</div>
              <div className="card-body" style={{ padding: 0 }}>
                <table className="data-table">
                  <thead><tr><th>Date</th><th>Description</th><th>Type</th><th>Amount</th></tr></thead>
                  <tbody>
                    {[
                      { date: '19 Jun', desc: 'Amazon Pay', type: 'Debit', amt: '-₹2,450', c: 'text-red' },
                      { date: '18 Jun', desc: 'Salary — TCS Ltd', type: 'Credit', amt: '+₹85,000', c: 'text-green' },
                      { date: '17 Jun', desc: 'LIC Premium', type: 'Debit', amt: '-₹12,000', c: 'text-red' }
                    ].map((t, i) => (
                      <tr key={i}><td>{t.date}</td><td>{t.desc}</td><td><span className={`badge ${t.type === 'Credit' ? 'badge-green' : 'badge-red'}`}>{t.type}</span></td><td className={`text-bold mono ${t.c}`}>{t.amt}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="card trust-sidebar">
              <div className="card-body">
                <p className="text-xxs text-gray text-center text-bold" style={{ letterSpacing: 0.5 }}>IDENTITY TRUST SCORE</p>
                <div className="trust-score" style={{ color: rl.color }}>{customerTrust.trustScore}<span className="text-sm text-gray">/100</span></div>
                <p className="trust-label" style={{ color: rl.color }}>{rl.label}</p>
                <p className="trust-sub">{customerTrust.decision}</p>
              </div>
            </div>
            <div className="card">
              <div className="card-body">
                <p className="text-xxs text-orange text-bold mb-12" style={{ letterSpacing: 0.5 }}>TRUST REASONING</p>
                {(customerTrust.reasons.length ? customerTrust.reasons : ['Known Device', 'Consistent Location', 'Normal Login Pattern']).map(r => (
                  <div key={r} className="signal-item">
                    <CheckCircle size={12} color="var(--green-500)" />
                    <span className="text-xs">{r}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="card">
              <div className="card-body">
                <p className="text-xxs text-orange text-bold mb-12" style={{ letterSpacing: 0.5 }}>IDENTITY SIGNALS</p>
                {[
                  { icon: Smartphone, name: 'Device', val: 'Registered Device' },
                  { icon: MapPin, name: 'Location', val: 'Mumbai, IN' },
                  { icon: Fingerprint, name: 'Behavior', val: 'Normal Pattern' },
                  { icon: Clock, name: 'Risk Level', val: rl.label }
                ].map(s => (
                  <div key={s.name} className="signal-item">
                    <div className="signal-icon"><s.icon size={12} /></div>
                    <div className="signal-info"><div className="signal-name">{s.name}</div><div className="signal-value">{s.val}</div></div>
                    <CheckCircle size={12} color="var(--green-500)" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── FRAUD OPERATIONS DASHBOARD ───
  return (
    <div className="ops-layout">
      <aside className="ops-sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon"><Landmark size={14} /></div>
          <div><h2>BoB Identity</h2><p>Trust Platform</p></div>
        </div>
        <nav className="sidebar-nav">
          {visibleNav.map(item => (
            <button key={item.id} className={`nav-btn ${tab === item.id ? 'active' : ''}`} onClick={() => setTab(item.id)}>
              {item.id === 'dashboard' && <BarChart2 size={14} />}
              {item.id === 'customer_trust' && <UserCheck size={14} />}
              {item.id === 'risk_center' && <Shield size={14} />}
              {item.id === 'fraud' && <AlertTriangle size={14} />}
              {item.id === 'employee' && <Users size={14} />}
              {item.id === 'cases' && <Inbox size={14} />}
              {item.id === 'reports' && <FileText size={14} />}
              {item.id === 'settings' && <Sliders size={14} />}
              {item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="flex-center text-xs mb-12" style={{ color: wsStatus === 'online' ? 'var(--green-400)' : 'var(--yellow-400)' }}>
            <span className={`dot ${wsStatus === 'online' ? 'dot-green' : 'dot-yellow'}`} />
            {wsStatus === 'online' ? 'Live Monitoring' : 'Reconnecting...'}
          </div>
          <div className="sidebar-user">
            <div className="sidebar-avatar">{username[0]?.toUpperCase()}</div>
            <div><div className="text-sm text-bold" style={{ color: '#e2e8f0' }}>{username}</div><div className="text-xxs" style={{ color: '#64748b', textTransform: 'capitalize' }}>{role}</div></div>
          </div>
          <button className="btn btn-outline btn-sm btn-block" onClick={logout} style={{ marginTop: 8, borderColor: 'var(--navy-600)', color: '#94a3b8' }}><LogOut size={12} /> Sign Out</button>
        </div>
      </aside>

      <main className="ops-main">
        <div className="ops-topbar">
          <div>
            <h2>{visibleNav.find(n => n.id === tab)?.label}</h2>
            <p>{PRODUCT.tagline}</p>
          </div>
          <div className="flex-center gap-8">
            {stats.totalAlerts > 0 && <span className="badge badge-red flex-center"><BellRing size={10} /> {stats.totalAlerts} open alerts</span>}
            <button className="btn btn-outline btn-sm" onClick={() => loadData(token)} style={{ borderColor: 'var(--navy-600)', color: '#94a3b8' }}><RefreshCw size={11} /> Refresh</button>
          </div>
        </div>

        <div className="ops-body">

          {tab === 'dashboard' && (<>
            <div className="judge-banner">
              <Info size={18} style={{ flexShrink: 0 }} />
              <div>
                <strong>For Judges (3-min demo):</strong> Go to <em>Customer Trust</em> → run any of the 5 demo scenarios. Each shows Problem → Detection → Risk Calculation → Decision → Outcome with live API results.
              </div>
            </div>

            <div className="stats-row mb-16">
              {[
                { label: 'Active Sessions Monitored', val: (logs.length + 1247).toLocaleString(), cls: '' },
                { label: 'Frictionless Access Rate', val: `${stats.frictionlessRate || 85}%`, cls: 'highlight-green' },
                { label: 'Open Investigation Cases', val: stats.totalAlerts || cases.filter(c => !['Resolved', 'Closed'].includes(c.status)).length, cls: 'highlight-orange' },
                { label: 'Threats Blocked Today', val: reports?.resolvedToday ?? 8, cls: 'highlight-red' }
              ].map(s => (
                <div key={s.label} className={`ops-stat ${s.cls}`}><div className="stat-value">{s.val}</div><div className="stat-label">{s.label}</div></div>
              ))}
            </div>

            <div className="ops-card mb-16">
              <div className="card-header">Multi-Channel Trust Engine — Same Identity, All Channels</div>
              <div className="card-body">
                <div className="channel-grid">
                  {CHANNELS.map(ch => {
                    const Icon = ICON_MAP[ch.icon] || Globe;
                    return (
                      <div key={ch.id} className="channel-card active">
                        <div className="channel-icon"><Icon size={16} /></div>
                        <div className="channel-name">{ch.name}</div>
                        <div className="channel-status">● Protected</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="ops-card mb-16">
              <div className="card-header">How Continuous Trust Works</div>
              <div className="card-body">
                <div className="arch-flow">
                  {[
                    { num: '1', title: 'Collect Signals', tech: 'Device, Location, Behavior' },
                    { num: '2', title: 'Score Risk', tech: 'Rules Engine + ML Model' },
                    { num: '3', title: 'Calculate Trust', tech: '0–100 Trust Index' },
                    { num: '4', title: 'Adaptive Decision', tech: 'Allow / OTP / Face / Block' },
                    { num: '5', title: 'Audit Trail', tech: 'Encrypted Logs + Cases' }
                  ].map((s, i) => (
                    <React.Fragment key={i}>
                      <div className="arch-step" style={{ background: 'var(--navy-800)', borderColor: 'var(--navy-700)' }}>
                        <div className="step-num">Step {s.num}</div>
                        <div className="step-title" style={{ color: '#e2e8f0' }}>{s.title}</div>
                        <div className="step-tech">{s.tech}</div>
                      </div>
                      {i < 4 && <ChevronRight size={16} className="arch-arrow" />}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid-2">
              <div className="ops-card">
                <div className="card-header">Decision Distribution</div>
                <div className="card-body">
                  {[
                    { label: 'Frictionless (Allow)', pct: stats.distribution?.frictionless || 85, color: 'var(--green-400)' },
                    { label: 'Step-Up (OTP / Face)', pct: stats.distribution?.stepUp || 12, color: 'var(--yellow-400)' },
                    { label: 'Blocked (Critical)', pct: stats.distribution?.blocked || 3, color: 'var(--red-400)' }
                  ].map(d => (
                    <div key={d.label} className="mb-12">
                      <div className="flex-between text-xs mb-12"><span style={{ color: '#94a3b8' }}>{d.label}</span><strong style={{ color: d.color }}>{d.pct}%</strong></div>
                      <div className="progress-bar" style={{ background: 'var(--navy-800)' }}><div className="progress-fill" style={{ width: `${d.pct}%`, background: d.color }} /></div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="ops-card">
                <div className="card-header">Investigation Queues by Type</div>
                <div className="card-body">
                  {[
                    { label: 'Account Takeover', cat: 'Account Takeover', color: 'var(--red-400)' },
                    { label: 'KYC Fraud', cat: 'KYC Fraud', color: 'var(--yellow-400)' },
                    { label: 'Insider Threat', cat: 'Insider Threat', color: 'var(--purple-500)' },
                    { label: 'Suspicious Recovery', cat: 'Suspicious Recovery', color: 'var(--blue-400)' }
                  ].map(q => (
                    <div key={q.label} className="flex-between text-sm" style={{ padding: '10px 0', borderBottom: '1px solid var(--navy-800)' }}>
                      <span className="flex-center" style={{ color: '#cbd5e1' }}><span className="dot" style={{ background: q.color }} />{q.label}</span>
                      <strong style={{ color: '#e2e8f0' }}>{cases.filter(c => c.category === q.cat).length}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>)}

          {tab === 'customer_trust' && (<>
            <div className="judge-banner"><Info size={18} style={{ flexShrink: 0 }} /><div><strong>Demo Scenarios:</strong> Click any scenario below to run a live trust evaluation. Results show trust score, contributing factors, and the system decision.</div></div>
            <div className="grid-2-wide">
              <div>
                <h3 className="text-sm text-bold mb-12" style={{ color: '#e2e8f0' }}>Select a Demo Scenario</h3>
                {SCENARIOS.map(s => (
                  <div key={s.id} className={`scenario-card ${selScenario?.id === s.id ? 'active' : ''}`} style={{ background: 'var(--navy-800)', borderColor: selScenario?.id === s.id ? 'var(--orange-500)' : 'var(--navy-700)' }}>
                    <div className="flex-between"><h4 style={{ color: '#e2e8f0' }}>{s.title}</h4><span className={`badge ${s.badgeClass}`}>{s.badge}</span></div>
                    <p style={{ color: '#94a3b8' }}>{s.desc}</p>
                    <p className="text-xxs" style={{ color: '#64748b', marginBottom: 8 }}>Expected: Trust {s.expectedTrust} → {s.expectedDecision}</p>
                    <button className="btn btn-primary btn-sm" style={{ width: 'auto' }} disabled={scenarioLoading} onClick={() => runScenario(s)}>
                      {scenarioLoading && selScenario?.id === s.id ? 'Evaluating...' : 'Run Scenario'}
                    </button>
                  </div>
                ))}
              </div>
              <div>
                {!scenarioResult && !scenarioLoading ? (
                  <div className="ops-card"><div className="card-body text-center" style={{ padding: 48 }}><Shield size={32} color="#475569" /><p className="text-sm mt-12" style={{ color: '#64748b' }}>Select a scenario to see the full trust evaluation flow.</p></div></div>
                ) : scenarioLoading ? (
                  <div className="ops-card"><div className="card-body text-center" style={{ padding: 48 }}><RefreshCw size={24} className="spin" style={{ color: '#64748b' }} /><p className="text-sm mt-12" style={{ color: '#64748b' }}>Running trust evaluation...</p></div></div>
                ) : (
                  <div className="ops-card">
                    <div className="card-header">Trust Evaluation Result</div>
                    <div className="card-body">
                      <div className="flex-center mb-16" style={{ gap: 20 }}>
                        <div className="text-center" style={{ padding: '16px 20px', border: '1px solid var(--navy-700)', borderRadius: 8, minWidth: 100 }}>
                          <div style={{ fontSize: 36, fontWeight: 700, color: riskLevel(scenarioResult.riskScore).color }}>{scenarioResult.trustScore}</div>
                          <div className="text-xxs" style={{ color: '#64748b' }}>Trust Score</div>
                        </div>
                        <div>
                          <div className="text-xxs" style={{ color: '#64748b' }}>Decision</div>
                          <div className="text-bold" style={{ fontSize: 15, color: riskLevel(scenarioResult.riskScore).color }}>{scenarioResult.decision}</div>
                          <div className="text-xxs" style={{ color: '#64748b' }}>Risk: {scenarioResult.riskScore}/100 • {scenarioResult.riskLevel}</div>
                        </div>
                      </div>

                      {scenarioResult.contributingFactors?.length > 0 && (
                        <div className="mb-16">
                          <p className="text-xs text-bold mb-12" style={{ color: '#e2e8f0' }}>Contributing Factors</p>
                          {scenarioResult.contributingFactors.map((f, i) => (
                            <div key={i} className="factor-row">
                              <span>{f.factor}</span>
                              <span className={`factor-impact ${f.impact.startsWith('+') ? 'positive' : 'negative'}`}>{f.impact}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="timeline">
                        {selScenario?.steps?.map((step, i) => {
                          const colors = ['var(--blue-400)', 'var(--yellow-400)', 'var(--orange-400)', 'var(--red-400)', 'var(--green-400)'];
                          return (
                            <div key={i} className="timeline-step">
                              <div className="timeline-marker">
                                <div className="timeline-dot" style={{ background: 'var(--navy-800)', color: colors[i], border: `1.5px solid ${colors[i]}` }}>{i + 1}</div>
                                {i < selScenario.steps.length - 1 && <div className="timeline-line" style={{ background: 'var(--navy-700)' }} />}
                              </div>
                              <div className="timeline-content">
                                <h4 style={{ color: '#e2e8f0' }}>{step.label}</h4>
                                <p style={step.label === 'Risk Calculation' ? { fontFamily: 'monospace', color: 'var(--orange-400)', fontWeight: 600 } : { color: '#94a3b8' }}>{step.text}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {scenarioResult.explanation && (
                        <div className="info-box blue mt-12" style={{ background: 'rgba(59,130,246,0.1)', borderColor: 'rgba(59,130,246,0.3)', color: '#93c5fd' }}>
                          <Info size={14} style={{ flexShrink: 0 }} />
                          <div className="text-xs"><strong>Explainable AI:</strong> {scenarioResult.explanation}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>)}

          {tab === 'risk_center' && (<>
            <div className="judge-banner"><Info size={18} style={{ flexShrink: 0 }} /><div><strong>Risk Center:</strong> Real-time audit log of every identity evaluation. Click any entry to see the full risk breakdown and AI explanation.</div></div>
            <div className="grid-2-wide">
              <div className="scroll-y" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {logs.map((l, i) => (
                  <div key={l._id || i} className={`ops-list-item ${selLog?._id === l._id ? 'selected' : ''}`} onClick={() => setSelLog(l)}>
                    <div className="flex-between mb-12">
                      <span className="flex-center"><span className={`dot ${riskLevel(l.riskScore).dotClass}`} /><strong className="text-sm" style={{ color: '#e2e8f0' }}>{l.userId}</strong></span>
                      <strong className="text-sm" style={{ color: riskLevel(l.riskScore).color }}>Risk {l.riskScore}</strong>
                    </div>
                    <p className="text-xs" style={{ color: '#64748b', lineHeight: 1.4 }}>{l.decision} — {l.explanation?.substring(0, 100)}...</p>
                  </div>
                ))}
                {logs.length === 0 && <p className="text-xs text-center" style={{ color: '#64748b' }}>No evaluations yet. Run a demo scenario.</p>}
              </div>
              <div>
                {selLog ? (
                  <div className="ops-card">
                    <div className="card-header">Risk Evaluation Detail</div>
                    <div className="card-body">
                      {[
                        ['User', selLog.userId],
                        ['Risk Score', `${selLog.riskScore}/100`],
                        ['Trust Score', `${100 - selLog.riskScore}/100`],
                        ['Decision', selLog.decision],
                        ['Time', new Date(selLog.timestamp).toLocaleString('en-IN')]
                      ].map(([k, v]) => (
                        <div key={k} className="flex-between text-sm" style={{ padding: '8px 0', borderBottom: '1px solid var(--navy-800)' }}>
                          <span style={{ color: '#64748b' }}>{k}</span><strong style={{ color: '#e2e8f0' }}>{v}</strong>
                        </div>
                      ))}
                      {selLog.violations?.map((v, i) => (
                        <div key={i} className="factor-row mt-8">
                          <span>{v.desc}</span>
                          <span className={`factor-impact ${v.weight > 0 ? 'positive' : 'negative'}`}>{v.weight > 0 ? `+${v.weight}` : v.weight}</span>
                        </div>
                      ))}
                      {selLog.explanation && <div className="info-box blue mt-12" style={{ background: 'rgba(59,130,246,0.1)', borderColor: 'rgba(59,130,246,0.3)', color: '#93c5fd' }}><Info size={14} /><div className="text-xs">{selLog.explanation}</div></div>}
                    </div>
                  </div>
                ) : (
                  <div className="ops-card"><div className="card-body text-center" style={{ padding: 40, color: '#64748b' }}>Select a log entry to review</div></div>
                )}
              </div>
            </div>
          </>)}

          {tab === 'fraud' && (<>
            <div className="judge-banner"><Info size={18} style={{ flexShrink: 0 }} /><div><strong>Fraud Detection:</strong> Active alerts across account takeover, KYC fraud, suspicious recovery, and insider threats — sorted by severity.</div></div>
            <div className="stats-row mb-16">
              {[
                { label: 'Critical Alerts', val: logs.filter(l => l.riskScore > 80).length, cls: 'highlight-red' },
                { label: 'High Risk Sessions', val: logs.filter(l => l.riskScore > 60 && l.riskScore <= 80).length, cls: 'highlight-orange' },
                { label: 'KYC Fraud Cases', val: cases.filter(c => c.category === 'KYC Fraud').length, cls: '' },
                { label: 'ATO Attempts', val: cases.filter(c => c.category === 'Account Takeover').length, cls: '' }
              ].map(s => (
                <div key={s.label} className={`ops-stat ${s.cls}`}><div className="stat-value">{s.val}</div><div className="stat-label">{s.label}</div></div>
              ))}
            </div>
            <div className="grid-2 mb-16">
              <div className="ops-card">
                <div className="card-header">Flagged KYC Applications</div>
                <div className="card-body scroll-y" style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 280 }}>
                  {cases.filter(c => c.category === 'KYC Fraud').map((c, i) => (
                    <div key={c._id || i} className="ops-list-item" style={{ borderLeft: `3px solid ${riskLevel(c.riskScore).color}` }}>
                      <div className="flex-between"><strong className="text-sm" style={{ color: '#e2e8f0' }}>{c.userId}</strong><StatusBadge status={c.status} /></div>
                      <p className="text-xs mt-8" style={{ color: '#64748b' }}>{c.reason?.substring(0, 120)}</p>
                    </div>
                  ))}
                  {cases.filter(c => c.category === 'KYC Fraud').length === 0 && <p className="text-xs text-center" style={{ color: '#64748b' }}>No flagged KYC applications. Submit one below or run Scenario 4.</p>}
                </div>
              </div>
              <div className="ops-card">
                <div className="card-header">Review KYC Application</div>
                <div className="card-body">
                  <form onSubmit={submitKyc} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div className="form-group"><label className="form-label" style={{ color: '#94a3b8' }}>Applicant Name</label><input className="form-input" style={{ background: 'var(--navy-800)', borderColor: 'var(--navy-700)', color: '#e2e8f0' }} placeholder="Full name" value={kycName} onChange={e => setKycName(e.target.value)} required /></div>
                    <div className="form-group"><label className="form-label" style={{ color: '#94a3b8' }}>ID Number (Aadhaar/PAN)</label><input className="form-input" style={{ background: 'var(--navy-800)', borderColor: 'var(--navy-700)', color: '#e2e8f0' }} placeholder="Document ID" value={kycId} onChange={e => setKycId(e.target.value)} required /></div>
                    <div className="form-group">
                      <div className="flex-between"><label className="form-label" style={{ color: '#94a3b8' }}>Face Match Confidence</label><strong className="text-xs text-orange">{kycMatch}%</strong></div>
                      <input type="range" min={10} max={100} value={kycMatch} onChange={e => setKycMatch(e.target.value)} style={{ width: '100%', accentColor: 'var(--orange-500)' }} />
                    </div>
                    <label className="form-checkbox" style={{ color: '#94a3b8' }}><input type="checkbox" checked={kycDup} onChange={e => setKycDup(e.target.checked)} /> Duplicate identity detected</label>
                    <label className="form-checkbox" style={{ color: '#94a3b8' }}><input type="checkbox" checked={kycSuspiciousIp} onChange={e => setKycSuspiciousIp(e.target.checked)} /> Suspicious network origin</label>
                    <button className="btn btn-primary" type="submit">Submit for Evaluation</button>
                  </form>
                </div>
              </div>
            </div>
            <div className="ops-card">
              <div className="card-header">Active Fraud Alerts</div>
              <div className="card-body" style={{ padding: 0 }}>
                <table className="ops-table">
                  <thead><tr><th>Severity</th><th>Category</th><th>User</th><th>Risk</th><th>Status</th><th>Time</th></tr></thead>
                  <tbody>
                    {cases.filter(c => !['Resolved', 'Closed'].includes(c.status)).map((c, i) => (
                      <tr key={c._id || i}>
                        <td><span className={`badge ${riskLevel(c.riskScore).badgeClass}`}>{c.riskScore > 80 ? 'Critical' : c.riskScore > 60 ? 'High' : c.riskScore > 30 ? 'Medium' : 'Low'}</span></td>
                        <td>{c.category}</td>
                        <td className="text-bold">{c.userId}</td>
                        <td style={{ color: riskLevel(c.riskScore).color, fontWeight: 600 }}>{c.riskScore}</td>
                        <td><StatusBadge status={c.status} /></td>
                        <td>{new Date(c.timestamp).toLocaleTimeString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>)}

          {tab === 'employee' && (<>
            <div className="judge-banner"><Info size={18} style={{ flexShrink: 0 }} /><div><strong>Employee Monitoring:</strong> Tracks insider activity — VIP access, bulk exports, excessive lookups, and off-hours access. All actions are logged and scored.</div></div>
            <div className="grid-2">
              <div className="ops-card">
                <div className="card-header">Employee Activity Log</div>
                <div className="card-body scroll-y" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {empLogs.map((l, i) => (
                    <div key={l._id || i} className="ops-list-item" style={{ borderLeft: `3px solid ${riskLevel(l.riskScore).color}` }}>
                      <div className="flex-between"><strong className="text-sm" style={{ color: '#e2e8f0' }}>{l.employeeName} ({l.employeeId})</strong><strong className="text-xs" style={{ color: riskLevel(l.riskScore).color }}>Risk {l.riskScore}</strong></div>
                      <p className="text-xs mt-8" style={{ color: '#94a3b8' }}>{l.action}</p>
                      <p className="text-xxs mt-8" style={{ color: '#64748b' }}>{l.branch} • {l.status} • {new Date(l.timestamp).toLocaleTimeString('en-IN')}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="ops-card">
                <div className="card-header">Log Employee Activity (Demo)</div>
                <div className="card-body">
                  <form onSubmit={submitEmployeeActivity} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div className="form-group"><label className="form-label" style={{ color: '#94a3b8' }}>Employee Name</label><input className="form-input" style={{ background: 'var(--navy-800)', borderColor: 'var(--navy-700)', color: '#e2e8f0' }} value={empName} onChange={e => setEmpName(e.target.value)} required /></div>
                    <div className="form-group"><label className="form-label" style={{ color: '#94a3b8' }}>Employee ID</label><input className="form-input" style={{ background: 'var(--navy-800)', borderColor: 'var(--navy-700)', color: '#e2e8f0' }} value={empId} onChange={e => setEmpId(e.target.value)} required /></div>
                    <div className="form-group">
                      <div className="flex-between"><label className="form-label" style={{ color: '#94a3b8' }}>Customer Lookups</label><strong className="text-xs text-orange">{empLookups}</strong></div>
                      <input type="range" min={1} max={60} value={empLookups} onChange={e => setEmpLookups(e.target.value)} style={{ width: '100%', accentColor: 'var(--orange-500)' }} />
                    </div>
                    <label className="form-checkbox" style={{ color: '#94a3b8' }}><input type="checkbox" checked={empVip} onChange={e => setEmpVip(e.target.checked)} /> Access VIP customer account</label>
                    <label className="form-checkbox" style={{ color: '#94a3b8' }}><input type="checkbox" checked={empBulk} onChange={e => setEmpBulk(e.target.checked)} /> Attempt bulk data export</label>
                    <button className="btn btn-primary" type="submit">Evaluate Activity</button>
                  </form>
                </div>
              </div>
            </div>
          </>)}

          {tab === 'cases' && (<>
            <div className="judge-banner"><Info size={18} style={{ flexShrink: 0 }} /><div><strong>Case Management:</strong> Every high-risk alert becomes a case. Investigators review evidence, approve actions, and close cases through a structured workflow.</div></div>
            <div className="grid-2-wide">
              <div className="scroll-y" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {cases.map((c, i) => (
                  <div key={c._id || i} className={`ops-list-item ${selCase?._id === c._id ? 'selected' : ''}`} onClick={() => setSelCase(c)}>
                    <div className="flex-between">
                      <div><div className="text-xxs" style={{ color: '#64748b' }}>CASE-{String(c._id || i).slice(-5).toUpperCase()}</div><strong className="text-sm" style={{ color: '#e2e8f0' }}>{c.category}</strong></div>
                      <StatusBadge status={c.status} />
                    </div>
                    <p className="text-xs mt-8" style={{ color: '#64748b' }}>{c.reason?.substring(0, 100)}...</p>
                  </div>
                ))}
              </div>
              <div>
                {selCase ? (
                  <div className="ops-card">
                    <div className="card-header flex-between">Case Review <StatusBadge status={selCase.status} /></div>
                    <div className="card-body">
                      {[
                        ['Category', selCase.category],
                        ['Subject', selCase.userId],
                        ['Risk Score', `${selCase.riskScore}/100`],
                        ['Location', selCase.details?.location || 'N/A'],
                        ['Device', selCase.details?.device || 'N/A']
                      ].map(([k, v]) => (
                        <div key={k} className="flex-between text-sm" style={{ padding: '8px 0', borderBottom: '1px solid var(--navy-800)' }}>
                          <span style={{ color: '#64748b' }}>{k}</span><strong style={{ color: '#e2e8f0' }}>{v}</strong>
                        </div>
                      ))}
                      <p className="text-xs mt-12" style={{ color: '#94a3b8', lineHeight: 1.6 }}>{selCase.reason}</p>
                      {!['Resolved', 'Closed'].includes(selCase.status) && (
                        <div className="flex-center gap-8 mt-16">
                          <button className="btn btn-success btn-sm" style={{ flex: 1 }} onClick={() => resolveCase(selCase._id, 'Resolved')}>Dismiss (False Positive)</button>
                          <button className="btn btn-danger btn-sm" style={{ flex: 1 }} onClick={() => resolveCase(selCase._id, 'Closed')}>Confirm & Block</button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="ops-card"><div className="card-body text-center" style={{ padding: 40, color: '#64748b' }}>Select a case to investigate</div></div>
                )}
              </div>
            </div>
          </>)}

          {tab === 'reports' && (<>
            <div className="judge-banner"><Info size={18} style={{ flexShrink: 0 }} /><div><strong>Compliance Reports:</strong> Aggregated metrics for executives — session volumes, case resolution, and alert severity distribution.</div></div>
            <div className="stats-row mb-16">
              {[
                { label: 'Total Sessions Evaluated', val: reports?.totalSessions ?? logs.length, cls: '' },
                { label: 'Open Cases', val: reports?.openCases ?? 0, cls: 'highlight-orange' },
                { label: 'Resolved Today', val: reports?.resolvedToday ?? 0, cls: 'highlight-green' },
                { label: 'Employee Alerts', val: reports?.employeeAlerts ?? 0, cls: 'highlight-red' }
              ].map(s => (
                <div key={s.label} className={`ops-stat ${s.cls}`}><div className="stat-value">{s.val}</div><div className="stat-label">{s.label}</div></div>
              ))}
            </div>
            <div className="grid-2">
              <div className="ops-card">
                <div className="card-header flex-center"><TrendingUp size={14} /> Alerts by Severity</div>
                <div className="card-body">
                  {reports?.alertsBySeverity && Object.entries({ Low: reports.alertsBySeverity.low, Medium: reports.alertsBySeverity.medium, High: reports.alertsBySeverity.high, Critical: reports.alertsBySeverity.critical }).map(([k, v]) => (
                    <div key={k} className="flex-between text-sm" style={{ padding: '10px 0', borderBottom: '1px solid var(--navy-800)' }}>
                      <span style={{ color: '#94a3b8' }}>{k}</span><strong style={{ color: '#e2e8f0' }}>{v}</strong>
                    </div>
                  ))}
                </div>
              </div>
              <div className="ops-card">
                <div className="card-header flex-center"><BarChart2 size={14} /> Cases by Category</div>
                <div className="card-body">
                  {reports?.casesByCategory && Object.entries(reports.casesByCategory).map(([k, v]) => (
                    <div key={k} className="flex-between text-sm" style={{ padding: '10px 0', borderBottom: '1px solid var(--navy-800)' }}>
                      <span style={{ color: '#94a3b8' }}>{k}</span><strong style={{ color: '#e2e8f0' }}>{v}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>)}

          {tab === 'settings' && (<>
            <div className="ops-card" style={{ maxWidth: 520 }}>
              <div className="card-header flex-center"><Lock size={14} /> Risk-Based Authentication Policy</div>
              <div className="card-body">
                {[
                  { range: '0 – 30', level: 'Trusted', action: 'Allow Access', color: 'var(--green-400)' },
                  { range: '31 – 60', level: 'Elevated', action: 'OTP Verification', color: 'var(--yellow-400)' },
                  { range: '61 – 80', level: 'High Risk', action: 'Face Verification', color: 'var(--orange-400)' },
                  { range: '81 – 100', level: 'Critical', action: 'Block and Escalate', color: 'var(--red-400)' }
                ].map(p => (
                  <div key={p.range} className="flex-between" style={{ padding: '14px 0', borderBottom: '1px solid var(--navy-800)' }}>
                    <div>
                      <div className="text-sm text-bold" style={{ color: p.color }}>{p.level}</div>
                      <div className="text-xxs" style={{ color: '#64748b' }}>Risk Score {p.range}</div>
                    </div>
                    <span className="badge badge-gray">{p.action}</span>
                  </div>
                ))}
                <p className="text-xs mt-16" style={{ color: '#64748b', lineHeight: 1.6 }}>
                  Verification is triggered only when risk increases. Trusted customers experience frictionless banking on every channel.
                </p>
              </div>
            </div>
          </>)}

        </div>
      </main>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = { New: 'badge-blue', Assigned: 'badge-yellow', Investigating: 'badge-yellow', Resolved: 'badge-green', Closed: 'badge-gray', Suspended: 'badge-red', Warning: 'badge-yellow', Active: 'badge-green' };
  return <span className={`badge ${map[status] || 'badge-gray'}`}>{status}</span>;
}
