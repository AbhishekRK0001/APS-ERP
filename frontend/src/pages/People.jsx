import { Link } from "react-router-dom";
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
    [dept, setDept] = useState(
      user.role === "hod" ? user.departmentId || "" : "",
    ),
    [semester, setSemester] = useState("1");
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
      setDept(user.role === "hod" ? user.departmentId || "" : "");
      setRole("student");
      setSemester("1");
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
      <Alert>
        {people.error ||
          departments.error ||
          sections.error ||
          teachers.error ||
          error}
      </Alert>
      {info && <p className="success">{info}</p>}
      {departments.data?.length === 0 && (
        <Empty>
          No departments available.{" "}
          <Link to="/timetable">Complete departments and sections setup</Link>{" "}
          before adding students or teachers.
        </Empty>
      )}
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
            required={["student", "teacher", "class_teacher", "hod"].includes(
              role,
            )}
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
              <Select
                key={`${dept}-${semester}`}
                label="Section"
                name="sectionId"
              >
                <option value="">Assign later</option>
                {sections.data
                  ?.filter(
                    (s) =>
                      (s.departmentId === dept ||
                        s.departmentId?._id === dept) &&
                      String(s.semester) === semester,
                  )
                  .map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name} · Semester {s.semester}
                    </option>
                  ))}
              </Select>
              <Select
                label="Semester"
                name="currentSemester"
                required
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
              >
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
        {["admin", "super_admin"].includes(user.role) && (
          <p className="muted">
            Archive blocks access and preserves history. Permanent deletion is
            available for inactive accounts without linked campus records. Your
            own account and Super Admin accounts are protected.
          </p>
        )}
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
                      <Badge>
                        {p.status === "TERMINATED" ? "ARCHIVED" : p.status}
                      </Badge>
                    </td>
                    <td>
                      <div className="inline-actions">
                        {["admin", "super_admin"].includes(user.role) &&
                          ranks[user.role] > ranks[p.role] &&
                          user._id !== p._id && (
                            <>
                              {p.status !== "TERMINATED" && (
                                <Action
                                  className="button secondary small"
                                  run={async () => {
                                    if (
                                      !window.confirm(
                                        `Archive ${p.name} (${p.email})? This blocks access and preserves their records.`,
                                      )
                                    )
                                      return;
                                    const r = await api.post(
                                      `/users/${p._id}/archive`,
                                    );
                                    setInfo(r.data.message);
                                  }}
                                  onDone={people.refresh}
                                >
                                  Archive account
                                </Action>
                              )}
                              {!["ACTIVE", "ALUMNI"].includes(p.status) && (
                                <Action
                                  className="button secondary small"
                                  run={async () => {
                                    const confirmEmail = window.prompt(
                                      `Permanently delete ${p.name}? This cannot be undone. Enter ${p.email} to confirm. Accounts with linked records cannot be deleted.`,
                                    );
                                    if (confirmEmail === null) return;
                                    const r = await api.delete(
                                      `/users/${p._id}`,
                                      { data: { confirmEmail } },
                                    );
                                    setInfo(r.data.message);
                                  }}
                                  onDone={people.refresh}
                                >
                                  Delete permanently
                                </Action>
                              )}
                            </>
                          )}
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

                        {["teacher", "class_teacher", "hod"].includes(p.role) &&
                          ranks[user.role] > ranks[p.role] && (
                            <details>
                              <summary>Assigned sections</summary>
                              <form
                                onSubmit={async (e) => {
                                  e.preventDefault();
                                  try {
                                    await api.patch(
                                      `/users/${p._id}/sections`,
                                      {
                                        assignedSectionIds: new FormData(
                                          e.target,
                                        ).getAll("assignedSectionIds"),
                                      },
                                    );
                                    people.refresh();
                                    setInfo("Assigned sections updated.");
                                  } catch (e) {
                                    setError(message(e));
                                  }
                                }}
                              >
                                <Select
                                  label="Assigned sections"
                                  name="assignedSectionIds"
                                  multiple
                                  defaultValue={p.assignedSectionIds || []}
                                >
                                  {sections.data
                                    ?.filter(
                                      (s) =>
                                        String(
                                          s.departmentId?._id || s.departmentId,
                                        ) === String(p.departmentId),
                                    )
                                    .map((s) => (
                                      <option value={s._id} key={s._id}>
                                        {s.name} · Semester {s.semester}
                                      </option>
                                    ))}
                                </Select>
                                <button className="button secondary small">
                                  Save sections
                                </button>
                              </form>
                            </details>
                          )}
                        {staff.includes(p.role) &&
                          ranks[user.role] >= 3 &&
                          !teachers.data?.some((t) => t.userId === p._id) &&
                          p.status === "ACTIVE" && (
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
                        {![
                          "REQUESTED",
                          "REJECTED",
                          "PENDING",
                          "TERMINATED",
                        ].includes(p.status) &&
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
      <section className="card">
        <h2>Scheduling profiles</h2>
        <p className="muted">
          Link active teaching accounts above. Constraints can be changed before
          schedules are saved.
        </p>
        {teachers.data?.map((t) => (
          <form
            className="inline-form"
            key={t._id}
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await api.put(`/teachers/${t._id}`, {
                  maxSessionsPerDay: Number(
                    new FormData(e.target).get("maxSessionsPerDay"),
                  ),
                  unavailableSlots: new FormData(e.target)
                    .getAll("unavailableSlots")
                    .map((v) => {
                      const [day, slot] = v.split(":").map(Number);
                      return { day, slot };
                    }),
                });
                setInfo("Teacher limit saved.");
                teachers.refresh();
              } catch (e) {
                setError(message(e));
              }
            }}
          >
            <strong>{t.name}</strong>
            <Field
              label="Maximum periods per day"
              name="maxSessionsPerDay"
              type="number"
              min={1}
              max={3}
              required
              defaultValue={t.maxSessionsPerDay}
            />
            <Select
              label="Unavailable periods (Ctrl/Cmd to select several)"
              name="unavailableSlots"
              multiple
              defaultValue={(t.unavailableSlots || []).map(
                (s) => `${s.day}:${s.slot}`,
              )}
            >
              {[
                "Monday",
                "Tuesday",
                "Wednesday",
                "Thursday",
                "Friday",
                "Saturday",
              ].flatMap((day, d) =>
                [0, 1, 3, 4, 6, 7, 8].map((slot) => (
                  <option key={`${d}:${slot}`} value={`${d}:${slot}`}>
                    {day} · Slot {slot + 1}
                  </option>
                )),
              )}
            </Select>
            <button className="button secondary">Save constraints</button>
            <Action
              className="button secondary"
              run={async () => {
                if (
                  window.confirm(
                    "Delete this scheduling profile? The account will remain.",
                  )
                )
                  await api.delete(`/teachers/${t._id}`);
              }}
              onDone={teachers.refresh}
            >
              Delete profile
            </Action>
          </form>
        ))}
      </section>
      {teachers.data?.some((t) => !t.userId) && ranks[user.role] >= 3 && (
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
