"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type Attachment = {
  name: string;
  url: string;
  mimeType?: string;
  size?: number;
};

type FeedItem = {
  id: string;
  title: string;
  description: string;
  type: string;
  category: string;
  postStyle: string;
  priority: string;
  scope: string;
  audience: string;

  targetYear?: number | null;
  targetSemester?: number | null;

  postedBy?: {
    id?: string;
    name?: string;
    role?: string;
  } | null;

  publishAt?: string | null;
  dueDate?: string | null;
  eventDate?: string | null;
  registrationDeadline?: string | null;

  actionLabel?: string;
  actionUrl?: string | null;

  attachments?: Attachment[];

  isPinned?: boolean;
};

type TickerItem = {
  id: string;
  title: string;
  headline: string;
  category: string;
  priority: string;
  audience: string;
  deadlineType: string;
  deadline?: string | null;
  actionLabel?: string;
  actionUrl?: string | null;
};

type Props = {
  role: string;
  name: string;
};

const categories = [
  ["ALL", "All"],
  ["GENERAL", "General"],
  ["ACADEMIC", "Academic"],
  ["TECHNICAL", "Technical"],
  ["CULTURAL", "Cultural"],
  ["SPORTS", "Sports"],
  ["PLACEMENT", "Placement"],
  ["CLUB", "Clubs"],
];

function formatDate(
  value?: string | null
) {
  if (!value) return "";

  return new Intl.DateTimeFormat(
    "en-IN",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  ).format(new Date(value));
}

function formatDateTime(
  value?: string | null
) {
  if (!value) return "";

  return new Intl.DateTimeFormat(
    "en-IN",
    {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    }
  ).format(new Date(value));
}

function pretty(value?: string) {
  if (!value) return "";

  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase()
    );
}

function getImage(
  attachments?: Attachment[]
) {
  return attachments?.find(
    (attachment) =>
      attachment.mimeType?.startsWith(
        "image/"
      )
  );
}

function getPdf(
  attachments?: Attachment[]
) {
  return attachments?.find(
    (attachment) =>
      attachment.mimeType ===
      "application/pdf"
  );
}

function getDeadlineText(
  item: FeedItem
) {
  if (item.registrationDeadline) {
    return `Registration closes ${formatDateTime(
      item.registrationDeadline
    )}`;
  }

  if (item.dueDate) {
    return `Due ${formatDateTime(
      item.dueDate
    )}`;
  }

  if (item.eventDate) {
    return `Event ${formatDateTime(
      item.eventDate
    )}`;
  }

  return "";
}

function FeedCard({
  item,
}: {
  item: FeedItem;
}) {
  const image =
    getImage(item.attachments);

  const pdf =
    getPdf(item.attachments);

  const deadline =
    getDeadlineText(item);

  return (
    <article className="campus-post">
      <header className="campus-post-header">
        <div className="campus-post-avatar">
          {item.postedBy?.name
            ?.charAt(0)
            .toUpperCase() || "C"}
        </div>

        <div className="campus-post-author">
          <strong>
            {item.postedBy?.name ||
              "College Administration"}
          </strong>

          <span>
            {item.audience} ·{" "}
            {formatDate(
              item.publishAt
            )}
          </span>
        </div>

        {item.isPinned && (
          <span className="campus-pinned">
            PINNED
          </span>
        )}
      </header>

      <div className="campus-post-tags">
        <span>
          {pretty(
            item.category ||
              "GENERAL"
          )}
        </span>

        <span>
          {item.audience}
        </span>

        {(item.priority === "HIGH" ||
          item.priority === "URGENT") && (
          <span className="important">
            {item.priority}
          </span>
        )}
      </div>

      <h2>{item.title}</h2>

      <p className="campus-post-description">
        {item.description}
      </p>

      {image && (
        <a
          className="campus-poster"
          href={image.url}
          target="_blank"
          rel="noreferrer"
        >
          <img
            src={image.url}
            alt={image.name}
          />
        </a>
      )}

      {(deadline ||
        item.targetYear ||
        item.targetSemester) && (
        <div className="campus-post-information">
          {deadline && (
            <div className="campus-deadline">
              <span>
                DEADLINE / EVENT
              </span>

              <strong>
                {deadline}
              </strong>
            </div>
          )}

          {item.targetYear && (
            <div>
              <span>YEAR</span>

              <strong>
                Year{" "}
                {item.targetYear}
              </strong>
            </div>
          )}

          {item.targetSemester && (
            <div>
              <span>
                SEMESTER
              </span>

              <strong>
                Semester{" "}
                {item.targetSemester}
              </strong>
            </div>
          )}
        </div>
      )}

      {(pdf ||
        (item.actionLabel &&
          item.actionLabel !==
            "NONE" &&
          item.actionUrl)) && (
        <footer className="campus-post-actions">
          {pdf && (
            <a
              href={pdf.url}
              target="_blank"
              rel="noreferrer"
              className="campus-secondary-action"
            >
              View Document
            </a>
          )}

          {item.actionLabel &&
            item.actionLabel !==
              "NONE" &&
            item.actionUrl && (
              <a
                href={
                  item.actionUrl
                }
                target="_blank"
                rel="noreferrer"
                className="campus-primary-action"
              >
                {pretty(
                  item.actionLabel
                )}
              </a>
            )}
        </footer>
      )}
    </article>
  );
}

