import {
  redirect,
} from "next/navigation";

import {
  getSession,
} from "@/lib/auth";

import AcademicCycleManager from "@/components/academic/AcademicCycleManager";

export default async function AcademicCyclePage() {
  const session =
    await getSession();

  if (!session) {
    redirect("/login");
  }

  if (
    ![
      "PRINCIPAL",
      "ADMIN",
    ].includes(
      session.role
    )
  ) {
    redirect("/portal");
  }

  return (
    <main className="portal-page">
      <header className="portal-page-header">
        <div>
          <p className="page-eyebrow">
            ACADEMIC ADMINISTRATION
          </p>

          <h1>
            Academic Cycle
          </h1>

          <p>
            Review and advance the
            college&apos;s active
            academic semester cycle.
          </p>
        </div>
      </header>

      <AcademicCycleManager />
    </main>
  );
}
