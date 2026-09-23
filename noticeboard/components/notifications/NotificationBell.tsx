"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  usePathname,
  useRouter,
} from "next/navigation";

type NotificationItem = {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  audience: string;
  publishedAt?: string;
  postedBy: string;
  isRead: boolean;
  hasDeadline: boolean;
};

function formatDate(
  value?: string
) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat(
    "en-IN",
    {
      day: "numeric",
      month: "short",
    }
  ).format(
    new Date(value)
  );
}

export default function NotificationBell() {
  const router =
    useRouter();

  const pathname =
    usePathname();

  const [
    open,
    setOpen,
  ] =
    useState(false);

  const [
    unreadCount,
    setUnreadCount,
  ] =
    useState(0);

  const [
    notifications,
    setNotifications,
  ] =
    useState<
      NotificationItem[]
    >([]);

  async function load() {
    try {
      const response =
        await fetch(
          "/api/notifications",
          {
            cache:
              "no-store",
          }
        );

      const data =
        await response.json();

      if (
        response.ok &&
        data.success
      ) {
        setUnreadCount(
          data.unreadCount ||
            0
        );

        setNotifications(
          data.notifications ||
            []
        );
      }
    } catch {
      // Bell should not break
      // the rest of the portal.
    }
  }

  useEffect(() => {
    load();
  }, [pathname]);

  async function markRead(
    noticeId: string
  ) {
    await fetch(
      "/api/notifications/read",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify({
            noticeId,
          }),
      }
    );

    setNotifications(
      (current) =>
        current.map(
          (item) =>
            item.id ===
            noticeId
              ? {
                  ...item,
                  isRead:
                    true,
                }
              : item
        )
    );

    setUnreadCount(
      (current) =>
        Math.max(
          current - 1,
          0
        )
    );
  }

  async function markAllRead() {
    await fetch(
      "/api/notifications/read",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify({
            all: true,
          }),
      }
    );

    setNotifications(
      (current) =>
        current.map(
          (item) => ({
            ...item,
            isRead:
              true,
          })
        )
    );

    setUnreadCount(0);
  }

  async function openNotification(
    item: NotificationItem
  ) {
    if (!item.isRead) {
      await markRead(
        item.id
      );
    }

    setOpen(false);

    router.push(
      "/portal/notices"
    );
  }

  return (
    <div className="notification-bell-wrap">
      <button
        type="button"
        className="notification-bell-button"
        onClick={() =>
          setOpen(
            (current) =>
              !current
          )
        }
      >
        <span className="notification-bell-icon">
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>

        <span>
          Notifications
        </span>

        {unreadCount >
          0 && (
          <strong className="notification-count">
            {unreadCount >
            99
              ? "99+"
              : unreadCount}
          </strong>
        )}
      </button>

      {open && (
        <div className="notification-dropdown">
          <header>
            <div>
              <span>
                NOTIFICATIONS
              </span>

              <strong>
                Recent updates
              </strong>
            </div>

            {unreadCount >
              0 && (
              <button
                type="button"
                onClick={
                  markAllRead
                }
              >
                Mark all read
              </button>
            )}
          </header>

          {notifications.length ===
          0 ? (
            <div className="notification-empty">
              No notifications.
            </div>
          ) : (
            <div className="notification-list">
              {notifications
                .slice(0, 8)
                .map(
                  (
                    item
                  ) => (
                    <button
                      type="button"
                      key={
                        item.id
                      }
                      className={
                        item.isRead
                          ? "notification-item"
                          : "notification-item unread"
                      }
                      onClick={() =>
                        openNotification(
                          item
                        )
                      }
                    >
                      <span className="notification-item-dot" />

                      <div>
                        <div className="notification-item-meta">
                          <span>
                            {
                              item.category
                            }
                          </span>

                          <span>
                            {
                              item.audience
                            }
                          </span>
                        </div>

                        <strong>
                          {
                            item.title
                          }
                        </strong>

                        <p>
                          {
                            item.description
                          }
                        </p>

                        <small>
                          {
                            item.postedBy
                          }{" "}
                          ·{" "}
                          {formatDate(
                            item.publishedAt
                          )}
                        </small>
                      </div>
                    </button>
                  )
                )}
            </div>
          )}

          <footer>
            <button
              type="button"
              onClick={() => {
                setOpen(false);

                router.push(
                  "/portal/notices"
                );
              }}
            >
              Open Notice Board →
            </button>
          </footer>
        </div>
      )}
    </div>
  );
}
