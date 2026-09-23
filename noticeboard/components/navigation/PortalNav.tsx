"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = {
  role: string;
};

type NavItem = {
  label: string;
  href: string;
};

export default function PortalNav({
  role,
}: Props) {
  const pathname = usePathname();

  const canPublish = [
    "TEACHER",
    "HOD",
    "PRINCIPAL",
    "ADMIN",
  ].includes(role);

  const canApprove = [
    "HOD",
    "PRINCIPAL",
    "ADMIN",
  ].includes(role);

  const canViewDepartment = [
    "HOD",
    "PRINCIPAL",
    "ADMIN",
  ].includes(role);

  const canManageAcademicCycle = [
    "PRINCIPAL",
    "ADMIN",
  ].includes(role);

  const mainItems: NavItem[] = [
    {
      label: "Home",
      href: "/portal",
    },
    {
      label: "Notice Board",
      href: "/portal/notices",
    },
    {
      label: "Upcoming",
      href: "/portal/upcoming",
    },
  ];

  if (canPublish) {
    mainItems.push({
      label: "Create Notice",
      href: "/portal/notices/create",
    });

    mainItems.push({
      label: "My Notices",
      href: "/portal/notices/mine",
    });
  }

  if (canApprove) {
    mainItems.push({
      label: "Approvals",
      href: "/portal/approvals",
    });
  }

  if (canViewDepartment) {
    mainItems.push({
      label: "Department",
      href: "/portal/department",
    });
  }

  if (canManageAcademicCycle) {
    mainItems.push({
      label: "Academic Cycle",
      href: "/portal/academic-cycle",
    });
  }

  function isActive(href: string) {
    if (href === "/portal") {
      return pathname === "/portal";
    }

    if (href === "/portal/notices") {
      return pathname === "/portal/notices";
    }

    return pathname.startsWith(href);
  }

  return (
    <>
      <div className="portal-nav-group">
        <span className="portal-nav-label">
          PORTAL
        </span>

        <nav className="portal-nav">
          {mainItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={
                isActive(item.href)
                  ? "portal-nav-link active"
                  : "portal-nav-link"
              }
            >
              <span className="portal-nav-indicator" />

              <span>
                {item.label}
              </span>
            </Link>
          ))}
        </nav>
      </div>

      <div className="portal-nav-group portal-account-nav">
        <span className="portal-nav-label">
          ACCOUNT
        </span>

        <nav className="portal-nav">
          <Link
            href="/portal/profile"
            className={
              pathname === "/portal/profile"
                ? "portal-nav-link active"
                : "portal-nav-link"
            }
          >
            <span className="portal-nav-indicator" />

            <span>
              My Profile
            </span>
          </Link>
        </nav>
      </div>
    </>
  );
}
