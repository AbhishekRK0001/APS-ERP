import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth";

import CampusHome from "@/components/campus/CampusHome";

export default async function PortalHomePage() {
  const session =
    await getSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <CampusHome
      role={session.role}
      name={session.name}
    />
  );
}
