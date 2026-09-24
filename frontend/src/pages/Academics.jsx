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
  Empty,
  Action,
} from "../ui";
export default function Academics({ user }) {
  const departments = useData("/departments"),
    sections = useData("/sections"),
    teachers = useData("/teachers"),
    tables = useData("/timetable");
  const [error, setError] = useState("");
  const manage = managers.includes(user.role);
  async function add(e, path, refresh) {
    e.preventDefault();
    const form = e.target;
    try {
      await api.post(path, Object.fromEntries(new FormData(form)));
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
      <Alert>{error || tables.error}</Alert>
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
                </span>
              ))}
            </div>
            <form onSubmit={(e) => add(e, "/departments", departments.refresh)}>
              <Field label="Department name" name="name" required />
              <button className="button secondary">Add department</button>
            </form>
          </section>
          <section className="card">
            <h3>Create section</h3>
            <form
              className="form-grid"
              onSubmit={(e) => add(e, "/sections", sections.refresh)}
            >
              <Field
                label="Section name"
                name="name"
                placeholder="CSE A"
                required
              />
              <Select label="Department" name="departmentId" required>
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
                min="1"
                max="8"
                required
              />
              <Field
                label="Classroom"
                name="classroom"
                placeholder="Room 201"
                required
              />
              <button className="button">Create section</button>
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
