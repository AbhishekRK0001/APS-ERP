import { redirect } from "next/navigation";

import { connectDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { buildRelevantNoticeQuery } from "@/lib/noticeAccess";

import User from "@/models/User";
import Notice from "@/models/Notice";
import Department from "@/models/Department";
import Section from "@/models/Section";

type DeadlineKind =
  | "REGISTRATION"
  | "ACADEMIC"
  | "EVENT";

function getRelevantDate(notice: any) {
  if (notice.registrationDeadline) {
    return new Date(
      notice.registrationDeadline
    );
  }

  if (notice.dueDate) {
    return new Date(
      notice.dueDate
    );
  }

  if (notice.eventDate) {
    return new Date(
      notice.eventDate
    );
  }

  return null;
}

function getDeadlineKind(
  notice: any
): DeadlineKind {
  if (notice.registrationDeadline) {
    return "REGISTRATION";
  }

  if (notice.dueDate) {
    return "ACADEMIC";
  }

  return "EVENT";
}

function getDeadlineLabel(
  notice: any
) {
  if (notice.registrationDeadline) {
    return "Registration closes";
  }

  if (notice.dueDate) {
    return "Due";
  }

  return "Event";
}

function getUrgency(date: Date) {
  const now = new Date();

  const difference =
    date.getTime() -
    now.getTime();

  const days =
    difference /
    (1000 * 60 * 60 * 24);

  if (days <= 1) {
    return {
      key: "URGENT",
      label: "Urgent",
    };
  }

  if (days <= 3) {
    return {
      key: "SOON",
      label: "Soon",
    };
  }

  if (days <= 7) {
    return {
      key: "WEEK",
      label: "This week",
    };
  }

  return {
    key: "UPCOMING",
    label: "Upcoming",
  };
}

function formatDate(
  date: Date
) {
  return new Intl.DateTimeFormat(
    "en-IN",
    {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }
  ).format(date);
}

function formatCategory(
  value?: string
) {
  return String(
    value || "GENERAL"
  )
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase()
    );
}

export default async function UpcomingPage() {
  const session =
    await getSession();

  if (!session) {
    redirect("/login");
  }

  await connectDB();

  const user =
    await User.findById(
      session.userId
    );

  if (!user) {
    redirect("/login");
  }

  const now =
    new Date();

  const relevantQuery =
    buildRelevantNoticeQuery(
      user,
      now
    );

  const notices =
    await Notice.find({
      $and: [
        relevantQuery,

        {
          $or: [
            {
              registrationDeadline: {
                $gte: now,
              },
            },

            {
              dueDate: {
                $gte: now,
              },
            },

            {
              eventDate: {
                $gte: now,
              },
            },
          ],
        },
      ],
    })
      .populate({
        path: "postedBy",
        select: "name role",
        model: User,
      })
      .populate({
        path: "departmentId",
        select: "name code",
        model: Department,
      })
      .populate({
        path: "sectionId",
        select: "name",
        model: Section,
      })
      .lean();

  const items =
    notices
      .map((notice: any) => {
        const date =
          getRelevantDate(
            notice
          );

        if (!date) {
          return null;
        }

        return {
          ...notice,

          relevantDate:
            date,

          deadlineKind:
            getDeadlineKind(
              notice
            ),

          deadlineLabel:
            getDeadlineLabel(
              notice
            ),

          urgency:
            getUrgency(date),
        };
      })
      .filter(Boolean)
      .sort(
        (a: any, b: any) =>
          a.relevantDate.getTime() -
          b.relevantDate.getTime()
      );

  const urgentCount =
    items.filter(
      (item: any) =>
        item.urgency.key ===
        "URGENT"
    ).length;

  const soonCount =
    items.filter(
      (item: any) =>
        item.urgency.key ===
          "SOON" ||
        item.urgency.key ===
          "WEEK"
    ).length;

  return (
    <main className="portal-page">
      <header className="portal-page-header">
        <div>
          <p className="page-eyebrow">
            DEADLINES & EVENTS
          </p>

          <h1>
            Upcoming
          </h1>

          <p>
            Academic deadlines,
            registrations and events
            relevant to you.
          </p>
        </div>

        <span className="portal-total">
          {items.length}{" "}
          {items.length === 1
            ? "item"
            : "items"}
        </span>
      </header>

      <section className="upcoming-summary">
        <div>
          <span>
            URGENT
          </span>

          <strong>
            {urgentCount}
          </strong>

          <p>
            Today or tomorrow
          </p>
        </div>

        <div>
          <span>
            COMING SOON
          </span>

          <strong>
            {soonCount}
          </strong>

          <p>
            Within 7 days
          </p>
        </div>

        <div>
          <span>
            TOTAL
          </span>

          <strong>
            {items.length}
          </strong>

          <p>
            Relevant upcoming items
          </p>
        </div>
      </section>

      {items.length === 0 ? (
        <div className="portal-empty">
          <h2>
            Nothing coming up.
          </h2>

          <p>
            New deadlines,
            registrations and events
            will appear here.
          </p>
        </div>
      ) : (
        <div className="upcoming-list">
          {items.map(
            (item: any) => {
              const audience =
                item.scope ===
                "COLLEGE"
                  ? "College"
                  : item.scope ===
                      "DEPARTMENT"
                    ? item
                        .departmentId
                        ?.code ||
                      "Department"
                    : item
                        .sectionId
                        ?.name ||
                      "Class";

              return (
                <article
                  className={`upcoming-item urgency-${item.urgency.key.toLowerCase()}`}
                  key={
                    item._id.toString()
                  }
                >
                  <div className="upcoming-date-block">
                    <span>
                      {item.relevantDate
                        .toLocaleDateString(
                          "en-IN",
                          {
                            month:
                              "short",
                          }
                        )
                        .toUpperCase()}
                    </span>

                    <strong>
                      {item.relevantDate.getDate()}
                    </strong>
                  </div>

                  <div className="upcoming-content">
                    <div className="upcoming-tags">
                      <span>
                        {
                          item.urgency
                            .label
                        }
                      </span>

                      <span>
                        {
                          item.deadlineKind
                        }
                      </span>

                      <span>
                        {formatCategory(
                          item.category
                        )}
                      </span>

                      <span>
                        {audience}
                      </span>
                    </div>

                    <h2>
                      {item.title}
                    </h2>

                    <p>
                      {
                        item.description
                      }
                    </p>

                    <div className="upcoming-detail">
                      <strong>
                        {
                          item.deadlineLabel
                        }
                      </strong>

                      <span>
                        {formatDate(
                          item.relevantDate
                        )}
                      </span>
                    </div>

                    {item.actionLabel &&
                      item.actionLabel !==
                        "NONE" &&
                      item.actionUrl && (
                        <a
                          className="upcoming-action"
                          href={
                            item.actionUrl
                          }
                          target="_blank"
                          rel="noreferrer"
                        >
                          {String(
                            item.actionLabel
                          )
                            .replaceAll(
                              "_",
                              " "
                            )
                            .toLowerCase()
                            .replace(
                              /\b\w/g,
                              (
                                letter
                              ) =>
                                letter.toUpperCase()
                            )}
                        </a>
                      )}
                  </div>
                </article>
              );
            }
          )}
        </div>
      )}
    </main>
  );
}
