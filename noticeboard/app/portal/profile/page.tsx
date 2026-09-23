import { redirect } from "next/navigation";

import { connectDB } from "@/lib/db";
import { getSession } from "@/lib/auth";

import User from "@/models/User";
import Department from "@/models/Department";
import Section from "@/models/Section";

function formatRole(role?: string) {
  if (!role) {
    return "-";
  }

  return role
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}

export default async function ProfilePage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  await connectDB();

  const user = await User.findById(
    session.userId
  )
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
    .populate({
      path: "assignedSectionIds",
      select: "name",
      model: Section,
    })
    .lean();

  if (!user) {
    redirect("/login");
  }

  const role =
    String(user.role || session.role);

  const isStudent =
    role === "STUDENT";

  const isTeacher =
    role === "TEACHER";

  const department =
    user.departmentId as any;

  const section =
    user.sectionId as any;

  const assignedSections =
    Array.isArray(
      user.assignedSectionIds
    )
      ? (user.assignedSectionIds as any[])
      : [];

  const initials = String(
    user.name || "User"
  )
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) =>
      part.charAt(0).toUpperCase()
    )
    .join("");

  return (
    <main className="portal-page">
      <header className="portal-page-header">
        <div>
          <p className="page-eyebrow">
            ACCOUNT
          </p>

          <h1>
            My Profile
          </h1>

          <p>
            Your college identity and
            academic information.
          </p>
        </div>
      </header>

      <section className="profile-identity-card">
        <div className="profile-avatar">
          {initials}
        </div>

        <div className="profile-identity">
          <span>
            {formatRole(role)}
          </span>

          <h2>
            {user.name}
          </h2>

          <p>
            {user.email}
          </p>
        </div>

        <div className="profile-status">
          <span>
            ACCOUNT STATUS
          </span>

          <strong>
            {user.isActive === false
              ? "Inactive"
              : "Active"}
          </strong>
        </div>
      </section>

      <div className="profile-grid">
        <section className="profile-section">
          <div className="profile-section-heading">
            <span>
              PERSONAL DETAILS
            </span>

            <h2>
              College identity
            </h2>
          </div>

          <div className="profile-details">
            <div>
              <span>
                Full Name
              </span>

              <strong>
                {user.name || "-"}
              </strong>
            </div>

            <div>
              <span>
                Email
              </span>

              <strong>
                {user.email || "-"}
              </strong>
            </div>

            <div>
              <span>
                College ID
              </span>

              <strong>
                {user.collegeId ||
                  "Not assigned"}
              </strong>
            </div>

            <div>
              <span>
                Role
              </span>

              <strong>
                {formatRole(role)}
              </strong>
            </div>
          </div>
        </section>

        <section className="profile-section">
          <div className="profile-section-heading">
            <span>
              ORGANISATION
            </span>

            <h2>
              College placement
            </h2>
          </div>

          <div className="profile-details">
            <div>
              <span>
                Department
              </span>

              <strong>
                {department
                  ? `${department.code} — ${department.name}`
                  : "College Administration"}
              </strong>
            </div>

            {isStudent && (
              <>
                <div>
                  <span>
                    Bunker / Section
                  </span>

                  <strong>
                    {section?.name ||
                      "Not assigned"}
                  </strong>
                </div>

                <div>
                  <span>
                    Current Year
                  </span>

                  <strong>
                    {user.currentYear
                      ? `Year ${user.currentYear}`
                      : "-"}
                  </strong>
                </div>

                <div>
                  <span>
                    Current Semester
                  </span>

                  <strong>
                    {user.currentSemester
                      ? `Semester ${user.currentSemester}`
                      : "-"}
                  </strong>
                </div>

                <div>
                  <span>
                    Academic Status
                  </span>

                  <strong>
                    {String(
                      user.academicStatus ||
                        "ACTIVE"
                    )
                      .toLowerCase()
                      .replace(
                        /\b\w/g,
                        (letter) =>
                          letter.toUpperCase()
                      )}
                  </strong>
                </div>
              </>
            )}

            {isTeacher && (
              <div className="profile-assigned-classes">
                <span>
                  Assigned Classes
                </span>

                {assignedSections.length >
                0 ? (
                  <div>
                    {assignedSections.map(
                      (assigned: any) => (
                        <strong
                          key={
                            assigned._id?.toString() ||
                            assigned.name
                          }
                        >
                          {
                            assigned.name
                          }
                        </strong>
                      )
                    )}
                  </div>
                ) : (
                  <strong>
                    No classes assigned
                  </strong>
                )}
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="profile-info-note">
        <strong>
          College-managed profile
        </strong>

        <p>
          Academic information such as
          department, section, year,
          semester and role is managed
          by the college administration
          and cannot be changed from
          this account.
        </p>
      </section>
    </main>
  );
}
