type NoticeUser = {
  role?: string;

  departmentId?: {
    toString(): string;
  } | string | null;

  sectionId?: {
    toString(): string;
  } | string | null;

  assignedSectionIds?: Array<{
    toString(): string;
  }>;

  currentYear?: number | null;
  currentSemester?: number | null;
};

export function buildRelevantNoticeQuery(
  user: NoticeUser,
  now = new Date()
) {
  const role = user.role || "STUDENT";

  const baseConditions: Record<string, unknown>[] = [
    {
      $or: [
        { expiresAt: null },
        { expiresAt: { $gt: now } },
      ],
    },
  ];

  let audience: Record<string, unknown>[] = [];

  // Principal/Admin can see all published notices.
  if (
    role === "PRINCIPAL" ||
    role === "ADMIN"
  ) {
    audience = [
      { scope: "COLLEGE" },
      { scope: "DEPARTMENT" },
      { scope: "SECTION" },
    ];
  }

  // HOD sees college + everything inside own department.
  else if (role === "HOD") {
    audience = [
      { scope: "COLLEGE" },

      {
        scope: "DEPARTMENT",
        departmentId: user.departmentId,
      },

      {
        scope: "SECTION",
        departmentId: user.departmentId,
      },
    ];
  }

  // Teacher sees college + department + assigned classes.
  else if (role === "TEACHER") {
    const assignedSections =
      user.assignedSectionIds || [];

    audience = [
      { scope: "COLLEGE" },

      {
        scope: "DEPARTMENT",
        departmentId: user.departmentId,
      },
    ];

    if (assignedSections.length > 0) {
      audience.push({
        scope: "SECTION",

        sectionId: {
          $in: assignedSections,
        },
      });
    }
  }

  // Student
  else {
    audience = [
      { scope: "COLLEGE" },
    ];

    if (user.departmentId) {
      audience.push({
        scope: "DEPARTMENT",
        departmentId: user.departmentId,
      });
    }

    if (user.sectionId) {
      audience.push({
        scope: "SECTION",
        sectionId: user.sectionId,
      });
    }

    // Year/Semester filtering matters for students.
    baseConditions.push(
      {
        $or: [
          { targetYear: null },
          {
            targetYear:
              user.currentYear ?? null,
          },
        ],
      },
      {
        $or: [
          { targetSemester: null },
          {
            targetSemester:
              user.currentSemester ?? null,
          },
        ],
      }
    );
  }

  baseConditions.push({
    $or: audience,
  });

  return {
    isPublished: true,

    publishAt: {
      $lte: now,
    },

    $and: baseConditions,
  };
}
