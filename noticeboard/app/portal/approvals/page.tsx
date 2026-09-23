import { redirect } from "next/navigation";

import { connectDB } from "@/lib/db";
import { getSession } from "@/lib/auth";

import User from "@/models/User";
import Notice from "@/models/Notice";
import Section from "@/models/Section";

import ApprovalActions from "@/components/approvals/ApprovalActions";

export default async function ApprovalsPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  if (
    !["HOD", "PRINCIPAL", "ADMIN"].includes(
      session.role
    )
  ) {
    redirect("/portal");
  }

  await connectDB();

  const currentUser = await User.findById(
    session.userId
  ).lean();

  if (!currentUser) {
    redirect("/login");
  }

  const query: Record<string, unknown> = {
    approvalStatus: "PENDING",
    requiresApproval: true,
  };

  if (session.role === "HOD") {
    query.departmentId =
      currentUser.departmentId;
  }

  const notices = await Notice.find(query)
    .populate({
      path: "postedBy",
      select: "name email",
      model: User,
    })
    .populate({
      path: "sectionId",
      select: "name",
      model: Section,
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
            REVIEW QUEUE
          </p>

          <h1>Approvals</h1>

          <p>
            Review tests and examination notices
            submitted by faculty.
          </p>
        </div>

        <span className="portal-total">
          {notices.length} pending
        </span>
      </header>

      {notices.length === 0 ? (
        <div className="portal-empty">
          <h2>No pending approvals.</h2>

          <p>
            New faculty requests will appear here.
          </p>
        </div>
      ) : (
        <div className="approval-list">
          {notices.map((notice: any) => (
            <article
              className="approval-card"
              key={notice._id.toString()}
            >
              <div className="approval-meta">
                <span>{notice.type}</span>

                <span>
                  {notice.sectionId?.name ??
                    notice.scope}
                </span>
              </div>

              <h2>{notice.title}</h2>

              <p>{notice.description}</p>

              <div className="approval-info">
                <span>
                  Submitted by{" "}
                  <strong>
                    {notice.postedBy?.name ??
                      "Faculty"}
                  </strong>
                </span>

                {notice.targetYear && (
                  <span>
                    Year {notice.targetYear}
                  </span>
                )}

                {notice.targetSemester && (
                  <span>
                    Semester{" "}
                    {notice.targetSemester}
                  </span>
                )}
              </div>

              <ApprovalActions
                noticeId={notice._id.toString()}
              />
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