export default function CampusHome({
  role,
  name,
}: Props) {
  const [
    category,
    setCategory,
  ] = useState("ALL");

  const [
    channel,
    setChannel,
  ] = useState("all");

  const [
    feed,
    setFeed,
  ] = useState<FeedItem[]>([]);

  const [
    ticker,
    setTicker,
  ] = useState<TickerItem[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const firstName =
    name?.trim().split(" ")[0] ||
    name;

  const student =
    role === "STUDENT";

  const classLabel =
    student
      ? "My Bunker"
      : "My Classes";

  const loadFeed =
    useCallback(async () => {
      setLoading(true);
      setError("");

      try {
        const params =
          new URLSearchParams();

        params.set(
          "category",
          category
        );

        params.set(
          "channel",
          channel
        );

        params.set(
          "limit",
          "30"
        );

        const response =
          await fetch(
            `/api/feed?${params.toString()}`,
            {
              cache: "no-store",
            }
          );

        const data =
          await response.json();

        if (
          !response.ok ||
          !data.success
        ) {
          setError(
            data.message ||
              "Unable to load campus feed."
          );

          return;
        }

        setFeed(data.feed || []);
      } catch {
        setError(
          "Unable to load campus feed."
        );
      } finally {
        setLoading(false);
      }
    }, [category, channel]);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  useEffect(() => {
    async function loadTicker() {
      try {
        const response =
          await fetch(
            "/api/ticker",
            {
              cache: "no-store",
            }
          );

        const data =
          await response.json();

        if (
          response.ok &&
          data.success
        ) {
          setTicker(
            data.ticker || []
          );
        }
      } catch {
        // ticker failure should not
        // break the homepage
      }
    }

    loadTicker();
  }, []);

  const featured =
    useMemo(() => {
      return (
        feed.find(
          (item) =>
            item.isPinned &&
            getImage(
              item.attachments
            )
        ) ||
        feed.find(
          (item) =>
            item.postStyle ===
              "POSTER" &&
            getImage(
              item.attachments
            )
        ) ||
        null
      );
    }, [feed]);

  const regularFeed =
    featured
      ? feed.filter(
          (item) =>
            item.id !==
            featured.id
        )
      : feed;

  return (
    <main className="campus-home campus-home-v2">
      {ticker.length > 0 && (
        <section className="live-radar">
          <div className="live-radar-label">
            <span className="live-dot" />
            LIVE
          </div>

          <div className="live-radar-track">
            <div className="live-radar-content">
              {[
                ...ticker,
                ...ticker,
              ].map(
                (
                  item,
                  index
                ) => (
                  <span
                    className="live-radar-item"
                    key={`${item.id}-${index}`}
                  >
                    <strong>
                      {
                        item.headline
                      }
                    </strong>

                    {item.deadline && (
                      <span>
                        {formatDateTime(
                          item.deadline
                        )}
                      </span>
                    )}

                    <i>•</i>
                  </span>
                )
              )}
            </div>
          </div>
        </section>
      )}

      <header className="campus-home-header campus-home-header-v2">
        <div>
          <p className="page-eyebrow">
            COLLEGE HOME
          </p>

          <h1>
            Welcome back
            {firstName
              ? `, ${firstName}`
              : ""}
            .
          </h1>

          <p>
            College, department and
            class updates in one place.
          </p>
        </div>

        <span className="campus-role-pill">
          {role}
        </span>
      </header>

      <section className="campus-channel-strip">
        {[
          ["all", "For You"],
          ["college", "College"],
          [
            "department",
            "My Department",
          ],
          ["class", classLabel],
        ].map(
          ([value, label]) => (
            <button
              type="button"
              key={value}
              className={
                channel === value
                  ? "campus-channel active"
                  : "campus-channel"
              }
              onClick={() =>
                setChannel(value)
              }
            >
              {label}
            </button>
          )
        )}
      </section>

      <section className="campus-category-strip">
        {categories.map(
          ([value, label]) => (
            <button
              type="button"
              key={value}
              className={
                category === value
                  ? "campus-category-chip active"
                  : "campus-category-chip"
              }
              onClick={() =>
                setCategory(value)
              }
            >
              {label}
            </button>
          )
        )}
      </section>

      {error && (
        <div className="login-error">
          {error}
        </div>
      )}

      {loading ? (
        <div className="campus-feed-empty">
          Loading campus updates...
        </div>
      ) : (
        <>
          {featured && (
            <section className="campus-featured-section">
              <div className="campus-section-title">
                <div>
                  <span>
                    FEATURED
                  </span>

                  <h2>
                    Happening now
                  </h2>
                </div>
              </div>

              <div className="campus-featured-card">
                <div className="campus-featured-image">
                  <img
                    src={
                      getImage(
                        featured.attachments
                      )?.url
                    }
                    alt={
                      getImage(
                        featured.attachments
                      )?.name ||
                      featured.title
                    }
                  />
                </div>

                <div className="campus-featured-content">
                  <div className="campus-post-tags">
                    <span>
                      {pretty(
                        featured.category
                      )}
                    </span>

                    <span>
                      {
                        featured.audience
                      }
                    </span>
                  </div>

                  <h2>
                    {
                      featured.title
                    }
                  </h2>

                  <p>
                    {
                      featured.description
                    }
                  </p>

                  {getDeadlineText(
                    featured
                  ) && (
                    <div className="featured-deadline">
                      <span>
                        IMPORTANT DATE
                      </span>

                      <strong>
                        {getDeadlineText(
                          featured
                        )}
                      </strong>
                    </div>
                  )}

                  {featured.actionLabel &&
                    featured.actionLabel !==
                      "NONE" &&
                    featured.actionUrl && (
                      <a
                        href={
                          featured.actionUrl
                        }
                        target="_blank"
                        rel="noreferrer"
                        className="campus-primary-action featured-action"
                      >
                        {pretty(
                          featured.actionLabel
                        )}
                      </a>
                    )}
                </div>
              </div>
            </section>
          )}

          <div className="campus-content-v2">
            <section className="campus-feed-column">
              <div className="campus-section-title">
                <div>
                  <span>
                    CAMPUS FEED
                  </span>

                  <h2>
                    Latest updates
                  </h2>
                </div>

                <p>
                  {regularFeed.length}{" "}
                  {regularFeed.length ===
                  1
                    ? "post"
                    : "posts"}
                </p>
              </div>

              {regularFeed.length ===
              0 ? (
                <div className="campus-feed-empty">
                  <h2>
                    Nothing here yet.
                  </h2>

                  <p>
                    New updates matching
                    your filters will
                    appear here.
                  </p>
                </div>
              ) : (
                <div className="campus-post-list">
                  {regularFeed.map(
                    (item) => (
                      <FeedCard
                        item={item}
                        key={item.id}
                      />
                    )
                  )}
                </div>
              )}
            </section>

            <aside className="campus-side-summary">
              <section className="deadline-radar-card">
                <span className="campus-filter-title">
                  DEADLINE RADAR
                </span>

                <h2>
                  Coming up
                </h2>

                {ticker.length ===
                0 ? (
                  <p className="campus-muted">
                    No upcoming
                    deadlines.
                  </p>
                ) : (
                  <div className="radar-list">
                    {ticker
                      .slice(0, 6)
                      .map(
                        (item) => (
                          <div
                            className="radar-item"
                            key={
                              item.id
                            }
                          >
                            <span>
                              {
                                item.category
                              }
                          </span>

                            <strong>
                              {
                                item.title
                              }
                            </strong>

                            {item.deadline && (
                              <p>
                                {item.deadlineType ===
                                "REGISTRATION"
                                  ? "Registration closes "
                                  : "Due "}

                                {formatDate(
                                  item.deadline
                                )}
                              </p>
                            )}
                          </div>
                        )
                      )}
                  </div>
                )}

                <a
                  className="radar-view-all"
                  href="/portal/upcoming"
                >
                  View all upcoming →
                </a>
              </section>

              <section className="campus-help-card">
                <span>
                  NOTIFICATION CENTRE
                </span>

                <h3>
                  Your formal notices
                </h3>

                <p>
                  Separate College,
                  Department and Bunker
                  announcements.
                </p>

                <a href="/portal/notices">
                  Open Notice Board →
                </a>
              </section>
            </aside>
          </div>
        </>
      )}
    </main>
  );
}
