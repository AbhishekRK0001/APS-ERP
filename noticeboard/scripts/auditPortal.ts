import mongoose from "mongoose";

import User from "../models/User";
import Notice from "../models/Notice";
import Department from "../models/Department";
import Section from "../models/Section";
import AcademicCycle from "../models/AcademicCycle";
import NotificationRead from "../models/NotificationRead";

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error(
    "MONGODB_URI is missing."
  );
}

const MONGODB_URI: string = uri;

type Issue = {
  area: string;
  message: string;
};

const issues: Issue[] = [];

function issue(
  area: string,
  message: string
) {
  issues.push({
    area,
    message,
  });
}

function safeUrl(
  value?: string | null
) {
  if (!value) {
    return true;
  }

  try {
    const url =
      new URL(value);

    return [
      "http:",
      "https:",
    ].includes(
      url.protocol
    );
  } catch {
    return false;
  }
}

async function run() {
  await mongoose.connect(MONGODB_URI);

  console.log(
    "\n=============================="
  );

  console.log(
    " COLLEGE PORTAL QA AUDIT"
  );

  console.log(
    "==============================\n"
  );

  const [
    users,
    notices,
    departments,
    sections,
    cycles,
    reads,
  ] = await Promise.all([
    User.find({}).lean(),
    Notice.find({}).lean(),
    Department.find({}).lean(),
    Section.find({}).lean(),
    AcademicCycle.find({}).lean(),
    NotificationRead.find({}).lean(),
  ]);

  const departmentMap =
    new Map(
      departments.map(
        (department: any) => [
          department._id.toString(),
          department,
        ]
      )
    );

  const sectionMap =
    new Map(
      sections.map(
        (section: any) => [
          section._id.toString(),
          section,
        ]
      )
    );

  const userMap =
    new Map(
      users.map(
        (user: any) => [
          user._id.toString(),
          user,
        ]
      )
    );

  const noticeMap =
    new Map(
      notices.map(
        (notice: any) => [
          notice._id.toString(),
          notice,
        ]
      )
    );

  /*
   * USERS
   */

  for (const user of users as any[]) {
    const id =
      user._id.toString();

    if (!user.name) {
      issue(
        "USER",
        `${id}: missing name`
      );
    }

    if (!user.email) {
      issue(
        "USER",
        `${id}: missing email`
      );
    }

    if (
      user.departmentId &&
      !departmentMap.has(
        user.departmentId.toString()
      )
    ) {
      issue(
        "USER",
        `${user.email}: department does not exist`
      );
    }

    if (
      user.role === "STUDENT"
    ) {
      if (!user.departmentId) {
        issue(
          "STUDENT",
          `${user.email}: no department`
        );
      }

      if (!user.sectionId) {
        issue(
          "STUDENT",
          `${user.email}: no bunker/section`
        );
      }

      if (
        !user.currentYear ||
        user.currentYear < 1 ||
        user.currentYear > 4
      ) {
        issue(
          "STUDENT",
          `${user.email}: invalid current year`
        );
      }

      if (
        !user.currentSemester ||
        user.currentSemester < 1 ||
        user.currentSemester > 8
      ) {
        issue(
          "STUDENT",
          `${user.email}: invalid current semester`
        );
      }

      if (
        user.sectionId &&
        user.departmentId
      ) {
        const section =
          sectionMap.get(
            user.sectionId.toString()
          );

        if (
          section &&
          section.departmentId.toString() !==
            user.departmentId.toString()
        ) {
          issue(
            "STUDENT",
            `${user.email}: section belongs to another department`
          );
        }
      }
    }

    if (
      user.role === "TEACHER"
    ) {
      if (!user.departmentId) {
        issue(
          "TEACHER",
          `${user.email}: no department`
        );
      }

      for (
        const sectionId of
        user.assignedSectionIds ||
        []
      ) {
        const section =
          sectionMap.get(
            sectionId.toString()
          );

        if (!section) {
          issue(
            "TEACHER",
            `${user.email}: assigned section does not exist`
          );

          continue;
        }

        if (
          user.departmentId &&
          section.departmentId.toString() !==
            user.departmentId.toString()
        ) {
          issue(
            "TEACHER",
            `${user.email}: assigned to ${section.name} from another department`
          );
        }
      }
    }

    if (
      user.role === "HOD" &&
      !user.departmentId
    ) {
      issue(
        "HOD",
        `${user.email}: HOD has no department`
      );
    }
  }

  /*
   * SECTIONS
   */

  for (
    const section of
    sections as any[]
  ) {
    if (
      !departmentMap.has(
        section.departmentId?.toString()
      )
    ) {
      issue(
        "SECTION",
        `${section.name}: invalid department`
      );
    }
  }

  /*
   * NOTICES
   */

  for (
    const notice of
    notices as any[]
  ) {
    const title =
      notice.title ||
      notice._id.toString();

    if (
      !userMap.has(
        notice.postedBy?.toString()
      )
    ) {
      issue(
        "NOTICE",
        `"${title}": publisher does not exist`
      );
    }

    if (
      notice.scope === "COLLEGE"
    ) {
      if (
        notice.sectionId
      ) {
        issue(
          "NOTICE",
          `"${title}": COLLEGE notice has sectionId`
        );
      }
    }

    if (
      notice.scope ===
      "DEPARTMENT"
    ) {
      if (
        !notice.departmentId
      ) {
        issue(
          "NOTICE",
          `"${title}": DEPARTMENT notice has no department`
        );
      }

      if (
        notice.sectionId
      ) {
        issue(
          "NOTICE",
          `"${title}": DEPARTMENT notice should not have sectionId`
        );
      }
    }

    if (
      notice.scope ===
      "SECTION"
    ) {
      if (
        !notice.departmentId
      ) {
        issue(
          "NOTICE",
          `"${title}": SECTION notice has no department`
        );
      }

      if (
        !notice.sectionId
      ) {
        issue(
          "NOTICE",
          `"${title}": SECTION notice has no section`
        );
      }

      if (
        notice.sectionId &&
        notice.departmentId
      ) {
        const section =
          sectionMap.get(
            notice.sectionId.toString()
          );

        if (
          section &&
          section.departmentId.toString() !==
            notice.departmentId.toString()
        ) {
          issue(
            "NOTICE",
            `"${title}": section and department do not match`
          );
        }
      }
    }

    if (
      notice.approvalStatus ===
        "PENDING" &&
      notice.isPublished
    ) {
      issue(
        "APPROVAL",
        `"${title}": pending notice is published`
      );
    }

    if (
      notice.approvalStatus ===
        "REJECTED" &&
      notice.isPublished
    ) {
      issue(
        "APPROVAL",
        `"${title}": rejected notice is published`
      );
    }

    if (
      notice.requiresApproval &&
      notice.approvalStatus ===
        "NOT_REQUIRED"
    ) {
      issue(
        "APPROVAL",
        `"${title}": requires approval but status is NOT_REQUIRED`
      );
    }

    if (
      notice.approvalStatus ===
        "APPROVED" &&
      !notice.isPublished
    ) {
      issue(
        "APPROVAL",
        `"${title}": approved but not published`
      );
    }

    if (
      notice.actionLabel &&
      notice.actionLabel !==
        "NONE"
    ) {
      if (
        !notice.actionUrl
      ) {
        issue(
          "NOTICE",
          `"${title}": action button has no URL`
        );
      } else if (
        !safeUrl(
          notice.actionUrl
        )
      ) {
        issue(
          "SECURITY",
          `"${title}": invalid action URL`
        );
      }
    }

    if (
      notice.targetYear &&
      (
        notice.targetYear < 1 ||
        notice.targetYear > 4
      )
    ) {
      issue(
        "NOTICE",
        `"${title}": invalid target year`
      );
    }

    if (
      notice.targetSemester &&
      (
        notice.targetSemester < 1 ||
        notice.targetSemester > 8
      )
    ) {
      issue(
        "NOTICE",
        `"${title}": invalid target semester`
      );
    }
  }

  /*
   * ACADEMIC CYCLE
   */

  const activeCycles =
    (cycles as any[]).filter(
      (cycle) =>
        cycle.isActive
    );

  if (
    activeCycles.length === 0
  ) {
    issue(
      "ACADEMIC CYCLE",
      "No active academic cycle"
    );
  }

  if (
    activeCycles.length > 1
  ) {
    issue(
      "ACADEMIC CYCLE",
      `${activeCycles.length} academic cycles are active`
    );
  }

  /*
   * NOTIFICATION READ REFERENCES
   */

  for (
    const read of
    reads as any[]
  ) {
    if (
      !userMap.has(
        read.userId?.toString()
      )
    ) {
      issue(
        "NOTIFICATION",
        `Read record ${read._id} has invalid user`
      );
    }

    if (
      !noticeMap.has(
        read.noticeId?.toString()
      )
    ) {
      issue(
        "NOTIFICATION",
        `Read record ${read._id} has invalid notice`
      );
    }
  }

  /*
   * SUMMARY
   */

  const roleCounts =
    users.reduce(
      (
        result: Record<
          string,
          number
        >,
        user: any
      ) => {
        result[user.role] =
          (result[
            user.role
          ] || 0) + 1;

        return result;
      },
      {}
    );

  console.log(
    "DATABASE SUMMARY\n"
  );

  console.log(
    `Departments: ${departments.length}`
  );

  console.log(
    `Sections:    ${sections.length}`
  );

  console.log(
    `Users:       ${users.length}`
  );

  console.log(
    `Notices:     ${notices.length}`
  );

  console.log(
    `Read states: ${reads.length}`
  );

  console.log(
    `Cycles:      ${cycles.length}`
  );

  console.log(
    "\nROLES"
  );

  console.table(
    roleCounts
  );

  if (
    issues.length === 0
  ) {
    console.log(
      "\n✅ AUDIT PASSED"
    );

    console.log(
      "No database integrity problems detected.\n"
    );
  } else {
    console.log(
      `\n⚠️ ${issues.length} ISSUE(S) FOUND\n`
    );

    console.table(
      issues
    );

    console.log(
      "\nDo not repair them manually yet."
    );

    console.log(
      "Send this output back to me and we will fix each issue safely.\n"
    );
  }

  await mongoose.disconnect();
}

run().catch(
  async (error) => {
    console.error(
      "\nAUDIT FAILED\n",
      error
    );

    try {
      await mongoose.disconnect();
    } catch {}

    process.exit(1);
  }
);
