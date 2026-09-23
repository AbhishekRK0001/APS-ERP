import Link from "next/link";
import { redirect } from "next/navigation";

import { connectDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { buildRelevantNoticeQuery } from "@/lib/noticeAccess";

import User from "@/models/User";
import Notice from "@/models/Notice";
import Department from "@/models/Department";
import Section from "@/models/Section";

type View =
  | "all"
  | "college"
  | "department"
  | "class";

type Props = {
  searchParams: Promise<{
    view?: string;
  }>;
};

function formatDate(
  value: Date | string | null | undefined
) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatType(type: string) {
  return type
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}

export default async function PortalNoticesPage({
  searchParams,
}: Props) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  await connectDB();

  const user = await User.findById(
    session.userId
  );

  if (!user) {
    redirect("/login");
  }

  const params =
    await searchParams;

  const validViews: View[] = [
    "all",
    "college",
    "department",
    "class",
  ];

  const requestedView =
    String(params.view || "all");

  const view: View =
    validViews.includes(
      requestedView as View
    )
      ? (requestedView as View)
      : "all";

  const now =
    new Date();

  const baseQuery =
    buildRelevantNoticeQuery(
      user,
      now
    );

  const scopeMap: Record<
    Exclude<View, "all">,
    "COLLEGE" | "DEPARTMENT" | "SECTION"
  > = {
    college: "COLLEGE",
    department: "DEPARTMENT",
    class: "SECTION",
  };

  const noticeQuery =
    view === "all"
      ? baseQuery
      : {
          ...baseQuery,
          scope:
            scopeMap[view],
        };

  const [
    notices,
    allCount,
    collegeCount,
    departmentCount,
    classCount,
    department,
    section,
  ] = await Promise.all([
    Notice.find(noticeQuery)
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
      .sort({
        isPinned: -1,
        publishAt: -1,
        createdAt: -1,
      })
      .lean(),

    Notice.countDocuments(
      baseQuery
    ),

    Notice.countDocuments({
      ...baseQuery,
      scope: "COLLEGE",
    }),

    Notice.countDocuments({
      ...baseQuery,
      scope: "DEPARTMENT",
    }),

    Notice.countDocuments({
      ...baseQuery,
      scope: "SECTION",
    }),

    user.departmentId
      ? Department.findById(
          user.departmentId
        ).lean()
      : null,

    user.sectionId
      ? Section.findById(
          user.sectionId
        ).lean()
      : null,
  ]);

  const classLabel =
    session.role === "STUDENT"
      ? "My Bunker"
      : "Class Notices";

  const tabs = [
    {
      key: "all",
      label: "All",
      count: allCount,
    },
    {
      key: "college",
      label: "College",
      count: collegeCount,
    },
    {
      key: "department",
      label: "Department",
      count: departmentCount,
    },
    {
      key: "class",
      label: classLabel,
      count: classCount,
    },
  ];

  return (
    <main className="portal-page">
      <header className="portal-page-header">
        <div>
          <p className="page-eyebrow">
            NOTIFICATION CENTRE
          </p>

          <h1>
            Notice Board
          </h1>

          <p>
            College, department and class
            announcements relevant to you.
          </p>
        </div>

        <span className="portal-total">
          {allCount}{" "}
          {allCount === 1
            ? "notification"
            : "notifications"}
        </span>
      </header>

      {session.role === "STUDENT" && (
        <section className="bunker-summary">
          <div>
            <span>
              YOUR BUNKER
            </span>

            <h2>
              {department?.code ??
                "Department"}{" "}
              ·{" "}
              {section?.name ??
                "Section"}
            </h2>
          </div>

          <div className="bunker-meta">
            <div>
              <span>
                Year
              </span>

              <strong>
                {user.currentYear ??
                  "-"}
              </strong>
            </div>

            <div>
              <span>
                Semester
              </span>

              <strong>
                {user.currentSemester ??
                  "-"}
              </strong>
            </div>
          </div>
        </section>
      )}

      <nav className="notification-tabs">
        {tabs.map((tab) => {
         const href =
            tab.key === "all"
              ? "/portal/notices"
              : `/portal/notices?view=${tab.key}`;

          const active =
            view === tab.key;

          return (
            <Link
              key={tab.key}
              href={href}
              className={
                active
                  ? "notification-tab active"
                  : "notification-tab"
              }
            >
              <span>
                {tab.label}
              </span>

              <strong>
                {tab.count}
              </strong>
            </Link>
          );
        })}
      </nav>

      {notices.length === 0 ? (
        <div className="portal-empty">
          <h2>
            No notifications here.
          </h2>

          <p>
            New notices for this channel
            will appear here.
          </p>
        </div>
      ) : (
        <div className="portal-notice-list">
          {notices.map(
            (notice: any) => {
              let audience =
                "College";

              if (
                notice.scope ===
                "DEPARTMENT"
              ) {
                audience =
                  notice.departmentId
                    ?.code ||
                  "Department";
              }

              if (
                notice.scope ===
                "SECTION"
              ) {
                audience =
                  notice.sectionId
                    ?.name ||
                  "Class";
              }

              return (
                <article
                  className="portal-notice"
                  key={
                    notice._id.toString()
                  }
                >
                  <div className="portal-notice-meta">
                    <span>
                      {audience}
                    </span>

                    <span>
                      {formatType(
                        notice.type
                      )}
                    </span>

                    {notice.isPinned && (
                      <span>
                        PINNED
                      </span>
                    )}

                    {(notice.priority ===
                      "HIGH" ||
                      notice.priority ===
                        "URGENT") && (
                      <span>
                        IMPORTANT
                      </span>
                    )}
                  </div>

                  <h2>
                    {notice.title}
                  </h2>

                  <p>
                    {
                      notice.description
                    }
                  </p>

                  {notice.scope ===
                    "SECTION" && (
                    <div className="notice-target-details">
                      {notice.targetYear && (
                        <span>
                          Year{" "}
                          {
                            notice.targetYear
                          }
                        </span>
                      )}

                      {notice.targetSemester && (
                        <span>
                          Semester{" "}
                          {
                            notice.targetSemester
                          }
                        </span>
                      )}
                    </div>
                  )}

                  {notice.attachments
                    ?.length > 0 && (
                    <div className="notice-attachments">
                      {notice.attachments.map(
                        (
                          attachment: any
                        ) => (
                          <a
                            key={
                              attachment.url
                            }
                            className="notice-attachment"
                            href={
                              attachment.url
                            }
                            target="_blank"
                            rel="noreferrer"
                          >
                            View attachment
                            —{" "}
                            {
                              attachment.name
                            }
                          </a>
                        )
                      )}
                    </div>
                  )}

                  <footer>
                    <span>
                      {notice.postedBy
                        ?.name ||
                        "College Administration"}
                    </span>

                    <span>
                      {formatDate(
                        notice.publishAt
                      )}
                    </span>

                    {notice.dueDate && (
                      <span className="deadline">
                        Due{" "}
                        {formatDate(
                          notice.dueDate
                        )}
                      </span>
                    )}
                  </footer>
                </article>
              );
            }
          )}
        </div>
      )}
    </main>
  );
}
