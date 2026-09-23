import { useEffect, useState } from 'react';
import API from '../api';

const STATUS_LABEL = {
  coverage_pending:     'Coverage pending',
  substitute_confirmed: 'Substitute confirmed',
  submitted:            'Submitted for HOD review',
  hod_approved:         'HOD approved',
  principal_approved:   'Fully approved',
  rejected:             'Rejected',
};

export default function HODDashboard() {
  const [leaves,  setLeaves]  = useState([]);
  const [subReqs, setSubReqs] = useState([]);
  const [msg,     setMsg]     = useState('');
  const [msgType, setMsgType] = useState('success');
  const [busy,    setBusy]    = useState(false);

  useEffect(() => { fetchAll(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchAll() {
    try {
      const [l, s] = await Promise.all([
        API.get('/leaves/all'),
        API.get('/substitutes/all'),
      ]);
      setLeaves(l.data);
      setSubReqs(s.data);
    } catch {
      notify('Failed to load. Check backend.', 'error');
    }
  }

  function notify(text, type = 'success') {
    setMsg(text); setMsgType(type);
    setTimeout(() => setMsg(''), 4000);
  }

  async function approveLeave(id) {
    if (busy) return;
    setBusy(true);
    try {
      await API.patch(`/leaves/${id}/hod-approve`);
      notify('Leave approved by HOD. Forwarded to Principal.');
      setLeaves(l => l.map(x => x._id === id ? { ...x, status: 'hod_approved' } : x));
    } catch (err) {
      notify(err.response?.data?.message || err.message || 'Error approving leave', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function rejectLeave(id) {
    if (busy) return;
    const reason = window.prompt('Enter rejection reason:');
    if (!reason || !reason.trim()) {
      notify('Rejection reason is required', 'error');
      return;
    }
    setBusy(true);
    try {
      await API.patch(`/leaves/${id}/reject`, { reason: reason.trim() });
      notify('Leave rejected.', 'error');
      setLeaves(l => l.map(x => x._id === id ? { ...x, status: 'rejected', rejectionReason: reason.trim() } : x));
    } catch (err) {
      notify(err.response?.data?.message || err.message || 'Error rejecting leave', 'error');
    } finally {
      setBusy(false);
    }
  }

  const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN') : '—';

  const s = {
    wrap:  { maxWidth: 860, margin: '0 auto', padding: 20, fontFamily: 'sans-serif' },
    card:  { border: '1px solid #eee', borderRadius: 10, padding: 16, marginBottom: 16 },
    row:   { display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 0', borderBottom: '1px solid #f0f0f0', fontSize: 13 },
    toast: (t) => ({
      padding: '10px 16px', borderRadius: 8, marginBottom: 14, fontSize: 13,
      background: t === 'error' ? '#FCEBEB' : '#EAF3DE',
      color:      t === 'error' ? '#791F1F' : '#27500A',
      border:     `1px solid ${t === 'error' ? '#F09595' : '#97C459'}`,
    }),
    btn: (c) => ({
      padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12, border: '1px solid',
      ...(c === 'blue'  ? { background: '#E6F1FB', color: '#0C447C', borderColor: '#85B7EB' } :
          c === 'red'   ? { background: '#FCEBEB', color: '#791F1F', borderColor: '#F09595' } :
                          { background: '#EAF3DE', color: '#27500A', borderColor: '#97C459' }),
    }),
    badge: (st) => ({
      display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11,
      background:
        st === 'submitted'          ? '#EEEDFE' :
        st === 'hod_approved'       ? '#E0E7FF' :
        st === 'principal_approved' ? '#EAF3DE' :
        st === 'rejected'           ? '#FCEBEB' : '#FAEEDA',
      color:
        st === 'submitted'          ? '#3C3489' :
        st === 'hod_approved'       ? '#3730A3' :
        st === 'principal_approved' ? '#27500A' :
        st === 'rejected'           ? '#791F1F' : '#633806',
    }),
  };

  const pendingLeaves = leaves.filter(l => l.status === 'submitted');
  const openSubs      = subReqs.filter(r => r.status === 'open');

  return (
    <div style={s.wrap}>
      <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: 20 }}>HOD Dashboard</h2>

      {msg && <div style={s.toast(msgType)}>{msg}</div>}

      {/* Leave applications awaiting HOD review */}
      <div style={s.card}>
        <h3 style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>
          Submitted leave applications ({pendingLeaves.length} pending review)
        </h3>
        {pendingLeaves.length === 0
          ? <p style={{ color: '#999', fontSize: 13 }}>No leave applications awaiting your review.</p>
          : pendingLeaves.map(l => (
            <div key={l._id} style={s.row}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>
                  {l.teacher?.name} — {l.leaveType?.charAt(0).toUpperCase() + l.leaveType?.slice(1)} leave
                </div>
                <div style={{ color: '#6B7280', fontSize: 12, marginTop: 2 }}>
                  {fmtDate(l.startDate)} to {fmtDate(l.endDate)} · {l.reason}
                </div>
                {/* Period coverage list */}
                {(l.substituteRequests || []).length > 0 && (
                  <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 6, padding: '8px 10px', marginTop: 6, fontSize: 12 }}>
                    <div style={{ color: '#166534', fontWeight: 600, marginBottom: 2 }}>✓ Confirmed substitute coverage:</div>
                    {(l.substituteRequests || []).map((sr, idx) => (
                      <div key={sr._id || idx} style={{ color: '#374151', fontSize: 11, marginTop: idx > 0 ? 2 : 0 }}>
                        Period {sr.periodNumber} · {sr.subject} ({sr.className}) · Covered by: <b>{sr.substituteTeacher?.name || 'Substitute'}</b>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <span style={s.badge(l.status)}>{STATUS_LABEL[l.status] || l.status}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => approveLeave(l._id)} disabled={busy} style={s.btn('blue')}>Approve</button>
                <button onClick={() => rejectLeave(l._id)} disabled={busy} style={s.btn('red')}>Reject</button>
              </div>
            </div>
          ))
        }
      </div>

      {/* Open substitute requests monitoring */}
      {openSubs.length > 0 && (
        <div style={s.card}>
          <h3 style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>
            Open substitute requests ({openSubs.length} awaiting substitute acceptance)
          </h3>
          {openSubs.map(r => (
            <div key={r._id} style={s.row}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500 }}>
                  Period {r.periodNumber} · {r.subject} · Class {r.className}
                </div>
                <div style={{ color: '#999', fontSize: 12, marginTop: 2 }}>
                  Absent: {r.absentTeacher?.name} · {fmtDate(r.date)} ({r.dayOfWeek})
                </div>
              </div>
              <span style={s.badge(r.status)}>{r.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
