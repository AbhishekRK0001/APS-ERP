"use client";

import type { ReactNode } from "react";

import {
  useEffect,
  useState,
} from "react";

import Link from "next/link";

import {
  usePathname,
} from "next/navigation";

import PortalNav from "@/components/navigation/PortalNav";
import NotificationBell from "@/components/notifications/NotificationBell";
import LogoutButton from "@/components/auth/LogoutButton";

type Props = {
  children: ReactNode;
  role: string;
  name: string;
};

export default function PortalShell({
  children,
  role,
  name,
}: Props) {
  const pathname =
    usePathname();

  const [
    sidebarOpen,
    setSidebarOpen,
  ] = useState(false);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const initials =
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) =>
        part
          .charAt(0)
          .toUpperCase()
      )
      .join("");

  return (
    <div className="portal-shell">
      <header className="portal-mobile-header">
        <Link
          href="/portal"
          className="portal-mobile-brand"
        >
          <div className="college-emblem">
            EC
          </div>

          <div>
            <strong>
              Engineering College
            </strong>

            <span>
              Academic Portal
            </span>
          </div>
        </Link>

        <button
          type="button"
          className="portal-menu-button"
          aria-label="Open navigation"
          aria-expanded={
            sidebarOpen
          }
          onClick={() =>
            setSidebarOpen(
              (current) =>
                !current
            )
          }
        >
          <span />
          <span />
          <span />
        </button>
      </header>

      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="portal-sidebar-overlay"
          onClick={() =>
            setSidebarOpen(false)
          }
        />
      )}

      <aside
        className={
          sidebarOpen
            ? "portal-sidebar portal-sidebar-open"
            : "portal-sidebar"
        }
      >
        <div className="portal-mobile-sidebar-head">
          <span>
            Navigation
          </span>

          <button
            type="button"
            aria-label="Close navigation"
            onClick={() =>
              setSidebarOpen(false)
            }
          >
            ×
          </button>
        </div>

        <Link
          href="/portal"
          className="portal-logo"
        >
          <div className="college-emblem">
            EC
          </div>

          <div>
            <strong>
              Engineering College
            </strong>

            <span>
              Academic Portal
            </span>
          </div>
        </Link>

        <PortalNav
          role={role}
        />

        <div className="portal-sidebar-bottom">
          <div className="portal-sidebar-notifications">
            <NotificationBell />
          </div>

          <div className="portal-user">
            <div className="portal-user-avatar">
              {initials || "U"}
            </div>

            <div className="portal-user-info">
              <span>
                {role}
              </span>

              <strong>
                {name}
              </strong>
            </div>

            <LogoutButton />
          </div>
        </div>
      </aside>

      <div className="portal-content">
        {children}
      </div>
    </div>
  );
}
