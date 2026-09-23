"use client";

import { useEffect, useMemo, useState } from "react";

type Notice = {
  _id: string;
  title: string;
  description: string;
  type: string;
  priority: string;
  scope: string;
  isPinned?: boolean;
  publishAt?: string;
  dueDate?: string | null;

  postedBy?: {
    name?: string;
    role?: string;
  };

  departmentId?: {
    name?: string;
    code?: string;
  } | null;

  sectionId?: {
    name?: string;
  } | null;
};

type Filter = "ALL" | "COLLEGE" | "IMPORTANT" | "EVENT";

export default function NoticeBoard() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function loadNotices() {
      try {
        const response = await fetch("/api/notices");
        const data = await response.json();

        if (data.success) {
          setNotices(data.notices);
        }
      } catch (error) {
        console.error("Failed to load notices:", error);
      } finally {
        setLoading(false);
      }
    }

    loadNotices();
  }, []);

  const filteredNotices = useMemo(() => {
    return notices.filter((notice) => {
      const query = search.trim().toLowerCase();

      const matchesSearch =
        !query ||
        notice.title.toLowerCase().includes(query) ||
        notice.description.toLowerCase().includes(query);

      if (!matchesSearch) return false;

      if (filter === "COLLEGE") {
        return notice.scope === "COLLEGE";
      }

      if (filter === "IMPORTANT") {
        return (
          notice.type === "IMPORTANT" ||
          notice.priority === "HIGH" ||
          notice.priority === "URGENT"
        );
      }

      if (filter === "EVENT") {
        return notice.type === "EVENT";
      }

      return true;
    });
  }, [notices, search, filter]);

  const upcoming = useMemo(() => {
    const now = new Date();

    return notices
      .filter(
        (notice) =>
          notice.dueDate &&
          new Date(notice.dueDate).getTime() >= now.getTime()
      )
      .sort(
        (a, b) =>
          new Date(a.dueDate!).getTime() -
          new Date(b.dueDate!).getTime()
      )
      .slice(0, 4);
  }, [notices]);

  function formatFullDate(date?: string | null) {
    if (!date) return "";

    return new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(date));
  }

  function getDateParts(date?: string) {
    if (!date) {
      return {
        day: "--",
        month: "---",
      };
    }

    const value = new Date(date);

    return {
      day: new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
      }).format(value),

      month: new Intl.DateTimeFormat("en-IN", {
        month: "short",
      })
        .format(value)
        .toUpperCase(),
    };
  }

  function getAudience(notice: Notice) {
    if (notice.scope === "COLLEGE") return "College";

    if (notice.scope === "DEPARTMENT") {
      return notice.departmentId?.code || "Department";
    }

    if (notice.scope === "SECTION") {
      return notice.sectionId?.name || "Class";
    }

    return "Notice";
  }

  function getType(notice: Notice) {
    if (notice.type === "ASSIGNMENT_REMINDER") return "Assignment";
    return notice.type.charAt(0) + notice.type.slice(1).toLowerCase();
  }

  return (
    <div className="notice-layout">
      <section className="notice-main">
        <div className="notice-controls">
          <div className="notice-tabs">
            {(
              [
                ["ALL", "All"],
                ["COLLEGE", "College"],
                ["IMPORTANT", "Important"],
                ["EVENT", "Events"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={filter === value ? "active" : ""}
                onClick={() => setFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="notice-search">
            <input
              type="search"
              placeholder="Search notices"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search notices"
            />
          </div>
        </div>

        {loading && (
          <div className="notice-state">
            <p>Loading notices...</p>
          </div>
        )}

        {!loading && filteredNotices.length === 0 && (
          <div className="notice-state">
            <p>No notices found.</p>
          </div>
        )}

        <div className="notice-list">
          {filteredNotices.map((notice) => {
            const date = getDateParts(notice.publishAt);

            return (
              <article className="notice-card" key={notice._id}>
                <div className="notice-date">
                  <strong>{date.day}</strong>
                  <span>{date.month}</span>
                </div>

                <div className="notice-content">
                  <div className="notice-card-top">
                    <div className="notice-tags">
                      <span className="notice-tag">
                        {getAudience(notice)}
                      </span>

                      <span className="notice-tag subtle">
                        {getType(notice)}
                      </span>

                      {notice.isPinned && (
                        <span className="notice-tag pinned">
                          Pinned
                        </span>
                      )}

                      {(notice.priority === "HIGH" ||
                        notice.priority === "URGENT") && (
                        <span className="notice-tag priority">
                          Important
                        </span>
                      )}
                    </div>
                  </div>

                  <h3>{notice.title}</h3>

                  <p className="notice-body">
                    {notice.description}
                  </p>

                  <div className="notice-card-footer">
                    <span>
                      {notice.postedBy?.name ||
                        "College Administration"}
                    </span>

                    {notice.dueDate && (
                      <span className="deadline">
                        Due {formatFullDate(notice.dueDate)}
                      </span>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <aside className="notice-sidebar">
        <div className="sidebar-section">
          <div className="sidebar-heading">
            <div>
              <span className="sidebar-eyebrow">
                DEADLINES
              </span>
              <h3>Upcoming</h3>
            </div>

            <span className="sidebar-count">
              {upcoming.length}
            </span>
          </div>

          {upcoming.length === 0 ? (
            <p className="sidebar-empty">
              No upcoming deadlines.
            </p>
          ) : (
            <div className="upcoming-list">
              {upcoming.map((notice) => (
                <div
                  className="upcoming-item"
                  key={notice._id}
                >
                  <span>
                    {formatFullDate(notice.dueDate)}
                  </span>

                  <strong>{notice.title}</strong>

                  <small>
                    {getAudience(notice)}
                  </small>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="sidebar-note">
          <span>Student Portal</span>

          <h3>Your personal notices appear after login.</h3>

          <p>
            Sign in to view notices for your department,
            class and current academic cycle.
          </p>

          <a href="/login">
            Sign in to portal →
          </a>
        </div>
      </aside>
    </div>
  );
}
