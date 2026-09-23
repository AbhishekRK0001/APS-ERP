import type {
  ReactNode,
} from "react";

import {
  redirect,
} from "next/navigation";

import {
  getSession,
} from "@/lib/auth";

import PortalShell from "@/components/navigation/PortalShell";

export default async function PortalLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session =
    await getSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <PortalShell
      role={session.role}
      name={session.name}
    >
      {children}
    </PortalShell>
  );
}
