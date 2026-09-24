import { Link } from "react-router-dom";
import { useData, Heading, Alert, label } from "../ui";
export default function AdminDashboard({ user }) {
  const departments = useData("/departments"),
    sections = useData("/sections"),
    teachers = useData("/teachers"),
    users = useData("/users");
  const steps = [
    [
      "/timetable",
      "1. Departments & sections",
      "Create departments, semesters, rooms and sections.",
      departments.data?.length && sections.data?.length,
    ],
    [
      "/people",
      "2. People & teaching staff",
      "Create accounts, assign sections and link scheduling profiles.",
      teachers.data?.length,
    ],
    [
      "/timetable/subjects",
      "3. Subjects & faculty",
      "Set weekly loads and teacher assignments.",
      null,
    ],
    [
      "/timetable/generate",
      "4. Generate & save",
      "Create the schedule that feeds user timetables and leave coverage.",
      null,
    ],
  ];
  return (
    <>
      <Heading
        title="Campus administration"
        eyebrow={`${label(user.role)} WORKSPACE`}
      />
      <p className="muted">
        Manage campus setup, access and daily operations
        {user.role === "hod" ? " within your department" : ""}.
      </p>
      <Alert>
        {departments.error || sections.error || teachers.error || users.error}
      </Alert>
      <div className="stats">
        <div>
          <small>Departments</small>
          <strong>{departments.data?.length ?? "—"}</strong>
        </div>
        <div>
          <small>Sections</small>
          <strong>{sections.data?.length ?? "—"}</strong>
        </div>
        <div>
          <small>Accounts in scope</small>
          <strong>{users.data?.length ?? "—"}</strong>
        </div>
      </div>
      <h2>Campus setup</h2>
      <div className="quick-grid">
        {steps.map(([to, title, desc, done]) => (
          <Link className="quick-card" key={to} to={to}>
            <small>{done ? "CONFIGURED" : "OPEN SETUP"} ↗</small>
            <h3>{title}</h3>
            <p>{desc}</p>
          </Link>
        ))}
      </div>
      <h2>Daily operations</h2>
      <div className="quick-grid">
        {[
          ["/notices", "Notice Board", "Publish and manage campus updates."],
          [
            "/leave",
            "Leave Management",
            "Manage staff applications, coverage and approvals.",
          ],
          ...(["admin", "super_admin"].includes(user.role)
            ? [
                [
                  "/account-requests",
                  "Account requests",
                  "Review new applications before activation.",
                ],
              ]
            : []),
          ...(user.role !== "hod"
            ? [
                [
                  "/cycle",
                  "Academic cycle",
                  "Preview and advance student semesters.",
                ],
              ]
            : []),
        ].map(([to, title, desc]) => (
          <Link className="quick-card" key={to} to={to}>
            <h3>{title}</h3>
            <p>{desc}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
