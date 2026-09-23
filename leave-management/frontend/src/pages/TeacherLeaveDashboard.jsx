// TeacherLeaveDashboard.jsx — RELIABLE WORKFLOW & CLASSIC UI
import { useEffect, useState, useCallback } from 'react';
import API from '../api';

// ─── HELPERS ──────────────────────────────────────────────────────
const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';

const fmtD = d =>
  d
    ? new Date(d).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '—';

const nDays = (s, e) => {
  if (!s || !e) return 0;
  const t1 = new Date(s).getTime();
  const t2 = new Date(e).getTime();
  return Math.max(1, Math.round((t2 - t1) / 86400000) + 1);
};

const todayStr = () => new Date().toISOString().split('T')[0];

// ─── CANONICAL LEAVE TYPES ────────────────────────────────────────
const LEAVE_TYPES = [
  ['casual', 'Casual Leave'],
  ['sick', 'Sick Leave'],
  ['emergency', 'Emergency Leave'],
  ['paternity/maternity', 'Paternity / Maternity Leave'],
];

// ─── STATUS CONFIG ────────────────────────────────────────────────
const STATUS = {
  coverage_pending: {
    label: 'Coverage pending',
    bg: '#FEF3C7',
    color: '#92400E',
  },

  substitute_confirmed: {
    label: 'Coverage confirmed — fill details',
    bg: '#DBEAFE',
    color: '#1E40AF',
  },

  submitted: {
    label: 'Submitted — awaiting HOD',
    bg: '#EDE9FE',
    color: '#4C1D95',
  },

  hod_approved: {
    label: 'HOD approved — awaiting Principal',
    bg: '#E0E7FF',
    color: '#3730A3',
  },

  principal_approved: {
    label: 'Fully approved',
    bg: '#D1FAE5',
    color: '#065F46',
  },

  rejected: {
    label: 'Rejected',
    bg: '#FEE2E2',
    color: '#7F1D1D',
  },

  open: {
    label: 'Open — awaiting acceptance',
    bg: '#FEF3C7',
    color: '#92400E',
  },

  accepted: {
    label: 'Substitute accepted',
    bg: '#D1FAE5',
    color: '#065F46',
  },

  declined_all: {
    label: 'All declined',
    bg: '#FEE2E2',
    color: '#7F1D1D',
  },
};

// ─── MINI COMPONENTS ──────────────────────────────────────────────
const Badge = ({ s }) => {
  const st =
    STATUS[s] || {
      label: s ? s.replace(/_/g, ' ') : '—',
      bg: '#F3F4F6',
      color: '#374151',
    };

  return (
    <span
      style={{
        padding: '3px 10px',
        borderRadius: 99,
        fontSize: 11,
        fontWeight: 700,
        background: st.bg,
        color: st.color,
        whiteSpace: 'nowrap',
      }}
    >
      {st.label}
    </span>
  );
};

const Btn = ({
  children,
  onClick,
  variant = 'outline',
  disabled,
  full,
  small,
}) => {
  const map = {
    primary: {
      bg: '#4F46E5',
      color: '#fff',
      border: 'none',
    },

    green: {
      bg: '#D1FAE5',
      color: '#065F46',
      border: '1px solid #6EE7B7',
    },

    red: {
      bg: '#FEE2E2',
      color: '#7F1D1D',
      border: '1px solid #FCA5A5',
    },

    blue: {
      bg: '#DBEAFE',
      color: '#1E40AF',
      border: '1px solid #93C5FD',
    },

    outline: {
      bg: '#fff',
      color: '#374151',
      border: '1px solid #E5E7EB',
    },

    amber: {
      bg: '#FEF3C7',
      color: '#92400E',
      border: '1px solid #FCD34D',
    },
  };

  const v = map[variant] || map.outline;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: small
          ? '5px 12px'
          : variant === 'primary'
          ? '10px 18px'
          : '7px 14px',
        borderRadius: 8,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: small ? 12 : 13,
        fontWeight: 700,
        opacity: disabled ? 0.5 : 1,
        background: v.bg,
        color: v.color,
        border: v.border,
        width: full ? '100%' : 'auto',
        transition: 'opacity .15s',
      }}
    >
      {children}
    </button>
  );
};

const Card = ({ children, style }) => (
  <div
    style={{
      background: '#fff',
      border: '1px solid #E5E7EB',
      borderRadius: 12,
      padding: 20,
      ...style,
    }}
  >
    {children}
  </div>
);

const Empty = ({ text }) => (
  <p
    style={{
      textAlign: 'center',
      color: '#9CA3AF',
      fontSize: 13,
      padding: '28px 0',
      margin: 0,
    }}
  >
    {text}
  </p>
);

const inp = {
  width: '100%',
  padding: '9px 12px',
  borderRadius: 8,
  border: '1px solid #D1D5DB',
  background: '#F9FAFB',
  fontSize: 14,
  color: '#111',
  outline: 'none',
  boxSizing: 'border-box',
};

const Lbl = ({ text, hint }) => (
  <div style={{ marginBottom: 5 }}>
    <label
      style={{
        fontSize: 11,
        fontWeight: 700,
        color: '#6B7280',
        textTransform: 'uppercase',
        letterSpacing: '.05em',
      }}
    >
      {text}
    </label>

    {hint && (
      <span
        style={{
          fontSize: 11,
          color: '#9CA3AF',
          marginLeft: 6,
        }}
      >
        {hint}
      </span>
    )}
  </div>
);

