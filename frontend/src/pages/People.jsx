import { useState } from "react";
import api, { message } from "../api";
import {
  useData,
  Heading,
  Field,
  Select,
  Alert,
  Badge,
  Empty,
  Action,
  label,
  staff,
} from "../ui";
const ranks = {
  student: 0,
  teacher: 1,
  class_teacher: 2,
  hod: 3,
  principal: 4,
  admin: 5,
  super_admin: 6,
};
export default function People({ user }) {
  const people = useData("/users"),
    departments = useData("/departments"),
    sections = useData("/sections"),
    teachers = useData("/teachers");
  const [error, setError] = useState(""),
    [info, setInfo] = useState(""),
    [busy, setBusy] = useState(false),
    [role, setRole] = useState("student"),
    [dept, setDept] = useState("");
  async function create(e) {
    e.preventDefault();
    const form = e.target;
    setBusy(true);
    setError("");
    setInfo("");
    const values = new FormData(form),
      body = Object.fromEntries(values);
    body.assignedSectionIds = values.getAll("assignedSectionIds");
    try {
      const r = await api.post("/users", body);
      setInfo(r.data.message);
      form.reset();
      setDept("");
      people.refresh();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Heading title="People & access" />
      <p className="muted">
        Create campus accounts, assign their audience and link teaching staff to
        the timetable.
      </p>
      <Alert>{people.error || error}</Alert>
      {info && <p className="success">{info}</p>}
      <details className="card" open>
        <summary>Create an account</summary>
        <form className="form-grid" onSubmit={create}>
          <Field label="Full name" name="name" required />
          <Field label="College email" name="email" type="email" required />
          <Field label="College ID / USN" name="usn" />
          <Select
            label="Role"
            name="role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            {Object.keys(ranks)
              .filter((r) => ranks[r] < ranks[user.role])
              .map((r) => (
                <option key={r} value={r}>
                  {label(r)}
                </option>
              ))}
          </Select>
          <Select
            label="Department"
            name="departmentId"
            value={dept}
            onChange={(e) => setDept(e.target.value)}
          >
            <option value="">Select department</option>
            {departments.data?.map((d) => (
              <option value={d._id} key={d._id}>
                {d.name}
              </option>
            ))}
          </Select>
          {role === "student" ? (
            <>
              <Select label="Section" name="sectionId">
                <option value="">Assign later</option>
                {sections.data
                  ?.filter(
                    (s) =>
                      s.departmentId === dept || s.departmentId?._id === dept,
                  )
                  .map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name} · Semester {s.semester}
                    </option>
                  ))}
              </Select>
              <Select label="Semester" name="currentSemester" required>
                {Array.from({ length: 8 }, (_, i) => (
                  <option key={i} value={i + 1}>
                    {i + 1}
                  </option>
                ))}
              </Select>
            </>
          ) : (
            <Select
              label="Assigned sections · Ctrl/Cmd to select several"
              name="assignedSectionIds"
              multiple
            >
              {sections.data
                ?.filter(
                  (s) =>
                    s.departmentId === dept || s.departmentId?._id === dept,
                )
                .map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name}
                  </option>
                ))}
            </Select>
          )}
          <div className="form-end">
            <button className="button" disabled={busy}>
              {busy ? "Creating…" : "Create pending account"}
            </button>
          </div>
        </form>
      </details>
      <section className="card">
        <h2>Campus directory</h2>
        {people.data?.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Person</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {people.data.map((p) => (
                  <tr key={p._id}>
                    <td>
                      <strong>{p.name}</strong>
                      <small>{p.email}</small>
                    </td>
                    <td>{label(p.role)}</td>
                    <td>
                      <Badge>{p.status}</Badge>
                    </td>
                    <td>
                      <div className="inline-actions">
                        {p.role === "student" &&
                          ranks[user.role] > ranks.student && (
                            <select
                              aria-label={`Section for ${p.name}`}
                              value={p.sectionId || ""}
                              onChange={async (e) => {
                                try {
                                  await api.patch(`/users/${p._id}/section`, {
                                    sectionId: e.target.value,
                                  });
                                  people.refresh();
                                } catch (e) {
                                  setError(message(e));
                                }
                              }}
                            >
                              <option value="">Assign section</option>
                              {sections.data
                                ?.filter(
                                  (s) =>
                                    String(
                                      s.departmentId?._id || s.departmentId,
                                    ) === String(p.departmentId) &&
                                    s.semester === p.currentSemester,
                                )
                                .map((s) => (
                                  <option key={s._id} value={s._id}>
                                    {s.name}
                                  </option>
                                ))}
                            </select>
                          )}

                        {staff.includes(p.role) &&
                          ranks[user.role] >= 4 &&
                          !teachers.data?.some((t) => t.userId === p._id) && (
                            <Action
                              className="button secondary small"
                              run={() =>
                                api.post("/teachers", { userId: p._id })
                              }
                              onDone={teachers.refresh}
                            >
                              Link to timetable
                            </Action>
                          )}
                        {p.status !== "PENDING" &&
                          ranks[user.role] > ranks[p.role] && (
                            <Action
                              className="button secondary small"
                              run={() =>
                                api.patch(`/users/${p._id}/status`, {
                                  status:
                                    p.status === "ACTIVE" ? "FROZEN" : "ACTIVE",
                                })
                              }
                              onDone={people.refresh}
                            >
                              {p.status === "ACTIVE"
                                ? "Freeze access"
                                : "Activate access"}
                            </Action>
                          )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>No accounts in your scope.</Empty>
        )}
      </section>
      {teachers.data?.some((t) => !t.userId) && ranks[user.role] >= 4 && (
        <section className="card">
          <h2>Link existing scheduling teachers</h2>
          <p>
            Choose the matching staff account explicitly. Names alone are not
            used to merge identities.
          </p>
          {teachers.data
            .filter((t) => !t.userId)
            .map((t) => (
              <form
                className="inline-form"
                key={t._id}
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    await api.put(`/teachers/${t._id}`, {
                      userId: new FormData(e.target).get("userId"),
                    });
                    teachers.refresh();
                  } catch (e) {
                    setError(message(e));
                  }
                }}
              >
                <strong>{t.name}</strong>
                <select name="userId" required>
                  <option value="">Choose staff account</option>
                  {people.data
                    ?.filter((p) => staff.includes(p.role))
                    .map((p) => (
                      <option value={p._id} key={p._id}>
                        {p.name} · {p.email}
                      </option>
                    ))}
                </select>
                <button className="button">Link account</button>
              </form>
            ))}
        </section>
      )}
    </>
  );
}
