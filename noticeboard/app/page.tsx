import NoticeBoard from "@/components/notices/NoticeBoard";

export default function Home() {
  return (
    <main>
      <header className="site-header">
        <div className="container header-inner">
          <a href="/" className="college-brand">
            <div className="college-emblem">
              EC
            </div>

            <div className="college-brand-text">
              <strong>Engineering College</strong>
              <span>Academic Portal</span>
            </div>
          </a>

          <div className="header-actions">
            <span className="header-current">
              Notice Board
            </span>

            <a href="/login" className="login-button">
              Login
            </a>
          </div>
        </div>
      </header>

      <section className="notice-hero">
        <div className="container">
          <div className="notice-hero-content">
            <div>
              <p className="page-eyebrow">
                OFFICIAL NOTICE BOARD
              </p>

              <h1>
                College announcements,
                <br />
                all in one place.
              </h1>
            </div>

            <p className="hero-description">
              Stay informed with academic announcements,
              institutional updates, events and important
              deadlines published by the college.
            </p>
          </div>
        </div>
      </section>

      <section className="notice-section">
        <div className="container">
          <div className="section-heading">
            <div>
              <p className="page-eyebrow">
                LATEST UPDATES
              </p>

              <h2>Notice Board</h2>
            </div>

            <p>
              Official announcements are displayed here.
              Sign in for class and department-specific notices.
            </p>
          </div>

          <NoticeBoard />
        </div>
      </section>

      <footer className="site-footer">
        <div className="container footer-inner">
          <div>
            <strong>Engineering College</strong>
            <span>Academic Portal</span>
          </div>

          <p>
            Official College Notice Board
          </p>
        </div>
      </footer>
    </main>
  );
}