const PRow = ({ p }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      background: '#F9FAFB',
      border: '1px solid #E5E7EB',
      borderRadius: 8,
      padding: '9px 12px',
      marginBottom: 6,
    }}
  >
    <div
      style={{
        width: 26,
        height: 26,
        borderRadius: '50%',
        background: '#EDE9FE',
        color: '#4C1D95',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 11,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {p.periodNumber}
    </div>

    <div
      style={{
        flex: 1,
        fontWeight: 600,
        fontSize: 13,
      }}
    >
      {p.subject}
    </div>

    <div
      style={{
        fontSize: 12,
        color: '#6B7280',
      }}
    >
      Class {p.className}
    </div>

    <div
      style={{
        fontSize: 12,
        color: '#6B7280',
        background: '#fff',
        border: '1px solid #E5E7EB',
        padding: '2px 8px',
        borderRadius: 6,
        whiteSpace: 'nowrap',
      }}
    >
      {p.startTime}–{p.endTime}
    </div>
  </div>
);

// ─── COVERAGE PROGRESS HELPER ─────────────────────────────────────
const getCoverage = leave => {
  const reqs = leave.substituteRequests || [];
  const required = reqs.length;

  const accepted = reqs.filter(
    r =>
      ['accepted', 'hod_approved', 'principal_approved'].includes(
        r.status
      ) && r.substituteTeacher
  ).length;

  const complete = required > 0 && accepted === required;

  return {
    required,
    accepted,
    complete,
    reqs,
  };
};

// ─── LOGIN PROMPT ─────────────────────────────────────────────────
function LoginPrompt({ onLogin }) {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function doLogin(qe, qp) {
    const e = qe || email;
    const p = qp || pw;

    if (!e || !p) {
      setErr('Enter email and password');
      return;
    }

    setBusy(true);
    setErr('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: e.trim().toLowerCase(),
          password: p,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErr(data.message || 'Login failed');
        setBusy(false);
        return;
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      onLogin(data.user);
    } catch {
      setErr('Cannot reach backend. Run: node server.js');
    } finally {
      setBusy(false);
    }
  }

  const ACCOUNTS = [
    ['ravi@school.com', '123456', 'Teacher / HOD'],
    ['priya@school.com', '123456', 'Teacher'],
    ['hod@school.com', '123456', 'HOD'],
    ['principal@school.com', '123456', 'Principal'],
  ];

  return (
    <div
      style={{
        maxWidth: 400,
        margin: '80px auto',
        fontFamily: '-apple-system,sans-serif',
      }}
    >
      <div
        style={{
          background: '#fff',
          border: '1px solid #E5E7EB',
          borderRadius: 16,
          padding: 32,
        }}
      >
        <h2
          style={{
            fontSize: 20,
            fontWeight: 800,
            margin: '0 0 6px',
          }}
        >
          Leave Management
        </h2>

        <p
          style={{
            fontSize: 13,
            color: '#6B7280',
            margin: '0 0 24px',
          }}
        >
          Sign in to continue
        </p>

        {err && (
          <div
            style={{
              background: '#FEE2E2',
              color: '#7F1D1D',
              border: '1px solid #FCA5A5',
              borderRadius: 8,
              padding: '10px 14px',
              fontSize: 13,
              marginBottom: 16,
            }}
          >
            {err}
          </div>
        )}

        <div style={{ marginBottom: 14 }}>
          <Lbl text="Email" />

          <input
            type="email"
            style={inp}
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e =>
              e.key === 'Enter' && doLogin()
            }
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <Lbl text="Password" />

          <input
            type="password"
            style={inp}
            value={pw}
            onChange={e => setPw(e.target.value)}
            onKeyDown={e =>
              e.key === 'Enter' && doLogin()
            }
          />
        </div>

        <Btn
          variant="primary"
          onClick={() => doLogin()}
          disabled={busy}
          full
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </Btn>

        <div
          style={{
            marginTop: 20,
            background: '#F9FAFB',
            border: '1px solid #E5E7EB',
            borderRadius: 8,
            padding: '12px 14px',
            fontSize: 12,
          }}
        >
          <div
            style={{
              fontWeight: 700,
              color: '#374151',
              marginBottom: 8,
            }}
          >
            Quick login:
          </div>

          {ACCOUNTS.map(([e, p, r]) => (
            <div
              key={e}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 6,
                cursor: 'pointer',
              }}
              onClick={() => doLogin(e, p)}
            >
              <span
                style={{
                  color: '#4F46E5',
                  fontWeight: 600,
                }}
              >
                {e}
              </span>

              <span
                style={{
                  background: '#EDE9FE',
                  color: '#4C1D95',
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 99,
                }}
              >
                {r}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════
export default function TeacherLeaveDashboard() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState('dashboard');

  const [balance, setBalance] = useState(null);
  const [leaves, setLeaves] = useState([]);
  const [tt, setTt] = useState([]);
  const [subs, setSubs] = useState([]);

  const [allL, setAllL] = useState([]);
  const [allS, setAllS] = useState([]);

  // ── Request substitute form state ──
  const [reqForm, setReqForm] = useState({
    startDate: todayStr(),
    endDate: todayStr(),
    leaveType: 'casual',
  });

  const [reqBusy, setReqBusy] = useState(false);
  const [reqResult, setReqResult] = useState(null);

  // ── Fill leave details form state ──
  const [fillLeave, setFillLeave] = useState(null);
  const [fillReason, setFillReason] = useState('');
  const [fillBusy, setFillBusy] = useState(false);

  const [busy, setBusy] = useState(null);

  const [msg, setMsg] = useState({
    text: '',
    type: 'ok',
  });

  const toast = useCallback((text, type = 'ok') => {
    setMsg({
      text,
      type,
    });

    setTimeout(() => {
      setMsg({
        text: '',
        type: 'ok',
      });
    }, 5000);
  }, []);

  // ────────────────────────────────────────────────────────────────
  // INITIAL LOGIN STATE
  // ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const stored = localStorage.getItem('user');
    const token = localStorage.getItem('token');

    if (stored && token) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        localStorage.clear();
      }
    }

    setReady(true);
  }, []);

  // ────────────────────────────────────────────────────────────────
  // LOAD TEACHER DATA
  // ONLY TEACHER ROLE SHOULD CALL THESE APIs
  // ────────────────────────────────────────────────────────────────
  const loadTeacher = useCallback(async () => {
    try {
      const [b, l, t, s] = await Promise.all([
        API.get('/leaves/balance'),
        API.get('/leaves/my'),
        API.get('/timetable/my'),
        API.get('/substitutes/my'),
      ]);

      setBalance(b.data);
      setLeaves(l.data);
      setTt(Array.isArray(t.data) ? t.data : []);
      setSubs(s.data);

      // Update stored teacher balance
      const storedUser = JSON.parse(
        localStorage.getItem('user') || '{}'
      );

      const updated = {
        ...storedUser,
        firstHalfUsed: b.data.firstHalfUsed,
        secondHalfUsed: b.data.secondHalfUsed,
        privilegedLeaves: b.data.privilegedLeaves,
      };

      localStorage.setItem(
        'user',
        JSON.stringify(updated)
      );
    } catch (e) {
      if (e.response?.status === 401) {
        localStorage.clear();
        setUser(null);
      } else {
        toast(
          e.response?.data?.message || e.message,
          'err'
        );
      }
    }
  }, [toast]);

  // ────────────────────────────────────────────────────────────────
  // LOAD HOD / PRINCIPAL DATA
  // Used by HOD View and the Principal Dashboard.
  // ────────────────────────────────────────────────────────────────
  const loadAdmin = useCallback(async () => {
    try {
      const [l, s] = await Promise.all([
        API.get('/leaves/all'),
        API.get('/substitutes/all'),
      ]);

      setAllL(l.data);
      setAllS(s.data);
    } catch (e) {
      toast(
        e.response?.data?.message || e.message,
        'err'
      );
    }
  }, [toast]);

  // ════════════════════════════════════════════════════════════════
  // IMPORTANT FIX:
  // TEACHER APIs are ONLY called for role === 'teacher'
  // HOD / PRINCIPAL APIs are ONLY called for admin roles
  // ════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!user) return;

    const role = user.role;

    // Teacher loads teacher-only APIs.
    if (role === 'teacher') {
      if (
        tab === 'dashboard' ||
        tab === 'substitutes' ||
        tab === 'request'
      ) {
        loadTeacher();
      }
      return;
    }

    // HOD loads admin data only on HOD View.
    if (role === 'hod') {
      if (tab === 'hod') {
        loadAdmin();
      }
      return;
    }

    // Principal has ONLY one tab: Dashboard.
    // Its dashboard is the principal approval dashboard.
    if (role === 'principal') {
      if (tab === 'dashboard') {
        loadAdmin();
      }
    }
  }, [user, tab, loadTeacher, loadAdmin]);

  // ────────────────────────────────────────────────────────────────
  // FIND READY LEAVE
  // ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const readyLeave = leaves.find(l => {
      const cov = getCoverage(l);

      return (
        l.status === 'substitute_confirmed' &&
        cov.complete
      );
    });

    if (readyLeave) {
      setFillLeave(readyLeave);
    } else {
      setFillLeave(null);
    }
  }, [leaves]);

  // ────────────────────────────────────────────────────────────────
  // LOGOUT
  // ────────────────────────────────────────────────────────────────
  function logout() {
    localStorage.clear();

    setUser(null);
    setBalance(null);
    setLeaves([]);
    setTt([]);
    setSubs([]);
    setAllL([]);
    setAllS([]);

    setTab('dashboard');
  }

  // ────────────────────────────────────────────────────────────────
  // SEND SUBSTITUTE REQUEST
  // ────────────────────────────────────────────────────────────────
  const sendSubRequest = async () => {
    if (!reqForm.startDate || !reqForm.endDate) {
      toast(
        'Please select start and end dates',
        'err'
      );
      return;
    }

    if (
      new Date(reqForm.endDate) <
      new Date(reqForm.startDate)
    ) {
      toast(
        'End date cannot be before start date',
        'err'
      );
      return;
    }

    setReqBusy(true);
    setReqResult(null);

    try {
      const res = await API.post(
        '/substitutes/request',
        {
          startDate: reqForm.startDate,
          endDate: reqForm.endDate,
          leaveType: reqForm.leaveType,
        }
      );

      setReqResult(res.data);

      toast(
        res.data.message ||
          'Coverage requested successfully.'
      );

      await loadTeacher();
    } catch (e) {
      toast(
        e.response?.data?.message ||
          'Failed to send request',
        'err'
      );
    } finally {
      setReqBusy(false);
    }
  };

  // ────────────────────────────────────────────────────────────────
  // ACCEPT SUBSTITUTE REQUEST
  // ────────────────────────────────────────────────────────────────
  const doAccept = async id => {
    setBusy(id);

    try {
      await API.patch(
        `/substitutes/${id}/accept`
      );

      toast(
        'Coverage accepted successfully.'
      );

      await loadTeacher();
    } catch (e) {
      toast(
        e.response?.data?.message ||
          e.message,
        'err'
      );
    } finally {
      setBusy(null);
    }
  };

  // ────────────────────────────────────────────────────────────────
  // DECLINE SUBSTITUTE REQUEST
  // ────────────────────────────────────────────────────────────────
  const doDecline = async id => {
    setBusy(id);

    try {
      await API.patch(
        `/substitutes/${id}/decline`
      );

      toast(
        'Coverage request declined. Other eligible teachers can still accept.'
      );

      await loadTeacher();
    } catch (e) {
      toast(
        e.response?.data?.message ||
          e.message,
        'err'
      );
    } finally {
      setBusy(null);
    }
  };

  // ────────────────────────────────────────────────────────────────
  // FILL LEAVE DETAILS
  // ────────────────────────────────────────────────────────────────
  const submitLeaveDetails = async () => {
    if (!fillReason.trim()) {
      toast(
        'Please enter a reason for your leave',
        'err'
      );
      return;
    }

    setFillBusy(true);

    try {
      await API.patch(
        `/leaves/${fillLeave._id}/details`,
        {
          reason: fillReason.trim(),
        }
      );

      toast(
        'Leave application submitted to HOD successfully!'
      );

      setFillReason('');

      await loadTeacher();
    } catch (e) {
      toast(
        e.response?.data?.message ||
          'Failed to submit leave',
        'err'
      );
    } finally {
      setFillBusy(false);
    }
  };

  // ────────────────────────────────────────────────────────────────
  // HOD APPROVE
  // ────────────────────────────────────────────────────────────────
  const hodApprL = async id => {
    setBusy(id);

    try {
      await API.patch(
        `/leaves/${id}/hod-approve`
      );

      toast(
        '✓ HOD approved. Forwarded to Principal.'
      );

      await loadAdmin();
    } catch (e) {
      toast(
        e.response?.data?.message ||
          e.message,
        'err'
      );
    } finally {
      setBusy(null);
    }
  };

  // ────────────────────────────────────────────────────────────────
  // HOD REJECT
  // ────────────────────────────────────────────────────────────────
  const hodRejectL = async id => {
    const reason = window.prompt(
      'Enter rejection reason:'
    );

    if (!reason || !reason.trim()) {
      toast(
        'Rejection reason is required',
        'err'
      );
      return;
    }

    setBusy(id);

    try {
      await API.patch(
        `/leaves/${id}/reject`,
        {
          reason: reason.trim(),
        }
      );

      toast(
        'Leave rejected by HOD.',
        'err'
      );

      await loadAdmin();
    } catch (e) {
      toast(
        e.response?.data?.message ||
          e.message,
        'err'
      );
    } finally {
      setBusy(null);
    }
  };

  // ────────────────────────────────────────────────────────────────
  // PRINCIPAL APPROVE
  // ────────────────────────────────────────────────────────────────
  const prApprL = async id => {
    setBusy(id);

    try {
      await API.patch(
        `/leaves/${id}/principal-approve`
      );

      toast(
        '✓ Fully approved! Balance updated.'
      );

      await loadAdmin();

      // Only load teacher data if the logged-in user is actually a teacher
      if (user?.role === 'teacher') {
        await loadTeacher();
      }
    } catch (e) {
      toast(
        e.response?.data?.message ||
          e.message,
        'err'
      );
    } finally {
      setBusy(null);
    }
  };

  // ────────────────────────────────────────────────────────────────
  // PRINCIPAL REJECT
  // ────────────────────────────────────────────────────────────────
  const prRejectL = async id => {
    const reason = window.prompt(
      'Enter rejection reason:'
    );

    if (!reason || !reason.trim()) {
      toast(
        'Rejection reason is required',
        'err'
      );
      return;
    }

    setBusy(id);

    try {
      await API.patch(
        `/leaves/${id}/reject`,
        {
          reason: reason.trim(),
        }
      );

      toast(
        'Leave rejected by Principal.',
        'err'
      );

      await loadAdmin();
    } catch (e) {
      toast(
        e.response?.data?.message ||
          e.message,
        'err'
      );
    } finally {
      setBusy(null);
    }
  };

  const rowS = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    padding: '12px 0',
    borderBottom: '1px solid #F3F4F6',
    flexWrap: 'wrap',
  };

  if (!ready) return null;

  if (!user) {
    return (
      <LoginPrompt
        onLogin={u => setUser(u)}
      />
    );
  }

  // ────────────────────────────────────────────────────────────────
  // FILL DETAILS BANNER
  // ────────────────────────────────────────────────────────────────
  const FillDetailsBanner = fillLeave && (
    <div
      style={{
        background: '#EDE9FE',
        border: '2px solid #4F46E5',
        borderRadius: 12,
        padding: '16px 20px',
        marginBottom: 20,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 4,
        }}
      >
        <div
          style={{
            fontWeight: 800,
            fontSize: 16,
            color: '#4C1D95',
          }}
        >
          Action needed: Complete your leave application
        </div>

        <span
          style={{
            background: '#D1FAE5',
            color: '#065F46',
            padding: '3px 10px',
            borderRadius: 99,
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          ✓ All classes covered (
          {getCoverage(fillLeave).accepted}/
          {getCoverage(fillLeave).required})
        </span>
      </div>

      <div
        style={{
          fontSize: 13,
          color: '#4B5563',
          marginBottom: 14,
        }}
      >
        All required periods have confirmed substitute
        coverage. Add your leave reason to submit to HOD.
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            '1fr 1fr 1fr',
          gap: 10,
          marginBottom: 12,
        }}
      >
        <div>
          <Lbl text="Start date (locked)" />

          <input
            type="date"
            style={{
              ...inp,
              background: '#E5E7EB',
              cursor: 'not-allowed',
            }}
            value={
              fillLeave.startDate
                ? fillLeave.startDate.split('T')[0]
                : ''
            }
            readOnly
          />
        </div>

        <div>
          <Lbl text="End date (locked)" />

          <input
            type="date"
            style={{
              ...inp,
              background: '#E5E7EB',
              cursor: 'not-allowed',
            }}
            value={
              fillLeave.endDate
                ? fillLeave.endDate.split('T')[0]
                : ''
            }
            readOnly
          />
        </div>

        <div>
          <Lbl text="Leave type (locked)" />

          <select
            style={{
              ...inp,
              background: '#E5E7EB',
              cursor: 'not-allowed',
            }}
            value={fillLeave.leaveType}
            disabled
          >
            {LEAVE_TYPES.map(
              ([val, label]) => (
                <option
                  key={val}
                  value={val}
                >
                  {label}
                </option>
              )
            )}
          </select>
        </div>
      </div>

      <div
        style={{
          background: '#fff',
          borderRadius: 8,
          padding: '10px 14px',
          marginBottom: 12,
          fontSize: 12,
          color: '#374151',
          border: '1px solid #C4B5FD',
        }}
      >
        <div
          style={{
            fontWeight: 700,
            color: '#4C1D95',
            marginBottom: 6,
          }}
        >
          <b>
            {nDays(
              fillLeave.startDate,
              fillLeave.endDate
            )}{' '}
            day(s)
          </b>{' '}
          · {fmtD(fillLeave.startDate)} →{' '}
          {fmtD(fillLeave.endDate)}
        </div>

        {(fillLeave.substituteRequests || []).map(
          (sr, idx) => (
            <div
              key={sr._id || idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginTop: idx > 0 ? 4 : 0,
                fontSize: 12,
                color: '#374151',
              }}
            >
              <span
                style={{
                  color: '#059669',
                  fontWeight: 700,
                }}
              >
                ✓ Period {sr.periodNumber}
              </span>

              <span>
                · {sr.subject} ({sr.className})
              </span>

              <span>
                · {sr.startTime}–{sr.endTime}
              </span>

              <span
                style={{
                  color: '#4F46E5',
                  fontWeight: 600,
                }}
              >
                Covered by:{' '}
                {sr.substituteTeacher?.name ||
                  'Substitute'}
              </span>
            </div>
          )
        )}
      </div>

      <div style={{ marginBottom: 12 }}>
        <Lbl text="Reason *" />

        <textarea
          rows={2}
          style={{
            ...inp,
            resize: 'vertical',
          }}
          placeholder="Brief reason for your leave…"
          value={fillReason}
          onChange={e =>
            setFillReason(e.target.value)
          }
        />
      </div>

      <Btn
        variant="primary"
        onClick={submitLeaveDetails}
        disabled={
          fillBusy ||
          !fillReason.trim()
        }
        full
      >
        {fillBusy
          ? 'Submitting…'
          : '✓ Complete & submit leave application → HOD'}
      </Btn>
    </div>
  );

  // ────────────────────────────────────────────────────────────────
  // BALANCE CARDS
  // ────────────────────────────────────────────────────────────────
  const BalanceCards = balance && (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns:
          'repeat(4,1fr)',
        gap: 12,
        marginBottom: 20,
      }}
    >
      {[
        {
          lbl: 'Jan – Jun',
          val:
            balance.firstHalfTotal -
            balance.firstHalfUsed,
          sub: `${balance.firstHalfUsed} used of ${balance.firstHalfTotal}`,
          c: '#4F46E5',
          bg: '#EDE9FE',
        },

        {
          lbl: 'Jul – Dec',
          val:
            balance.secondHalfTotal -
            balance.secondHalfUsed,
          sub: `${balance.secondHalfUsed} used of ${balance.secondHalfTotal}`,
          c: '#059669',
          bg: '#D1FAE5',
        },

        {
          lbl: 'Total remaining',
          val:
            balance.firstHalfTotal -
            balance.firstHalfUsed +
            (balance.secondHalfTotal -
              balance.secondHalfUsed),
          sub: 'of 15 this year',
          c: '#2563EB',
          bg: '#DBEAFE',
        },

        {
          lbl: 'Privileged Leaves',
          val: balance.privilegedLeaves || 0,
          sub: 'Carried over from last year',
          c: '#B45309',
          bg: '#FEF3C7',
          tooltip:
            'These are unused leaves from last year that carry forward.',
        },
      ].map((m, i) => (
        <div
          key={i}
          style={{
            background: m.bg,
            borderRadius: 10,
            padding: '14px 16px',
            borderLeft: `4px solid ${m.c}`,
            position: 'relative',
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: m.c,
              textTransform: 'uppercase',
              letterSpacing: '.05em',
              marginBottom: 6,
              fontWeight: 700,
            }}
          >
            {m.lbl}
          </div>

          <div
            style={{
              fontSize: 30,
              fontWeight: 800,
              color: '#111',
            }}
          >
            {m.val}
          </div>

          <div
            style={{
              fontSize: 11,
              color: '#6B7280',
              marginTop: 3,
            }}
          >
            {m.sub}
          </div>

          {m.tooltip && (
            <div
              style={{
                fontSize: 10,
                color: m.c,
                marginTop: 4,
                fontStyle: 'italic',
              }}
            >
              ℹ {m.tooltip}
            </div>
          )}
        </div>
      ))}
    </div>
  );

  // ════════════════════════════════════════════════════════════════
  // RETURN
  // ════════════════════════════════════════════════════════════════
  return (
    <div
      style={{
        maxWidth: 980,
        margin: '0 auto',
        padding: '24px 16px',
        fontFamily:
          '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
        color: '#111',
      }}
    >
      {/* Toast */}
      {msg.text && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 10,
            marginBottom: 16,
            fontSize: 13,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background:
              msg.type === 'err'
                ? '#FEE2E2'
                : '#D1FAE5',
            color:
              msg.type === 'err'
                ? '#7F1D1D'
                : '#065F46',
            border: `1px solid ${
              msg.type === 'err'
                ? '#FCA5A5'
                : '#6EE7B7'
            }`,
          }}
        >
          <span style={{ fontSize: 16 }}>
            {msg.type === 'err' ? '✕' : '✓'}
          </span>

          {msg.text}
        </div>
      )}

      {/* HEADER */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 22,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 800,
              margin: 0,
            }}
          >
            Leave Management
          </h1>

          <p
            style={{
              fontSize: 13,
              color: '#6B7280',
              margin: '3px 0 0',
            }}
          >
            {user.name}&nbsp;·&nbsp;

            <span
              style={{
                textTransform: 'capitalize',
                color: '#4F46E5',
                fontWeight: 600,
              }}
            >
              {user.role}
            </span>
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          {balance && (
            <div
              style={{
                background: '#EDE9FE',
                borderRadius: 10,
                padding: '10px 18px',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 800,
                  color: '#4C1D95',
                }}
              >
                {balance.firstHalfTotal -
                  balance.firstHalfUsed +
                  (balance.secondHalfTotal -
                    balance.secondHalfUsed)}
              </div>

              <div
                style={{
                  fontSize: 10,
                  color: '#7C3AED',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                }}
              >
                Leaves left
              </div>
            </div>
          )}

          <button
            onClick={logout}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: '1px solid #E5E7EB',
              background: '#fff',
              color: '#374151',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Log out
          </button>
        </div>
      </div>

      {/* TABS */}
      <div
        style={{
          display: 'flex',
          gap: 3,
          background: '#F3F4F6',
          borderRadius: 10,
          padding: 4,
          marginBottom: 24,
          width: 'fit-content',
          flexWrap: 'wrap',
        }}
      >
        {(user?.role === 'principal'
          ? [
              ['dashboard', 'Dashboard'],
            ]
          : user?.role === 'hod'
          ? [
              ['dashboard', 'Dashboard'],
              ['request', 'Request Substitute'],
              [
                'substitutes',
                `Substitutes${
                  subs.length
                    ? ` (${subs.length})`
                    : ''
                }`,
              ],
              ['hod', 'HOD View'],
            ]
          : [
              ['dashboard', 'Dashboard'],
              ['request', 'Request Substitute'],
              [
                'substitutes',
                `Substitutes${
                  subs.length
                    ? ` (${subs.length})`
                    : ''
                }`,
              ],
            ]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              padding: '9px 18px',
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              transition: 'all .15s',
              background:
                tab === key
                  ? '#fff'
                  : 'transparent',
              color:
                tab === key
                  ? '#4F46E5'
                  : '#6B7280',
              boxShadow:
                tab === key
                  ? '0 1px 4px rgba(0,0,0,.1)'
                  : 'none',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════
          PRINCIPAL DASHBOARD
          Principal sees ONLY this dashboard.
          It contains pending HOD-approved leaves and leaves
          that have already received final Principal approval.
          ══════════════════════════════════════════════════════════ */}
      {user.role === 'principal' && tab === 'dashboard' && (
        <Card>
          <h3
            style={{
              fontSize: 15,
              fontWeight: 700,
              marginBottom: 6,
            }}
          >
            Principal Dashboard
          </h3>

          <p
            style={{
              fontSize: 13,
              color: '#6B7280',
              marginBottom: 20,
              marginTop: 0,
            }}
          >
            Review HOD-approved leaves and track leaves that have
            already received final approval.
          </p>

          {/* PENDING PRINCIPAL APPROVAL */}
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              marginBottom: 10,
              color: '#111827',
            }}
          >
            HOD-approved leaves — awaiting final approval
          </div>

          {allL.filter(
            l => l.status === 'hod_approved'
          ).length === 0 ? (
            <div
              style={{
                background: '#F9FAFB',
                border: '1px solid #E5E7EB',
                borderRadius: 10,
                padding: '14px 16px',
                marginBottom: 22,
                fontSize: 13,
                color: '#6B7280',
              }}
            >
              No leaves are awaiting final approval.
            </div>
          ) : (
            <div style={{ marginBottom: 22 }}>
              {allL
                .filter(l => l.status === 'hod_approved')
                .map(l => {
                  const cov = getCoverage(l);

                  return (
                    <div
                      key={l._id}
                      style={{
                        background: '#F9FAFB',
                        border: '1px solid #E5E7EB',
                        borderRadius: 10,
                        padding: '14px 16px',
                        marginBottom: 12,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 12,
                          marginBottom: 12,
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              fontWeight: 700,
                              fontSize: 15,
                            }}
                          >
                            {l.teacher?.name} — {cap(l.leaveType)} leave
                          </div>

                          <div
                            style={{
                              fontSize: 12,
                              color: '#6B7280',
                              marginTop: 2,
                            }}
                          >
                            {fmtD(l.startDate)} → {fmtD(l.endDate)} ·{' '}
                            {nDays(l.startDate, l.endDate)} day(s)
                          </div>

                          <div
                            style={{
                              fontSize: 13,
                              color: '#111',
                              marginTop: 4,
                            }}
                          >
                            <b>Reason:</b> {l.reason || '—'}
                          </div>

                          <div
                            style={{
                              background: '#D1FAE5',
                              border: '1px solid #6EE7B7',
                              borderRadius: 8,
                              padding: '8px 12px',
                              marginTop: 8,
                            }}
                          >
                            <div
                              style={{
                                fontSize: 12,
                                color: '#065F46',
                                fontWeight: 700,
                                marginBottom: 4,
                              }}
                            >
                              ✓ Substitute coverage ({cov.accepted}/{cov.required} confirmed)
                            </div>

                            {cov.reqs.map((sr, i) => (
                              <div
                                key={sr._id || i}
                                style={{
                                  fontSize: 11,
                                  color: '#374151',
                                  marginTop: i > 0 ? 3 : 0,
                                }}
                              >
                                Period {sr.periodNumber} · {sr.subject} (Class {sr.className}) ·{' '}
                                {sr.startTime}–{sr.endTime} · Covered by:{' '}
                                <b>
                                  {sr.substituteTeacher?.name || 'Substitute'}
                                </b>
                              </div>
                            ))}
                          </div>

                          <div
                            style={{
                              fontSize: 11,
                              color: '#4F46E5',
                              fontWeight: 700,
                              marginTop: 6,
                            }}
                          >
                            ✓ HOD approved — awaiting Principal
                          </div>
                        </div>

                        <Badge s={l.status} />
                      </div>

                      <div style={{ display: 'flex', gap: 6 }}>
                        <Btn
                          variant="green"
                          onClick={() => prApprL(l._id)}
                          disabled={busy === l._id}
                        >
                          Final approve & deduct balance
                        </Btn>

                        <Btn
                          variant="red"
                          onClick={() => prRejectL(l._id)}
                          disabled={busy === l._id}
                        >
                          Reject
                        </Btn>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}

          {/* ALREADY APPROVED */}
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              marginBottom: 10,
              color: '#111827',
            }}
          >
            Approved leaves
          </div>

          {allL.filter(
            l => l.status === 'principal_approved'
          ).length === 0 ? (
            <div
              style={{
                background: '#F9FAFB',
                border: '1px solid #E5E7EB',
                borderRadius: 10,
                padding: '14px 16px',
                fontSize: 13,
                color: '#6B7280',
              }}
            >
              No leaves have been finally approved yet.
            </div>
          ) : (
            allL
              .filter(l => l.status === 'principal_approved')
              .map(l => {
                const cov = getCoverage(l);

                return (
                  <div
                    key={l._id}
                    style={{
                      background: '#F0FDF4',
                      border: '1px solid #BBF7D0',
                      borderRadius: 10,
                      padding: '14px 16px',
                      marginBottom: 12,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 12,
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: 15,
                          }}
                        >
                          {l.teacher?.name} — {cap(l.leaveType)} leave
                        </div>

                        <div
                          style={{
                            fontSize: 12,
                            color: '#6B7280',
                            marginTop: 2,
                          }}
                        >
                          {fmtD(l.startDate)} → {fmtD(l.endDate)} ·{' '}
                          {nDays(l.startDate, l.endDate)} day(s)
                        </div>

                        <div
                          style={{
                            fontSize: 13,
                            color: '#111',
                            marginTop: 4,
                          }}
                        >
                          <b>Reason:</b> {l.reason || '—'}
                        </div>

                        <div
                          style={{
                            background: '#D1FAE5',
                            border: '1px solid #A7F3D0',
                            borderRadius: 8,
                            padding: '8px 12px',
                            marginTop: 8,
                          }}
                        >
                          <div
                            style={{
                              fontSize: 12,
                              color: '#065F46',
                              fontWeight: 700,
                              marginBottom: 4,
                            }}
                          >
                            ✓ Fully approved
                          </div>

                          <div
                            style={{
                              fontSize: 11,
                              color: '#374151',
                            }}
                          >
                            Substitute coverage: {cov.accepted}/{cov.required} confirmed
                          </div>

                          {cov.reqs.map((sr, i) => (
                            <div
                              key={sr._id || i}
                              style={{
                                fontSize: 11,
                                color: '#374151',
                                marginTop: i > 0 ? 3 : 3,
                              }}
                            >
                              Period {sr.periodNumber} · {sr.subject} (Class {sr.className}) ·{' '}
                              {sr.startTime}–{sr.endTime} · Covered by:{' '}
                              <b>
                                {sr.substituteTeacher?.name || 'Substitute'}
                              </b>
                            </div>
                          ))}
                        </div>

                        <div
                          style={{
                            fontSize: 11,
                            color: '#059669',
                            fontWeight: 700,
                            marginTop: 6,
                          }}
                        >
                          ✓ Principal approved — leave balance deducted
                        </div>
                      </div>

                      <Badge s={l.status} />
                    </div>
                  </div>
                );
              })
          )}
        </Card>
      )}

      {/* ══════════════════════════════════════════════════════════
          TEACHER DASHBOARD
          ══════════════════════════════════════════════════════════ */}
      {user.role !== 'principal' && tab === 'dashboard' && (
        <>
          {FillDetailsBanner}

          {BalanceCards}

          {!balance && user.role === 'teacher' && (
            <div
              style={{
                background: '#FEF3C7',
                border: '1px solid #FDE68A',
                borderRadius: 10,
                padding: '14px 18px',
                marginBottom: 20,
                fontSize: 13,
                color: '#78350F',
                fontWeight: 500,
              }}
            >
              Loading balance… (make sure backend is running
              on port 5000)
            </div>
          )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                '1.2fr 0.8fr',
              gap: 16,
            }}
          >
            {/* Leave history */}
            <Card>
              <h3
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  marginBottom: 16,
                }}
              >
                Leave history & coverage
              </h3>

              {leaves.length === 0 ? (
                <Empty
                  text="No leaves yet. Go to 'Request Substitute' to start."
                />
              ) : (
                leaves.map(l => {
                  const cov =
                    getCoverage(l);

                  return (
                    <div
                      key={l._id}
                      style={{
                        ...rowS,
                        flexDirection:
                          'column',
                        alignItems:
                          'stretch',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent:
                            'space-between',
                          alignItems:
                            'flex-start',
                        }}
                      >
                        <div
                          style={{
                            flex: 1,
                          }}
                        >
                          <div
                            style={{
                              fontWeight: 700,
                              fontSize: 14,
                            }}
                          >
                            {cap(l.leaveType)} leave

                            <span
                              style={{
                                fontWeight: 400,
                                color:
                                  '#6B7280',
                                fontSize: 12,
                                marginLeft: 6,
                              }}
                            >
                              (
                              {nDays(
                                l.startDate,
                                l.endDate
                              )}{' '}
                              day
                              {nDays(
                                l.startDate,
                                l.endDate
                              ) > 1
                                ? 's'
                                : ''}
                              )
                            </span>
                          </div>

                          <div
                            style={{
                              fontSize: 12,
                              color:
                                '#6B7280',
                              marginTop: 2,
                            }}
                          >
                            {fmtD(
                              l.startDate
                            )}{' '}
                            →{' '}
                            {fmtD(
                              l.endDate
                            )}
                          </div>

                          {l.reason && (
                            <div
                              style={{
                                fontSize: 13,
                                color:
                                  '#374151',
                                marginTop: 4,
                              }}
                            >
                              <b>
                                Reason:
                              </b>{' '}
                              {l.reason}
                            </div>
                          )}
                        </div>

                        <Badge
                          s={l.status}
                        />
                      </div>

                      <div
                        style={{
                          background:
                            cov.complete
                              ? '#F0FDF4'
                              : '#FFFBEB',
                          border: `1px solid ${
                            cov.complete
                              ? '#BBF7D0'
                              : '#FDE68A'
                          }`,
                          borderRadius: 8,
                          padding:
                            '10px 14px',
                          marginTop: 8,
                          fontSize: 12,
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent:
                              'space-between',
                            alignItems:
                              'center',
                            fontWeight: 700,
                            color:
                              cov.complete
                                ? '#166534'
                                : '#92400E',
                            marginBottom: 6,
                          }}
                        >
                          <span>
                            Substitute
                            Coverage:{' '}
                            {cov.accepted}{' '}
                            /{' '}
                            {cov.required}{' '}
                            confirmed
                          </span>

                          {cov.complete && (
                            <span>
                              ✓ All classes are covered
                            </span>
                          )}
                        </div>

                        {cov.reqs.map(
                          (sr, i) => {
                            const isConfirmed =
                              [
                                'accepted',
                                'hod_approved',
                                'principal_approved',
                              ].includes(
                                sr.status
                              ) &&
                              sr.substituteTeacher;

                            return (
                              <div
                                key={
                                  sr._id ||
                                  i
                                }
                                style={{
                                  display:
                                    'flex',
                                  alignItems:
                                    'center',
                                  justifyContent:
                                    'space-between',
                                  background:
                                    '#fff',
                                  border: `1px solid ${
                                    isConfirmed
                                      ? '#A7F3D0'
                                      : '#FCD34D'
                                  }`,
                                  borderRadius:
                                    6,
                                  padding:
                                    '6px 10px',
                                  marginTop:
                                    i > 0
                                      ? 4
                                      : 0,
                                }}
                              >
                                <div
                                  style={{
                                    display:
                                      'flex',
                                    alignItems:
                                      'center',
                                    gap: 8,
                                  }}
                                >
                                  <div
                                    style={{
                                      width: 20,
                                      height: 20,
                                      borderRadius:
                                        '50%',
                                      background:
                                        isConfirmed
                                          ? '#D1FAE5'
                                          : '#FEF3C7',
                                      color:
                                        isConfirmed
                                          ? '#065F46'
                                          : '#92400E',
                                      display:
                                        'flex',
                                      alignItems:
                                        'center',
                                      justifyContent:
                                        'center',
                                      fontSize: 10,
                                      fontWeight: 700,
                                      flexShrink: 0,
                                    }}
                                  >
                                    {
                                      sr.periodNumber
                                    }
                                  </div>

                                  <span
                                    style={{
                                      fontWeight: 600,
                                    }}
                                  >
                                    {fmtD(
                                      sr.date
                                    )}{' '}
                                    · Period{' '}
                                    {
                                      sr.periodNumber
                                    }{' '}
                                    ·{' '}
                                    {
                                      sr.subject
                                    }{' '}
                                    (
                                    {
                                      sr.className
                                    }
                                    )
                                  </span>
                                </div>

                                <div
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 600,
                                    color:
                                      isConfirmed
                                        ? '#059669'
                                        : '#B45309',
                                  }}
                                >
                                  {isConfirmed
                                    ? `✓ ${
                                        sr
                                          .substituteTeacher
                                          ?.name ||
                                        'Accepted'
                                      }`
                                    : '⏳ Pending'}
                                </div>
                              </div>
                            );
                          }
                        )}

                        {l.status ===
                          'coverage_pending' && (
                          <div
                            style={{
                              fontSize: 11,
                              color: '#92400E',
                              marginTop: 6,
                              fontStyle:
                                'italic',
                            }}
                          >
                            Waiting for{' '}
                            {cov.required -
                              cov.accepted}{' '}
                            period(s). The leave
                            application form unlocks
                            once every period is covered.
                          </div>
                        )}

                        {l.status ===
                          'substitute_confirmed' &&
                          !l.reason && (
                            <div
                              style={{
                                background:
                                  '#EDE9FE',
                                borderRadius: 6,
                                padding:
                                  '6px 10px',
                                marginTop: 6,
                                fontSize: 12,
                                color:
                                  '#4C1D95',
                                fontWeight: 600,
                              }}
                            >
                              ⬆ All covered! Fill
                              your reason in the
                              banner above and submit
                              to HOD.
                            </div>
                          )}
                      </div>

                      {l.status ===
                        'rejected' &&
                        l.rejectionReason && (
                          <div
                            style={{
                              background:
                                '#FEE2E2',
                              border:
                                '1px solid #FCA5A5',
                              borderRadius: 8,
                              padding:
                                '8px 12px',
                              marginTop: 6,
                              fontSize: 12,
                              color:
                                '#7F1D1D',
                            }}
                          >
                            <b>
                              Rejection reason:
                            </b>{' '}
                            {
                              l.rejectionReason
                            }
                          </div>
                        )}
                    </div>
                  );
                })
              )}
            </Card>

            {/* My timetable */}
            <Card>
              <h3
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  marginBottom: 16,
                }}
              >
                My timetable
              </h3>

              {tt.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '20px 0',
                    color: '#9CA3AF',
                  }}
                >
                  <div
                    style={{
                      fontSize: 32,
                      marginBottom: 8,
                    }}
                  >
                    📅
                  </div>

                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    No timetable yet
                  </div>

                  <div
                    style={{
                      fontSize: 12,
                      marginTop: 4,
                    }}
                  >
                    Run{' '}
                    <code
                      style={{
                        background:
                          '#F3F4F6',
                        padding: '2px 6px',
                        borderRadius: 4,
                      }}
                    >
                      node seed.js
                    </code>
                  </div>
                </div>
              ) : (
                tt.map(day => (
                  <div
                    key={day.dayOfWeek}
                    style={{
                      marginBottom: 14,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: '#4F46E5',
                        textTransform:
                          'uppercase',
                        letterSpacing:
                          '.07em',
                        marginBottom: 6,
                      }}
                    >
                      {day.dayOfWeek}
                    </div>

                    {day.periods.map(
                      (p, i) => (
                        <PRow
                          key={i}
                          p={p}
                        />
                      )
                    )}
                  </div>
                ))
              )}
            </Card>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════
          REQUEST SUBSTITUTE
          ══════════════════════════════════════════════════════════ */}
      {tab === 'request' && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              '1fr 1fr',
            gap: 20,
            alignItems: 'start',
          }}
        >
          <Card>
            <h3
              style={{
                fontSize: 15,
                fontWeight: 700,
                marginBottom: 4,
              }}
            >
              Request a substitute
            </h3>

            <p
              style={{
                fontSize: 13,
                color: '#6B7280',
                marginBottom: 20,
                marginTop: 0,
              }}
            >
              Select your leave dates and leave type.
              The system automatically inspects your
              timetable and creates coverage requests
              for <b>every period you teach</b> across
              the entire date range.
            </p>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  '1fr 1fr',
                gap: 10,
                marginBottom: 14,
              }}
            >
              <div>
                <Lbl text="Start date *" />

                <input
                  type="date"
                  style={inp}
                  value={
                    reqForm.startDate
                  }
                  onChange={e =>
                    setReqForm({
                      ...reqForm,
                      startDate:
                        e.target.value,
                    })
                  }
                />
              </div>

              <div>
                <Lbl text="End date *" />

                <input
                  type="date"
                  style={inp}
                  value={
                    reqForm.endDate
                  }
                  min={
                    reqForm.startDate ||
                    todayStr()
                  }
                  onChange={e =>
                    setReqForm({
                      ...reqForm,
                      endDate:
                        e.target.value,
                    })
                  }
                />
              </div>
            </div>

            <div
              style={{
                marginBottom: 14,
              }}
            >
              <Lbl text="Leave type *" />

              <select
                style={inp}
                value={
                  reqForm.leaveType
                }
                onChange={e =>
                  setReqForm({
                    ...reqForm,
                    leaveType:
                      e.target.value,
                  })
                }
              >
                {LEAVE_TYPES.map(
                  ([val, label]) => (
                    <option
                      key={val}
                      value={val}
                    >
                      {label}
                    </option>
                  )
                )}
              </select>
            </div>

            {reqForm.startDate &&
              reqForm.endDate && (
                <div
                  style={{
                    background:
                      '#EDE9FE',
                    border:
                      '1px solid #C4B5FD',
                    borderRadius: 10,
                    padding:
                      '12px 16px',
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      fontWeight: 700,
                      color: '#4C1D95',
                      fontSize: 13,
                      marginBottom: 6,
                    }}
                  >
                    Request summary
                  </div>

                  <div
                    style={{
                      fontSize: 13,
                      color: '#374151',
                    }}
                  >
                    <b>
                      {nDays(
                        reqForm.startDate,
                        reqForm.endDate
                      )}{' '}
                      day(s)
                    </b>{' '}
                    ·{' '}
                    {fmtD(
                      reqForm.startDate
                    )}{' '}
                    →{' '}
                    {fmtD(
                      reqForm.endDate
                    )}
                  </div>

                  <div
                    style={{
                      fontSize: 12,
                      color: '#7C3AED',
                      marginTop: 6,
                      fontWeight: 600,
                    }}
                  >
                    → Substitute requests will
                    be sent to free eligible
                    teachers for all scheduled
                    periods.
                  </div>
                </div>
              )}

            {reqForm.startDate &&
              reqForm.endDate &&
              tt.length > 0 &&
              (() => {
                const daysList = [];

                const cur =
                  new Date(
                    reqForm.startDate +
                      'T12:00:00Z'
                  );

                const end =
                  new Date(
                    reqForm.endDate +
                      'T12:00:00Z'
                  );

                while (cur <= end) {
                  const dayName =
                    cur.toLocaleDateString(
                      'en-US',
                      {
                        weekday:
                          'long',
                        timeZone:
                          'UTC',
                      }
                    );

                  const dayData =
                    tt.find(
                      d =>
                        d.dayOfWeek ===
                        dayName
                    );

                  daysList.push({
                    date: new Date(cur),
                    dayName,
                    periods:
                      dayData?.periods ||
                      [],
                  });

                  cur.setDate(
                    cur.getDate() + 1
                  );
                }

                const withClasses =
                  daysList.filter(
                    d =>
                      d.periods
                        .length > 0
                  );

                const freeDays =
                  daysList.filter(
                    d =>
                      d.periods
                        .length === 0
                  );

                if (
                  !withClasses.length
                ) {
                  return null;
                }

                return (
                  <div
                    style={{
                      marginBottom: 16,
                    }}
                  >
                    <Lbl text="Scheduled periods needing coverage" />

                    {withClasses.map(
                      (d, i) => (
                        <div
                          key={i}
                          style={{
                            marginBottom: 10,
                          }}
                        >
                          <div
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color:
                                '#4F46E5',
                              textTransform:
                                'uppercase',
                              letterSpacing:
                                '.06em',
                              marginBottom: 4,
                            }}
                          >
                            {d.dayName} ·{' '}
                            {d.date.toLocaleDateString(
                              'en-IN',
                              {
                                day: '2-digit',
                                month: 'short',
                                timeZone:
                                  'UTC',
                              }
                            )}
                          </div>

                          {d.periods.map(
                            (p, j) => (
                              <PRow
                                key={j}
                                p={p}
                              />
                            )
                          )}
                        </div>
                      )
                    )}

                    {freeDays.length >
                      0 && (
                      <div
                        style={{
                          fontSize: 12,
                          color:
                            '#9CA3AF',
                          marginTop: 4,
                        }}
                      >
                        {freeDays
                          .map(
                            d =>
                              d.dayName
                          )
                          .join(', ')}{' '}
                        — no classes
                        scheduled
                      </div>
                    )}
                  </div>
                );
              })()}

            <Btn
              variant="primary"
              onClick={
                sendSubRequest
              }
              disabled={
                reqBusy ||
                !reqForm.startDate ||
                !reqForm.endDate ||
                reqForm.endDate <
                  reqForm.startDate
              }
              full
            >
              {reqBusy
                ? 'Sending requests…'
                : 'Send substitute requests for all periods'}
            </Btn>

            {reqResult && (
              <div
                style={{
                  background:
                    '#D1FAE5',
                  border:
                    '1px solid #6EE7B7',
                  borderRadius: 10,
                  padding:
                    '12px 16px',
                  marginTop: 12,
                  fontSize: 13,
                }}
              >
                <div
                  style={{
                    fontWeight: 700,
                    color: '#065F46',
                    marginBottom: 4,
                  }}
                >
                  Coverage Requested!
                </div>

                <div
                  style={{
                    color: '#374151',
                  }}
                >
                  {
                    reqResult.createdCount
                  }{' '}
                  coverage request(s)
                  created for{' '}
                  {nDays(
                    reqForm.startDate,
                    reqForm.endDate
                  )}{' '}
                  day(s).
                </div>

                <div
                  style={{
                    color: '#6B7280',
                    fontSize: 12,
                    marginTop: 4,
                  }}
                >
                  Eligible substitute teachers can
                  now accept individual periods. Once
                  every period is accepted, your leave
                  details form will unlock.
                </div>
              </div>
            )}
          </Card>

          {/* Workflow Steps */}
          <div
            style={{
              background: '#F9FAFB',
              border:
                '1px solid #E5E7EB',
              borderRadius: 12,
              padding: 20,
            }}
          >
            <h3
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: '#374151',
                marginBottom: 16,
              }}
            >
              Workflow Steps
            </h3>

            {[
              [
                '1',
                'Submit Dates & Leave Type',
                'One leave request creates period coverage slots for all scheduled classes.',
              ],
              [
                '2',
                'Substitutes Claim Periods',
                'Free teachers accept individual periods. Each claim is atomic.',
              ],
              [
                '3',
                '100% Coverage Confirmed',
                'The leave application form unlocks only when every period is covered.',
              ],
              [
                '4',
                'Teacher Adds Reason',
                'Teacher fills the reason and submits the single leave application.',
              ],
              [
                '5',
                'HOD Approval',
                'HOD reviews the submitted leave with all covered periods.',
              ],
              [
                '6',
                'Principal Final Approval',
                'Principal gives final approval and leave balance is deducted once.',
              ],
            ].map(
              ([n, title, desc]) => (
                <div
                  key={n}
                  style={{
                    display: 'flex',
                    gap: 12,
                    marginBottom: 14,
                  }}
                >
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius:
                        '50%',
                      background:
                        '#EDE9FE',
                      color: '#4F46E5',
                      display:
                        'flex',
                      alignItems:
                        'center',
                      justifyContent:
                        'center',
                      fontSize: 12,
                      fontWeight: 800,
                      flexShrink: 0,
                    }}
                  >
                    {n}
                  </div>

                  <div>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: 13,
                      }}
                    >
                      {title}
                    </div>

                    <div
                      style={{
                        fontSize: 12,
                        color:
                          '#6B7280',
                        marginTop: 2,
                      }}
                    >
                      {desc}
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          SUBSTITUTES
          ══════════════════════════════════════════════════════════ */}
      {tab === 'substitutes' && (
        <Card>
          <h3
            style={{
              fontSize: 15,
              fontWeight: 700,
              marginBottom: 6,
            }}
          >
            Substitute coverage requests for you
          </h3>

          <p
            style={{
              fontSize: 13,
              color: '#6B7280',
              marginBottom: 16,
              marginTop: 0,
            }}
          >
            Open requests where a colleague needs period
            coverage, and you are eligible and free.
          </p>

          {subs.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '40px 0',
              }}
            >
              <div
                style={{
                  fontSize: 40,
                  marginBottom: 8,
                }}
              >
                ✓
              </div>

              <div
                style={{
                  fontWeight: 700,
                }}
              >
                All clear!
              </div>

              <div
                style={{
                  fontSize: 13,
                  color: '#9CA3AF',
                  marginTop: 4,
                }}
              >
                No pending requests for you right now.
              </div>
            </div>
          ) : (
            subs.map(r => (
              <div
                key={r._id}
                style={{
                  border:
                    '1px solid #E5E7EB',
                  borderRadius: 10,
                  padding: 16,
                  marginBottom: 12,
                  background:
                    '#FFFBEB',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent:
                      'space-between',
                    alignItems:
                      'flex-start',
                    marginBottom: 12,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: 15,
                      }}
                    >
                      Period{' '}
                      {
                        r.periodNumber
                      }{' '}
                      — {r.subject}
                    </div>

                    <div
                      style={{
                        fontSize: 12,
                        color:
                          '#6B7280',
                        marginTop: 3,
                      }}
                    >
                      Class{' '}
                      {r.className} ·{' '}
                      {r.startTime}–
                      {r.endTime} ·{' '}
                      {fmtD(r.date)} (
                      {
                        r.dayOfWeek
                      }
                      )
                    </div>
                  </div>

                  <Badge
                    s={r.status}
                  />
                </div>

                <div
                  style={{
                    background:
                      '#F9FAFB',
                    border:
                      '1px solid #E5E7EB',
                    borderRadius: 8,
                    padding:
                      '10px 14px',
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      color:
                        '#6B7280',
                      marginBottom: 3,
                    }}
                  >
                    ABSENT TEACHER
                  </div>

                  <div
                    style={{
                      fontWeight: 700,
                    }}
                  >
                    {
                      r.absentTeacher
                        ?.name
                    }
                  </div>

                  <div
                    style={{
                      fontSize: 12,
                      color:
                        '#4F46E5',
                      marginTop: 2,
                    }}
                  >
                    You teach Class{' '}
                    {r.className} and
                    are free during Period{' '}
                    {r.periodNumber}.
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                  }}
                >
                  <Btn
                    variant="green"
                    onClick={() =>
                      doAccept(
                        r._id
                      )
                    }
                    disabled={
                      busy === r._id
                    }
                  >
                    ✓ Accept coverage
                  </Btn>

                  <Btn
                    variant="red"
                    onClick={() =>
                      doDecline(
                        r._id
                      )
                    }
                    disabled={
                      busy === r._id
                    }
                  >
                    ✕ Decline
                  </Btn>
                </div>
              </div>
            ))
          )}
        </Card>
      )}

      {/* ══════════════════════════════════════════════════════════
          HOD VIEW
          ══════════════════════════════════════════════════════════ */}
      {tab === 'hod' && (
        <>
          <Card
            style={{
              marginBottom: 16,
            }}
          >
            <h3
              style={{
                fontSize: 15,
                fontWeight: 700,
                marginBottom: 6,
              }}
            >
              Leave applications for HOD review
            </h3>

            <p
              style={{
                fontSize: 13,
                color: '#6B7280',
                marginBottom: 16,
                marginTop: 0,
              }}
            >
              Only leaves with 100% substitute coverage and
              submitted details appear here.
            </p>

            {allL.filter(
              l => l.status === 'submitted'
            ).length === 0 ? (
              <Empty
                text="No submitted leaves awaiting your review."
              />
            ) : (
              allL
                .filter(
                  l =>
                    l.status ===
                    'submitted'
                )
                .map(l => {
                  const cov =
                    getCoverage(l);

                  return (
                    <div
                      key={l._id}
                      style={{
                        background:
                          '#F9FAFB',
                        border:
                          '1px solid #E5E7EB',
                        borderRadius: 10,
                        padding:
                          '14px 16px',
                        marginBottom: 12,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems:
                            'flex-start',
                          gap: 12,
                          marginBottom: 12,
                        }}
                      >
                        <div
                          style={{
                            flex: 1,
                          }}
                        >
                          <div
                            style={{
                              fontWeight: 700,
                              fontSize: 15,
                            }}
                          >
                            {
                              l.teacher
                                ?.name
                            }{' '}
                            —{' '}
                            {cap(
                              l.leaveType
                            )}{' '}
                            leave
                          </div>

                          <div
                            style={{
                              fontSize: 12,
                              color:
                                '#6B7280',
                              marginTop: 2,
                            }}
                          >
                            {fmtD(
                              l.startDate
                            )}{' '}
                            →{' '}
                            {fmtD(
                              l.endDate
                            )}{' '}
                            ·{' '}
                            {nDays(
                              l.startDate,
                              l.endDate
                            )}{' '}
                            day(s)
                          </div>

                          <div
                            style={{
                              fontSize: 13,
                              color: '#111',
                              marginTop: 4,
                            }}
                          >
                            <b>
                              Reason:
                            </b>{' '}
                            {l.reason}
                          </div>

                          <div
                            style={{
                              background:
                                '#D1FAE5',
                              border:
                                '1px solid #6EE7B7',
                              borderRadius: 8,
                              padding:
                                '8px 12px',
                              marginTop: 8,
                            }}
                          >
                            <div
                              style={{
                                fontSize: 12,
                                color:
                                  '#065F46',
                                fontWeight: 700,
                                marginBottom: 4,
                              }}
                            >
                              ✓ Substitute coverage (
                              {
                                cov.accepted
                              }
                              /
                              {
                                cov.required
                              }{' '}
                              confirmed):
                            </div>

                            {cov.reqs.map(
                              (
                                sr,
                                i
                              ) => (
                                <div
                                  key={
                                    sr._id ||
                                    i
                                  }
                                  style={{
                                    fontSize: 11,
                                    color:
                                      '#374151',
                                    marginTop:
                                      i >
                                      0
                                        ? 3
                                        : 0,
                                  }}
                                >
                                  Period{' '}
                                  {
                                    sr.periodNumber
                                  }{' '}
                                  ·{' '}
                                  {
                                    sr.subject
                                  }{' '}
                                  (Class{' '}
                                  {
                                    sr.className
                                  }) ·{' '}
                                  {
                                    sr.startTime
                                  }–
                                  {
                                    sr.endTime
                                  }{' '}
                                  · Covered by:{' '}
                                  <b>
                                    {sr
                                      .substituteTeacher
                                      ?.name ||
                                      'Substitute'}
                                  </b>
                                </div>
                              )
                            )}
                          </div>
                        </div>

                        <Badge
                          s={l.status}
                        />
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          gap: 8,
                        }}
                      >
                        <Btn
                          variant="blue"
                          onClick={() =>
                            hodApprL(
                              l._id
                            )
                          }
                          disabled={
                            busy ===
                            l._id
                          }
                        >
                          ✓ Approve
                        </Btn>

                        <Btn
                          variant="red"
                          onClick={() =>
                            hodRejectL(
                              l._id
                            )
                          }
                          disabled={
                            busy ===
                            l._id
                          }
                        >
                          ✕ Reject
                        </Btn>
                      </div>
                    </div>
                  );
                })
            )}
          </Card>

          {allS.filter(
            s => s.status === 'open'
          ).length > 0 && (
            <Card>
              <h3
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  marginBottom: 16,
                }}
              >
                Open substitute requests — waiting for acceptance
              </h3>

              {allS
                .filter(
                  s =>
                    s.status ===
                    'open'
                )
                .map(r => (
                  <div
                    key={r._id}
                    style={rowS}
                  >
                    <div
                      style={{
                        flex: 1,
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: 13,
                        }}
                      >
                        Period{' '}
                        {
                          r.periodNumber
                        }{' '}
                        — {r.subject} ·
                        Class{' '}
                        {r.className}
                      </div>

                      <div
                        style={{
                          fontSize: 12,
                          color:
                            '#6B7280',
                          marginTop: 2,
                        }}
                      >
                        Absent:{' '}
                        {
                          r
                            .absentTeacher
                            ?.name
                        }{' '}
                        ·{' '}
                        {fmtD(r.date)} ·{' '}
                        {
                          r.dayOfWeek
                        }
                      </div>
                    </div>

                    <Badge
                      s={r.status}
                    />
                  </div>
                ))}
            </Card>
          )}
        </>
      )}


    </div>
  );
}