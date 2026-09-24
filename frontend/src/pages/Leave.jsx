import { useState } from "react";
import api, { message } from "../api";
import {
  Heading,
  useData,
  Alert,
  Field,
  Select,
  Badge,
  Action,
  Empty,
  label,
  staff,
} from "../ui";
export default function Leave({
  user,
  readOnly = true,
  teacherId = "",
  onChanged,
}) {
  const scoped = (path) =>
    path + (teacherId ? `?teacherId=${encodeURIComponent(teacherId)}` : "");
  const [tab, setTab] = useState("mine");
  const mine = useData(scoped("/leaves/my")),
    incoming = useData(scoped("/substitutes/my")),
    accepted = useData(scoped("/substitutes/accepted")),
    balance = useData(scoped("/leaves/balance")),
    sections = useData("/sections");
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const refresh = () => {
    mine.refresh();
    incoming.refresh();
    accepted.refresh();
    balance.refresh();
    onChanged?.();
  };
  const className = (id) =>
    sections.data?.find((s) => s._id === id)?.name || id;
  const reviewer = false;
  async function request(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api.post(
        scoped("/substitutes/request"),
        Object.fromEntries(new FormData(e.target)),
      );
      refresh();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Heading
        title={teacherId ? `Leave records · ${user.name}` : "Leave Management"}
        eyebrow="KEEP EVERY CLASS COVERED"
      />
      {readOnly && (
        <p className="muted">
          Your leave records and coverage assignments are read-only. Contact
          your HOD or campus management to request changes.
        </p>
      )}
      <div className="stats">
        <div>
          <small>First half available</small>
          <strong>
            {balance.data
              ? balance.data.firstHalfTotal - balance.data.firstHalfUsed
              : "—"}
          </strong>
        </div>
        <div>
          <small>Second half available</small>
          <strong>
            {balance.data
              ? balance.data.secondHalfTotal - balance.data.secondHalfUsed
              : "—"}
          </strong>
        </div>
        <div>
          <small>Coverage requests for you</small>
          <strong>{incoming.data?.length ?? "—"}</strong>
        </div>
      </div>
      <div className="tabs">
        {[
          ["mine", "My applications"],
          ["incoming", "Substitute requests"],
          ["accepted", "My cover assignments"],
          ...(reviewer ? [["review", "Review applications"]] : []),
        ].map(([key, name]) => (
          <button
            className={tab === key ? "active" : ""}
            key={key}
            onClick={() => setTab(key)}
          >
            {name}
          </button>
        ))}
      </div>
      <Alert>
        {error ||
          mine.error ||
          incoming.error ||
          accepted.error ||
          balance.error ||
          sections.error}
      </Alert>
      {tab === "mine" && (
        <>
          {!readOnly && (
            <section className="card">
              <h2>Record leave for {user.name}</h2>
              <p className="muted">
                One application for the entire date range. Submit the reason
                after every scheduled period has an accepted substitute.
              </p>
              <form className="form-grid" onSubmit={request}>
                <Field
                  label="Start date"
                  type="date"
                  name="startDate"
                  min={new Date().toISOString().slice(0, 10)}
                  required
                />
                <Field
                  label="End date"
                  type="date"
                  name="endDate"
                  min={new Date().toISOString().slice(0, 10)}
                  required
                />
                <Select label="Leave type" name="leaveType">
                  {["casual", "sick", "emergency", "paternity/maternity"].map(
                    (t) => (
                      <option key={t} value={t}>
                        {label(t)}
                      </option>
                    ),
                  )}
                </Select>
                <div className="form-end">
                  <button className="button" disabled={busy}>
                    {busy ? "Requesting…" : "Request substitute coverage"}
                  </button>
                </div>
              </form>
            </section>
          )}
          {mine.data?.length ? (
            mine.data.map((l) => (
              <article className="card" key={l._id}>
                <div className="section-title">
                  <h3>
                    {l.startDate.slice(0, 10)} — {l.endDate.slice(0, 10)}
                  </h3>
                  <Badge>{l.status}</Badge>
                </div>
                <p>
                  {label(l.leaveType)} ·{" "}
                  {
                    l.substituteRequests.filter((r) => r.substituteTeacher)
                      .length
                  }{" "}
                  / {l.substituteRequests.length} periods covered
                </p>
                <progress
                  value={
                    l.substituteRequests.filter((r) => r.substituteTeacher)
                      .length
                  }
                  max={l.substituteRequests.length || 1}
                />
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Date / time</th>
                        <th>Class</th>
                        <th>Subject</th>
                        <th>Substitute</th>
                      </tr>
                    </thead>
                    <tbody>
                      {l.substituteRequests.map((r) => (
                        <tr key={r._id}>
                          <td>
                            {r.date.slice(0, 10)}
                            <small>
                              {r.startTime}–{r.endTime}
                            </small>
                          </td>
                          <td>{className(r.className)}</td>
                          <td>{r.subject}</td>
                          <td>
                            {r.substituteTeacher?.name ||
                              "Waiting for acceptance"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!readOnly && l.status === "substitute_confirmed" && (
                  <form
                    className="inline-form"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      try {
                        await api.patch(scoped(`/leaves/${l._id}/details`), {
                          reason: new FormData(e.target).get("reason"),
                        });
                        refresh();
                      } catch (e) {
                        setError(message(e));
                      }
                    }}
                  >
                    <Field label="Reason for leave" name="reason" required />
                    <button className="button">
                      Submit one leave application
                    </button>
                  </form>
                )}
                {l.reason && <p>Reason: {l.reason}</p>}
                {l.rejectionReason && (
                  <Alert>Rejected: {l.rejectionReason}</Alert>
                )}
              </article>
            ))
          ) : (
            <Empty>No leave applications yet.</Empty>
          )}
        </>
      )}
      {tab === "incoming" &&
        (incoming.data?.length ? (
          incoming.data.map((r) => (
            <article className="card" key={r._id}>
              <div className="section-title">
                <h3>{r.absentTeacher?.name} needs coverage</h3>
                <Badge>{r.leave?.leaveType}</Badge>
              </div>
              <p>
                {r.subject} · {className(r.className)} · {r.date.slice(0, 10)} ·{" "}
                {r.startTime}–{r.endTime}
              </p>
              <p className="muted">
                Leave dates: {r.leave?.startDate.slice(0, 10)} —{" "}
                {r.leave?.endDate.slice(0, 10)}
              </p>
              {!readOnly && (
                <div className="inline-actions">
                  <Action
                    run={() =>
                      api.patch(scoped(`/substitutes/${r._id}/accept`), {})
                    }
                    onDone={refresh}
                  >
                    Assign selected teacher
                  </Action>
                  <Action
                    className="button secondary"
                    run={() =>
                      api.patch(scoped(`/substitutes/${r._id}/decline`), {})
                    }
                    onDone={refresh}
                  >
                    Decline
                  </Action>
                </div>
              )}
            </article>
          ))
        ) : (
          <Empty>
            No eligible open requests. You must teach the same section and be
            free during the requested period.
          </Empty>
        ))}
      {tab === "accepted" &&
        (accepted.data?.length ? (
          accepted.data.map((r) => (
            <article className="card" key={r._id}>
              <h3>
                {r.subject} · {className(r.className)}
              </h3>
              <p>
                {r.date.slice(0, 10)} · {r.startTime}–{r.endTime} · Covering{" "}
                {r.absentTeacher?.name}
              </p>
              <Badge>{r.status}</Badge>
            </article>
          ))
        ) : (
          <Empty>No accepted cover assignments.</Empty>
        ))}
      {tab === "review" && <Review />}
    </>
  );
}
function Review({ user }) {
  const { data, error, refresh } = useData("/leaves/all");
  return (
    <>
      <Alert>{error}</Alert>
      {data?.length ? (
        data.map((l) => (
          <article className="card" key={l._id}>
            <div className="section-title">
              <h3>{l.teacher?.name}</h3>
              <Badge>{l.status}</Badge>
            </div>
            <p>
              {l.startDate.slice(0, 10)} — {l.endDate.slice(0, 10)} ·{" "}
              {label(l.leaveType)}
            </p>
            <p>{l.reason}</p>
            <p className="muted">
              {l.substituteRequests.length} covered periods
            </p>
            {l.teacher?._id !== user._id &&
              (user.role === "hod"
                ? l.status === "submitted"
                : user.role === "principal"
                  ? l.status === "hod_approved"
                  : ["submitted", "hod_approved"].includes(l.status)) && (
                <div className="inline-actions">
                  <Action
                    run={() => api.patch(`/leaves/${l._id}/approve`, {})}
                    onDone={refresh}
                  >
                    Approve application
                  </Action>
                  <Action
                    className="button secondary"
                    run={async () => {
                      const reason = window.prompt("Reason for rejection");
                      if (reason)
                        await api.patch(`/leaves/${l._id}/reject`, { reason });
                    }}
                    onDone={refresh}
                  >
                    Reject
                  </Action>
                </div>
              )}
          </article>
        ))
      ) : (
        <Empty>No leave applications in your scope.</Empty>
      )}
    </>
  );
}

export function ReadOnlyLeave({ user }) {
  if (!staff.includes(user.role))
    return (
      <>
        <Heading title="Leave Management" />
        <Empty>
          The current leave workflow covers teaching staff. Student leave
          records are not configured for this campus.
        </Empty>
      </>
    );
  return <Leave user={user} readOnly />;
}
export function ManagedLeave({ user }) {
  const people = useData("/users");
  const [selected, setSelected] = useState("");
  const [revision, setRevision] = useState(0);
  const target = people.data?.find((p) => p._id === selected);
  return (
    <>
      <Heading title="Leave administration" />
      <Alert>{people.error}</Alert>
      <section className="card">
        <h2>Staff leave & coverage</h2>
        <p>
          Choose the staff member whose records you want to manage. To assign
          substitute coverage, select the substitute teacher and open their
          Substitute requests tab.
        </p>
        <Select
          label="Staff member"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value="">Choose a teaching account</option>
          {people.data
            ?.filter((p) => staff.includes(p.role) && p.status === "ACTIVE")
            .map((p) => (
              <option key={p._id} value={p._id}>
                {p.name} · {label(p.role)}
              </option>
            ))}
        </Select>
      </section>
      {target && (
        <Leave
          key={target._id}
          user={target}
          teacherId={target._id}
          readOnly={false}
          onChanged={() => setRevision((v) => v + 1)}
        />
      )}
      <section className="card">
        <h2>All applications & approvals</h2>
        <p>
          HOD review comes first, followed by Principal review. Admins can
          process either stage. Self-approval is blocked.
        </p>
        <Review key={`${selected}-${revision}`} user={user} />
      </section>
    </>
  );
}
