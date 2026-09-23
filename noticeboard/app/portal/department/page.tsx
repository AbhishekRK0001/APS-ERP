import { redirect } from "next/navigation";

import { connectDB } from "@/lib/db";
import { getSession } from "@/lib/auth";

import Department from "@/models/Department";
import Section from "@/models/Section";
import User from "@/models/User";

export default async function DepartmentPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  if (
    !["HOD", "PRINCIPAL", "ADMIN"].includes(session.role)
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

  const departmentFilter =
    session.role === "HOD"
      ? {
          _id: currentUser.departmentId,
        }
      : {
          isActive: true,
        };

  const departments = await Department.find(
    departmentFilter
  )
    .sort({ code: 1 })
    .lean();

  const data = await Promise.all(
    departments.map(async (department) => {
      const sectionCount =
        await Section.countDocuments({
          departmentId: department._id,
          isActive: true,
        });

      const studentCount =
        await User.countDocuments({
          departmentId: department._id,
          role: "STUDENT",
          isActive: true,
        });

      const teacherCount =
        await User.countDocuments({
          departmentId: department._id,
          role: "TEACHER",
          isActive: true,
        });

      const sections = await Section.find({
        departmentId: department._id,
        isActive: true,
      })
        .sort({ name: 1 })
        .lean();

      return {
        department,
        sectionCount,
        studentCount,
        teacherCount,
        sections,
      };
    })
  );

  return (
    <main className="portal-page">
      <header className="portal-page-header">
        <div>
          <p className="page-eyebrow">
            ACADEMIC STRUCTURE
          </p>

          <h1>
            {session.role === "HOD"
              ? "Department"
              : "Departments"}
          </h1>

          <p>
            Academic departments, sections and users in
            the college portal.
          </p>
        </div>
      </header>

      <div className="department-list">
        {data.map((item) => (
          <section
            className="department-block"
            key={item.department._id.toString()}
          >
            <div className="department-heading">
              <div>
                <span>{item.department.code}</span>

                <h2>{item.department.name}</h2>
              </div>

              <div className="department-metrics">
                <div>
                  <strong>{item.studentCount}</strong>
                  <span>Students</span>
                </div>

                <div>
                  <strong>{item.teacherCount}</strong>
                  <span>Teachers</span>
                </div>

                <div>
                  <strong>{item.sectionCount}</strong>
                  <span>Sections</span>
                </div>
              </div>
            </div>

            <div className="section-list">
              {item.sections.map((section) => (
                <div
                  className="section-row"
                  key={section._id.toString()}
                >
                  <span>{section.name}</span>

                  <small>Active section</small>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
