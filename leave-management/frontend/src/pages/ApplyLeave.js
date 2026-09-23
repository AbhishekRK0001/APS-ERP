import { useNavigate } from 'react-router-dom';

export default function ApplyLeave() {
  const navigate = useNavigate();

  return (
    <div style={{
      maxWidth: 540, margin: '60px auto', padding: 28,
      border: '1px solid #E5E7EB', borderRadius: 12, background: '#fff',
      fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 10px', color: '#111827' }}>
        Leave Application Workflow
      </h2>
      <div style={{
        background: '#EDE9FE', border: '1px solid #C4B5FD', borderRadius: 8,
        padding: '14px 16px', fontSize: 13, color: '#4C1D95', lineHeight: 1.5, marginBottom: 20,
      }}>
        <b>Substitute coverage is required first:</b>
        <ol style={{ margin: '8px 0 0', paddingLeft: 20 }}>
          <li>Request substitute coverage for your scheduled teaching periods.</li>
          <li>Once all periods are accepted by free colleagues, your leave form automatically unlocks.</li>
          <li>Submit your reason to the HOD for approval.</li>
        </ol>
      </div>

      <button
        onClick={() => navigate('/')}
        style={{
          width: '100%', padding: '12px 20px', background: '#4F46E5', color: '#fff',
          border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer',
        }}>
        Go to Teacher Dashboard &amp; Request Coverage →
      </button>
    </div>
  );
}