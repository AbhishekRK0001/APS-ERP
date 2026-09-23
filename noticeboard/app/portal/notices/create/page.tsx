import { redirect } from "next/navigation";

import { connectDB } from "@/lib/db";
import { getSession } from "@/lib/auth";

import User from "@/models/User";
import Department from "@/models/Department";
import Section from "@/models/Section";

import CreateNoticeForm from "@/components/notices/CreateNoticeForm";

export default async function CreateNoticePage() {
  const session = await getSession();

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

  const user = await User.findById(
    session.userId
  ).lean();

  if (!user) {
    redirect("/login");
  }

  let departments: any[] = [];
  let sections: any[] = [];

  /*
   * TEACHER
   * Only own department +
   * classes actually assigned to them.
   */
  if (session.role === "TEACHER") {
    if (user.departmentId) {
      departments =
        await Department.find({
          _id: user.departmentId,
          isActive: true,
        })
          .sort({ name: 1 })
          .lean();
    }

    sections =
      await Section.find({
        _id: {
          $in:
            user.assignedSectionIds ||
            [],
        },

        isActive: true,
      })
        .sort({ name: 1 })
        .lean();
  }

  /*
   * HOD
   * Only own department and
   * all sections inside it.
   */
  else if (session.role === "HOD") {
    if (user.departmentId) {
      departments =
        await Department.find({
          _id: user.departmentId,
          isActive: true,
        })
          .sort({ name: 1 })
          .lean();

      sections =
        await Section.find({
          departmentId:
            user.departmentId,

          isActive: true,
        })
          .sort({ name: 1 })
          .lean();
    }
  }

  /*
   * PRINCIPAL / ADMIN
   * Can select any active
   * department or section.
   */
  else {
    departments =
      await Department.find({
        isActive: true,
      })
        .sort({ name: 1 })
        .lean();

    sections =
      await Section.find({
        isActive: true,
      })
        .sort({ name: 1 })
        .lean();
  }

  const departmentOptions =
    departments.map(
      (department: any) => ({
        id:
          department._id.toString(),

        name:
          department.name,

        code:
          department.code,
      })
    );

  const sectionOptions =
    sections.map(
      (section: any) => ({
        id:
          section._id.toString(),

        name:
          section.name,

        departmentId:
          section.departmentId.toString(),
      })
    );

  return (
    <main className="portal-page">
      <header className="portal-page-header">
        <div>
          <p className="page-eyebrow">
            PUBLISHING
          </p>

          <h1>
            Create Notice
          </h1>

          <p>
            Publish information to the
            college, department or
            permitted class audience.
          </p>
        </div>
      </header>

      <CreateNoticeForm
        role={session.role}
        departmentId={
          user.departmentId
            ? user.departmentId.toString()
            : null
        }
        departments={
          departmentOptions
        }
        sections={
          sectionOptions
        }
      />
    </main>
  );
}
