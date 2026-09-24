import { useState } from "react";
import { Link } from "react-router-dom";
import api, { message } from "../api";
import {
  Heading,
  useData,
  Field,
  Select,
  Alert,
  managers,
  editors,
  Empty,
  Action,
} from "../ui";
export default function Academics({ user }) {
  const departments = useData("/departments"),
    sections = useData("/sections"),
    teachers = useData("/teachers"),
    tables = useData("/timetable");
  const [error, setError] = useState("");
  const manage = editors.includes(user.role);
  const [editing, setEditing] = useState(null);
  async function add(e, path, refresh) {
    e.preventDefault();
    const form = e.target;
    try {
      if (path === "/sections" && editing) {
        await api.put(
          `/sections/${editing._id}`,
          Object.fromEntries(new FormData(form)),
        );
        setEditing(null);
      } else await api.post(path, Object.fromEntries(new FormData(form)));
      form.reset();
      refresh();
      setError("");
    } catch (e) {
      setError(message(e));
    }
  }
  return (
    <>
      <Heading title="Timetable studio" eyebrow="ACADEMIC PLANNING">
        <Link className="button" to="/timetable/generate">
          Generate timetable ↗
        </Link>
      </Heading>
      <div className="step-strip">
        <span>01 · Create departments & sections</span>
        <span>02 · Link staff & subjects</span>
        <span>03 · Generate, check & save</span>
      </div>
      <Alert>
        {error ||
          tables.error ||
          departments.error ||
          sections.error ||
          teachers.error}
      </Alert>
      <div className="quick-grid">
        <Link className="quick-card" to="/people">
          <h3>Teaching staff</h3>
          <p>
            {teachers.data?.length || 0} scheduling profiles · manage account
            links
          </p>
        </Link>
        {manage && (
          <Link className="quick-card" to="/timetable/subjects">
            <h3>Subjects & faculty</h3>
            <p>
              Manage subjects, weekly loads, batches and faculty assignments.
            </p>
          </Link>
        )}
      </div>
      {manage && (
        <div className="two-column">
          <section className="card">
            <h3>Departments</h3>
            <div className="chips">
              {departments.data?.map((d) => (
                <span className="badge" key={d._id}>
                  {d.name}
                  {managers.includes(user.role) && (
                    <>
                      <Action
                        className="ghost"
                        run={async () => {
                          const name = window.prompt("Department name", d.name);
                          if (name?.trim())
                            await api.put(`/departments/${d._id}`, { name });
                        }}
                        onDone={departments.refresh}
                      >
                        Rename
                      </Action>
                      <Action
                        className="ghost"
                        run={async () => {
                          if (window.confirm("Delete this unused department?"))
                            await api.delete(`/departments/${d._id}`);
                        }}
                        onDone={departments.refresh}
                      >
                        Delete
                      </Action>
                    </>
                  )}
                </span>
              ))}
            </div>
            {managers.includes(user.role) && (
              <form
                onSubmit={(e) => add(e, "/departments", departments.refresh)}
              >
                <Field label="Department name" name="name" required />
                <button className="button secondary">Add department</button>
              </form>
            )}
            {departments.data?.length === 0 && (
              <Empty>
                {user.role === "hod"
                  ? "Ask an administrator to assign your department."
                  : "Add your first department here, then create a section."}
              </Empty>
            )}
          </section>
          <section className="card">
            <h3>{editing ? "Edit section" : "Create section"}</h3>
            {!departments.data?.length && (
              <p className="muted">
                Create a department first. It will then appear in the dropdown
                below.
              </p>
            )}
            <form
              key={editing?._id || "new"}
              className="form-grid"
              onSubmit={(e) => add(e, "/sections", sections.refresh)}
            >
              <Field
                label="Section name"
                name="name"
                defaultValue={editing?.name || ""}
                placeholder="CSE A"
                required
              />
              <Select
                label="Department"
                name="departmentId"
                required
                defaultValue={
                  editing?.departmentId?._id ||
                  editing?.departmentId ||
                  (user.role === "hod" ? user.departmentId : "")
                }
                disabled={!departments.data?.length}
              >
                <option value="">Choose department</option>
                {departments.data?.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.name}
                  </option>
                ))}
              </Select>
              <Field
                label="Semester"
                type="number"
                name="semester"
                defaultValue={editing?.semester || 1}
                min="1"
                max="8"
                required
              />
              <Field
                label="Classroom"
                name="classroom"
                defaultValue={editing?.classroom || ""}
                placeholder="Room 201"
                required
              />
              <button className="button" disabled={!departments.data?.length}>
                {editing ? "Save section" : "Create section"}
              </button>
              {editing && (
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => setEditing(null)}
                >
                  Cancel
                </button>
              )}
            </form>
          </section>
        </div>
      )}
      <section className="card">
        <h2>Sections & saved schedules</h2>
        <p className="muted">
          A saved schedule supplies leave coverage automatically. Catalogue
          changes require removing the affected schedule first; active leave
          workflows protect it from removal.
        </p>
        {sections.data?.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Section</th>
                  <th>Semester</th>
                  <th>Room</th>
                  <th>Schedule</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {sections.data.map((s) => {
                  const tt = tables.data?.find(
                    (t) => String(t.sectionId?._id || t.sectionId) === s._id,
                  );
                  return (
                    <tr key={s._id}>
                      <td>{s.name}</td>
                      <td>{s.semester}</td>
                      <td>{s.classroom}</td>
                      <td>
                        {tt
                          ? `${tt.workingPeriod.startDate} → ${tt.workingPeriod.endDate}`
                          : "Not saved"}
                      </td>
                      <td>
                        {manage && !tt && (
                          <button
                            className="button secondary small"
                            onClick={() => {
                              setEditing(s);
                              window.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                          >
                            Edit section
                          </button>
                        )}
                        {manage && tt && (
                          <Action
                            className="button secondary small"
                            run={async () => {
                              if (
                                window.confirm(
                                  "Remove this saved schedule? Its catalogue can then be changed.",
                                )
                              )
                                await api.delete(`/timetable/${s._id}`);
                            }}
                            onDone={tables.refresh}
                          >
                            Remove schedule
                          </Action>
                        )}
                        {manage && !tt && (
                          <Action
                            className="button secondary small"
                            run={async () => {
                              if (window.confirm("Delete this unused section?"))
                                await api.delete(`/sections/${s._id}`);
                            }}
                            onDone={sections.refresh}
                          >
                            Delete section
                          </Action>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>Create your first section to start scheduling.</Empty>
        )}
      </section>
    </>
  );
}
