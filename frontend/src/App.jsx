import { useEffect, useState } from "react";
import { NavLink, Routes, Route, Navigate, Link } from "react-router-dom";
import api, { message } from "./api";
import { managers, staff, label, Alert, Loading } from "./ui";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import People from "./pages/People";
import Academics from "./pages/Academics";
import Leave from "./pages/Leave";
import Notices from "./pages/Notices";
import Cycle from "./pages/Cycle";
import Schedule from "./pages/Schedule";
import GeneratePage from "./modules/timetable/pages/GeneratePage";
import SubjectsPage from "./modules/timetable/pages/SubjectsPage";
export default function App() {
  const [user, setUser] = useState(null),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [open, setOpen] = useState(false),
    [notifications, setNotifications] = useState([]),
    [showNotifications, setShowNotifications] = useState(false);
  useEffect(() => {
    api
      .get("/auth/me")
      .then((r) => setUser(r.data.user))
      .catch((e) => {
        if (e.response?.status !== 401) setError(message(e));
      })
      .finally(() => setReady(true));
    const expired = () => setUser(null);
    window.addEventListener("session-expired", expired);
    return () => window.removeEventListener("session-expired", expired);
  }, []);
  useEffect(() => {
    if (!user) return;
    const fetch = () =>
      api
        .get("/notifications")
        .then((r) => setNotifications(r.data))
        .catch(() => {});
    fetch();
    const timer = setInterval(fetch, 30000);
    return () => clearInterval(timer);
  }, [user]);
  if (!ready)
    return (
      <div className="loading">
        <Loading />
      </div>
    );
  if (!user) return <Login onLogin={setUser} initialError={error} />;
  const isManager = managers.includes(user.role),
    isStaff = staff.includes(user.role),
    canSchedule = isManager || user.role === "hod";
  const links = [
    ["/", "Overview", "◈"],
    ["/schedule", "My timetable", "▦"],
    ["/notices", "Noticeboard", "▤"],
    ...(isStaff ? [["/leave", "Leave & coverage", "↗"]] : []),
    ...(canSchedule ? [["/timetable", "Timetable studio", "▦"]] : []),
    ...(["super_admin", "admin", "principal", "hod", "class_teacher"].includes(
      user.role,
    )
      ? [["/people", "People & access", "♧"]]
      : []),
    ...(isManager ? [["/cycle", "Academic cycle", "↻"]] : []),
  ];
  return (
    <div className="app">
      <aside className={open ? "sidebar open" : "sidebar"}>
        <Link to="/" className="brand">
          <b>A</b>
          <span>
            APS<span>Campus workspace</span>
          </span>
        </Link>
        <div className="nav-caption">YOUR CAMPUS, CONNECTED</div>
        <nav>
          {links.map(([to, name, icon]) => (
            <NavLink
              end={to === "/"}
              to={to}
              key={to}
              onClick={() => setOpen(false)}
            >
              <span>{icon}</span>
              {name}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="live-dot" /> One campus. One workspace.
          <small>Academic operations, together.</small>
        </div>
      </aside>
      {open && (
        <button
          className="nav-overlay"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
        />
      )}
      <div className="workspace">
        <header className="topbar">
          <button
            className="menu-toggle ghost"
            aria-label="Open navigation"
            onClick={() => setOpen(!open)}
          >
            ☰
          </button>
          <span className="breadcrumb">
            APS ERP <span>/</span> Campus workspace
          </span>
          <div className="top-actions">
            <button
              className="ghost"
              onClick={() => setShowNotifications(!showNotifications)}
            >
              Notifications{" "}
              <b className="count">
                {notifications.filter((n) => !n.isRead).length}
              </b>
            </button>
            <span className="avatar">{user.name.slice(0, 1)}</span>
            <span className="identity">
              {user.name}
              <small>{label(user.role)}</small>
            </span>
            <button
              className="ghost"
              onClick={async () => {
                try {
                  await api.post("/auth/logout", {});
                  setUser(null);
                } catch (e) {
                  setError(message(e));
                }
              }}
            >
              Sign out
            </button>
          </div>
        </header>
        {showNotifications && (
          <section className="notification-panel">
            <h3>Campus notifications</h3>
            {notifications.length === 0 ? (
              <p>No notices yet.</p>
            ) : (
              notifications.slice(0, 12).map((n) => (
                <button
                  key={n._id}
                  className={n.isRead ? "read" : ""}
                  onClick={async () => {
                    try {
                      await api.post("/notifications/read", {
                        noticeId: n._id,
                      });
                      setNotifications((items) =>
                        items.map((x) =>
                          x._id === n._id ? { ...x, isRead: true } : x,
                        ),
                      );
                    } catch (e) {
                      setError(message(e));
                    }
                  }}
                >
                  {n.title}
                  <small>{n.isRead ? "Read" : "Mark as read"}</small>
                </button>
              ))
            )}
          </section>
        )}
        <main>
          <Alert>{error}</Alert>
          <Routes>
            <Route path="/" element={<Dashboard user={user} />} />
            <Route path="/schedule" element={<Schedule user={user} />} />
            <Route path="/notices" element={<Notices user={user} />} />
            <Route
              path="/leave"
              element={isStaff ? <Leave user={user} /> : <Navigate to="/" />}
            />
            <Route path="/people" element={<People user={user} />} />
            <Route
              path="/timetable"
              element={
                canSchedule ? <Academics user={user} /> : <Navigate to="/" />
              }
            />
            <Route
              path="/timetable/generate"
              element={canSchedule ? <GeneratePage /> : <Navigate to="/" />}
            />
            <Route
              path="/timetable/subjects"
              element={isManager ? <SubjectsPage /> : <Navigate to="/" />}
            />
            <Route
              path="/cycle"
              element={isManager ? <Cycle /> : <Navigate to="/" />}
            />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
          <footer>
            APS · Academic operations <span>Built around your campus</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
