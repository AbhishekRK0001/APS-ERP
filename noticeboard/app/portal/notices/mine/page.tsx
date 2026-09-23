import {
  redirect,
} from "next/navigation";

import {
  connectDB,
} from "@/lib/db";

import {
  getSession,
} from "@/lib/auth";

import Notice from "@/models/Notice";
import Section from "@/models/Section";

function getStatus(
  notice: any
) {
  if (
    notice.approvalStatus ===
    "PENDING"
  ) {
    return "Pending approval";
  }

  if (
    notice.approvalStatus ===
    "REJECTED"
  ) {
    return "Rejected";
  }

  if (
    notice.isPublished
  ) {
    return "Published";
  }

  return "Not published";
}

export default async function MyNoticesPage() {
  const session =
    await getSession();

  if (!session) {
    redirect("/login");
  }

  if (
    ![
      "TEACHER",
      "HOD",
      "PRINCIPAL",
      "ADMIN",
    ].includes(session.role)
  ) {
    redirect("/portal");
  }

  await connectDB();

  const notices =
    await Notice.find({
      postedBy:
        session.userId,
    })
      .populate({
        path:
          "sectionId",

        select:
          "name",

        model:
          Section,
      })
      .sort({
        createdAt: -1,
      })
      .lean();

  return (
    <main className="portal-page">
      <header className="portal-page-header">
        <div>
          <p className="page-eyebrow">
            YOUR POSTS
          </p>

          <h1>
            My Notices
          </h1>

          <p>
            Track published,
            pending and rejected
            notices created by you.
          </p>
        </div>
      </header>

      {notices.length ===
      0 ? (
        <div className="portal-empty">
          <h2>
            No notices created.
          </h2>
        </div>
      ) : (
        <div className="portal-notice-list">
          {notices.map(
            (notice: any) => (
              <article
                className="portal-notice"
                key={
                  notice._id.toString()
                }
              >
                <div className="notice-status-row">
                  <span
                    className={`notice-status ${notice.approvalStatus?.toLowerCase()}`}
                  >
                    {getStatus(
                      notice
                    )}
                  </span>

                  <span>
                    {
                      notice.type
                    }
                  </span>

                  {notice
                    .sectionId
                    ?.name && (
                    <span>
                      {
                        notice
                          .sectionId
                          .name
                      }
                    </span>
                  )}
                </div>

                <h2>
                  {
                    notice.title
                  }
                </h2>

                <p>
                  {
                    notice.description
                  }
                </p>

                {notice
                  .rejectionReason && (
                  <div className="rejection-message">
                    HOD feedback:{" "}
                    {
                      notice
                        .rejectionReason
                    }
                  </div>
                )}

                {notice
                  .attachments
                  ?.map(
                    (
                      attachment:
                        any
                    ) => (
                      <a
                        className="notice-attachment"
                        href={
                          attachment.url
                        }
                        target="_blank"
                        rel="noreferrer"
                        key={
                          attachment.url
                        }
                      >
                        View attachment —{" "}
                        {
                          attachment.name
                        }
                      </a>
                    )
                  )}
              </article>
            )
          )}
        </div>
      )}
    </main>
  );
}
