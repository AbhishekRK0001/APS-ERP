import { useState } from "react";
import api, { message } from "../api";
import { useData, Heading, Alert, Empty, Action, label } from "../ui";
export default function AccountRequests() {
  const requests = useData("/users/requests"),
    departments = useData("/departments"),
    sections = useData("/sections");
  const [info, setInfo] = useState("");
  return (
    <>
      <Heading title="Account requests" eyebrow="ADMIN APPROVAL" />
      <p className="muted">
        Check each applicant's campus identity. Approval lets them request an
        email activation code and choose their own password.
      </p>
      <Alert>{requests.error || departments.error || sections.error}</Alert>
      {info && <p className="success">{info}</p>}
      {requests.data === null && !requests.error ? (
        <p>Loading requests…</p>
      ) : requests.data?.length ? (
        requests.data.map((p) => (
          <article className="card" key={p._id}>
            <h2>{p.name}</h2>
            <p>
              {p.email} · {p.usn || "No college ID supplied"}
            </p>
            <p>
              {label(p.role)} ·{" "}
              {departments.data?.find((d) => d._id === p.departmentId)?.name ||
                "Department unavailable"}{" "}
              {p.sectionId &&
                `· ${sections.data?.find((s) => s._id === p.sectionId)?.name || "Section unavailable"}`}
            </p>
            <div className="inline-actions">
              <Action
                run={async () => {
                  const r = await api.post(`/users/${p._id}/review`, {
                    action: "APPROVE",
                  });
                  setInfo(r.data.message);
                }}
                onDone={requests.refresh}
              >
                Approve account
              </Action>
              <Action
                className="button secondary"
                run={async () => {
                  const reason = window.prompt(
                    "Reason for rejecting this account request",
                  );
                  if (!reason?.trim()) return;
                  const r = await api.post(`/users/${p._id}/review`, {
                    action: "REJECT",
                    reason,
                  });
                  setInfo(r.data.message);
                }}
                onDone={requests.refresh}
              >
                Reject request
              </Action>
            </div>
          </article>
        ))
      ) : (
        !requests.error && <Empty>No account requests awaiting review.</Empty>
      )}
    </>
  );
}
export function Registration({ onBack }) {
  const options = useData("/auth/registration/options");
  const [role, setRole] = useState("student"),
    [dept, setDept] = useState(""),
    [semester, setSemester] = useState("1"),
    [error, setError] = useState(""),
    [info, setInfo] = useState(""),
    [busy, setBusy] = useState(false);
  const sections =
    options.data?.sections.filter(
      (s) => s.departmentId === dept && String(s.semester) === semester,
    ) || [];
  return (
    <>
      <h2>Request a campus account</h2>
      <p>
        Your Admin or Super Admin will review this request before you can
        activate your account.
      </p>
      <Alert>{error || options.error}</Alert>
      {info ? (
        <p className="success" role="status">
          {info}
        </p>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              setInfo(
                (
                  await api.post(
                    "/auth/registration/request",
                    Object.fromEntries(new FormData(e.target)),
                  )
                ).data.message,
              );
            } catch (e) {
              setError(message(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="field">
            <span>Full name</span>
            <input name="name" required maxLength={150} />
          </label>
          <label className="field">
            <span>College email</span>
            <input name="email" type="email" required maxLength={254} />
          </label>
          <label className="field">
            <span>College ID / USN</span>
            <input name="usn" maxLength={100} />
          </label>
          <label className="field">
            <span>Requested role</span>
            <select
              name="role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              {["student", "teacher", "class_teacher"].map((r) => (
                <option value={r} key={r}>
                  {label(r)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Department</span>
            <select
              name="departmentId"
              required
              value={dept}
              onChange={(e) => setDept(e.target.value)}
            >
              <option value="">Choose department</option>
              {options.data?.departments.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          {options.data && !options.data.departments.length && (
            <p className="muted">
              Campus setup is pending. Ask an administrator to add departments
              first.
            </p>
          )}
          {role === "student" && (
            <>
              <label className="field">
                <span>Semester</span>
                <select
                  name="currentSemester"
                  value={semester}
                  onChange={(e) => setSemester(e.target.value)}
                >
                  {Array.from({ length: 8 }, (_, i) => (
                    <option key={i} value={i + 1}>
                      {i + 1}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Section</span>
                <select
                  key={`${dept}-${semester}`}
                  name="sectionId"
                  required
                  disabled={!sections.length}
                >
                  <option value="">Choose section</option>
                  {sections.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              {dept && !sections.length && (
                <p className="muted">
                  No sections in this department and semester. Ask an
                  administrator to create your section.
                </p>
              )}
            </>
          )}
          <button
            className="button"
            disabled={
              busy ||
              !options.data?.departments.length ||
              (role === "student" && !sections.length)
            }
          >
            {busy ? "Submitting…" : "Send account request"}
          </button>
        </form>
      )}
      <button className="ghost" onClick={onBack}>
        Back to sign in
      </button>
    </>
  );
}
