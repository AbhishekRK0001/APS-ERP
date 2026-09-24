import { Link } from "react-router-dom";
import { useData, Heading, Badge, Empty, Alert, managers, staff } from "../ui";
export default function Dashboard({ user }) {
  const { data: notices, error } = useData("/feed");
  const date = new Date();
  return (
    <>
      <Heading
        title="Your campus, at a glance."
        eyebrow={date
          .toLocaleDateString("en-IN", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })
          .toUpperCase()}
      >
        <Badge>Campus workspace</Badge>
      </Heading>
      <section className="welcome">
        <div>
          <small>MAKE ROOM FOR WHAT MATTERS</small>
          <h2>Welcome back, {user.name.split(" ")[0]}.</h2>
          <p>
            A clear view of your academic day.
            <br />
            Plan your classes, keep up with notices and stay connected.
          </p>
          <Link className="button cream" to="/schedule">
            View my timetable ↗
          </Link>
        </div>
        <div className="welcome-art">
          <div className="art-card">
            <span>APS</span>
            <strong>
              One
              <br />
              campus.
            </strong>
            <small>ALL IN SYNC</small>
          </div>
          <i />
          <i />
        </div>
      </section>
      <div className="section-title">
        <h2>Your workspace</h2>
        <span>Pick up where you need to</span>
      </div>
      <div className="quick-grid">
        {[
          [
            "/schedule",
            "01",
            "My timetable",
            "See your weekly teaching or class schedule.",
          ],
          [
            "/notices",
            "02",
            "Campus noticeboard",
            "Updates, deadlines and opportunities.",
          ],
          ...(staff.includes(user.role)
            ? [
                [
                  "/leave",
                  "03",
                  "Leave & coverage",
                  "Arrange substitutes and track approvals.",
                ],
              ]
            : []),
          ...(managers.includes(user.role) || user.role === "hod"
            ? [
                [
                  "/timetable",
                  "04",
                  "Timetable studio",
                  "Plan a conflict-free academic week.",
                ],
              ]
            : []),
        ].map(([to, n, title, desc]) => (
          <Link className="quick-card" key={to} to={to}>
            <small>
              {n} <span>↗</span>
            </small>
            <h3>{title}</h3>
            <p>{desc}</p>
          </Link>
        ))}
      </div>
      <div className="section-title">
        <h2>On the noticeboard</h2>
        <Link to="/notices">View all updates →</Link>
      </div>
      <Alert>{error}</Alert>
      {notices?.length ? (
        <div className="notice-grid">
          {notices.slice(0, 3).map((n) => (
            <article className="card" key={n._id}>
              <Badge>{n.category}</Badge>
              <h3>{n.title}</h3>
              <p>
                {n.description.slice(0, 160)}
                {n.description.length > 160 ? "…" : ""}
              </p>
              <small className="muted">
                {n.postedBy?.name} ·{" "}
                {new Date(n.publishAt).toLocaleDateString("en-IN")}
              </small>
            </article>
          ))}
        </div>
      ) : (
        <Empty>Campus updates will appear here when published.</Empty>
      )}
    </>
  );
}
