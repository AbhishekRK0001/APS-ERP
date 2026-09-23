"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Department = {
  id: string;
  name: string;
  code: string;
};

type Section = {
  id: string;
  name: string;
  departmentId: string;
};

type Props = {
  role: string;
  departmentId?: string | null;
  departments: Department[];
  sections: Section[];
};

export default function CreateNoticeForm({
  role,
  departmentId,
  departments,
  sections,
}: Props) {
  const router = useRouter();

  const teacher = role === "TEACHER";
  const hod = role === "HOD";

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [type, setType] = useState("GENERAL");
  const [category, setCategory] = useState("GENERAL");
  const [postStyle, setPostStyle] = useState("NOTICE");
  const [priority, setPriority] = useState("NORMAL");

  const [scope, setScope] = useState(
    teacher ? "SECTION" : hod ? "DEPARTMENT" : "COLLEGE"
  );

  const [selectedDepartment, setSelectedDepartment] =
    useState(departmentId || "");

  const [selectedSection, setSelectedSection] = useState("");

  const [targetYear, setTargetYear] = useState("");
  const [targetSemester, setTargetSemester] = useState("");

  const [dueDate, setDueDate] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [registrationDeadline, setRegistrationDeadline] =
    useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const [actionLabel, setActionLabel] = useState("NONE");
  const [actionUrl, setActionUrl] = useState("");

  const [showInFeed, setShowInFeed] = useState(true);
  const [showInTicker, setShowInTicker] = useState(false);
  const [isPinned, setIsPinned] = useState(false);

  const [requestApproval, setRequestApproval] = useState(false);

  const [attachment, setAttachment] =
    useState<File | null>(null);

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const academicType = [
    "ASSIGNMENT_REMINDER",
    "TEST",
    "EXAM",
  ].includes(type);

  const eventLike =
    type === "EVENT" ||
    postStyle === "EVENT" ||
    postStyle === "POSTER" ||
    [
      "TECHNICAL",
      "CULTURAL",
      "SPORTS",
      "PLACEMENT",
      "CLUB",
    ].includes(category);

  const autoApprovalRequired =
    teacher && ["TEST", "EXAM"].includes(type);

  const needsHodApproval =
    autoApprovalRequired ||
    (teacher && requestApproval);

  const tickerRelevant =
    Boolean(
      dueDate ||
        eventDate ||
        registrationDeadline
    ) ||
    ["HIGH", "URGENT"].includes(priority);

  const visibleSections = sections.filter((section) => {
    if (teacher || hod) {
      return true;
    }

    if (!selectedDepartment) {
      return true;
    }

    return section.departmentId === selectedDepartment;
  });

  function handleTypeChange(value: string) {
    setType(value);

    if (
      [
        "ASSIGNMENT_REMINDER",
        "TEST",
        "EXAM",
      ].includes(value)
    ) {
      setCategory("ACADEMIC");
      setPostStyle("NOTICE");
    }

    if (value === "EVENT") {
      setPostStyle("EVENT");
    }
  }

  async function submit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setSaving(true);
    setError("");

    try {
      if (
        actionLabel !== "NONE" &&
        !actionUrl.trim()
      ) {
        setError(
          "Please enter the link for the selected action button."
        );
        return;
      }

      let attachments: Array<{
        name: string;
        url: string;
        mimeType?: string;
        size?: number;
      }> = [];

      if (attachment) {
        const formData = new FormData();

        formData.append("file", attachment);

        const uploadResponse = await fetch(
          "/api/uploads/notices",
          {
            method: "POST",
            body: formData,
          }
        );

        const uploadData =
          await uploadResponse.json();

        if (
          !uploadResponse.ok ||
          !uploadData.success
        ) {
          setError(
            uploadData.message ||
              "Unable to upload the attachment."
          );
          return;
        }

        attachments = [
          uploadData.attachment,
        ];
      }

      const response = await fetch("/api/notices", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          title,
          description,

          type,
          category,
          postStyle,
          priority,

          scope,

          departmentId:
            scope === "COLLEGE"
              ? null
              : selectedDepartment,

          sectionId:
            scope === "SECTION"
              ? selectedSection
              : null,

          targetYear:
            targetYear || null,

          targetSemester:
            targetSemester || null,

          dueDate:
            academicType && dueDate
              ? dueDate
              : null,

          eventDate:
            eventLike && eventDate
              ? eventDate
              : null,

          registrationDeadline:
            eventLike &&
            registrationDeadline
              ? registrationDeadline
              : null,

          expiresAt:
            expiresAt || null,

          actionLabel,

          actionUrl:
            actionLabel === "NONE"
              ? null
              : actionUrl,

          showInFeed,
          showInTicker,
          isPinned,

          requestApproval:
            needsHodApproval,

          attachments,
        }),
      });

      const data = await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        setError(
          data.message ||
            "Unable to submit notice."
        );
        return;
      }

      router.push(
        "/portal/notices/mine"
      );

      router.refresh();
    } catch (error) {
      console.error(error);

      setError(
        "Unable to submit notice."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className="create-notice-form"
      onSubmit={submit}
    >
      <div className="smart-form-note">
        <strong>Create an update</strong>

        <p>
          Choose the notice type first.
          The form will automatically
          show only the fields relevant
          to that kind of update.
        </p>
      </div>

      <section className="form-section">
        <div className="form-section-head">
          <div>
            <span>STEP 1</span>
            <h2>What are you posting?</h2>
          </div>
        </div>

        <div className="form-grid">
          <label>
            Notice Type

            <select
              value={type}
              onChange={(event) =>
                handleTypeChange(
                  event.target.value
                )
              }
            >
              <option value="GENERAL">
                General Notice
              </option>

              <option value="IMPORTANT">
                Important Notice
              </option>

              <option value="EVENT">
                Event
              </option>

              <option value="ASSIGNMENT_REMINDER">
                Assignment Reminder
              </option>

              <option value="TEST">
                Test
              </option>

              <option value="EXAM">
                Examination
              </option>
            </select>
          </label>

          <label>
            Category

            <select
              value={category}
              onChange={(event) =>
                setCategory(
                  event.target.value
                )
              }
            >
              <option value="GENERAL">
                General
              </option>

              <option value="ACADEMIC">
                Academic
              </option>

              <option value="TECHNICAL">
                Technical
              </option>

              <option value="CULTURAL">
                Cultural
              </option>

              <option value="SPORTS">
                Sports
              </option>

              <option value="PLACEMENT">
                Placement
              </option>

              <option value="CLUB">
                Club
              </option>

              <option value="DEPARTMENT">
                Department
              </option>
            </select>
          </label>
        </div>

        <div className="form-grid">
          <label>
            Display Style

            <select
              value={postStyle}
              onChange={(event) =>
                setPostStyle(
                  event.target.value
                )
              }
            >
              <option value="NOTICE">
                Standard Notice
              </option>

              <option value="ANNOUNCEMENT">
                Announcement
              </option>

              <option value="EVENT">
                Event Card
              </option>

              <option value="POSTER">
                Poster Post
              </option>
            </select>
          </label>

          <label>
            Priority

            <select
              value={priority}
              onChange={(event) =>
                setPriority(
                  event.target.value
                )
              }
            >
              <option value="LOW">
                Low
              </option>

              <option value="NORMAL">
                Normal
              </option>

              <option value="HIGH">
                High
              </option>

              <option value="URGENT">
                Urgent
              </option>
            </select>
          </label>
        </div>
      </section>

      <section className="form-section">
        <div className="form-section-head">
          <div>
            <span>STEP 2</span>
            <h2>Content</h2>
          </div>
        </div>

        <label>
          Title

          <input
            value={title}
            onChange={(event) =>
              setTitle(
                event.target.value
              )
            }
            placeholder="Enter a clear title"
            required
          />
        </label>

        <label>
          Description

          <textarea
            value={description}
            onChange={(event) =>
              setDescription(
                event.target.value
              )
            }
            placeholder="Write the announcement..."
            rows={6}
            required
          />
        </label>
      </section>

      <section className="form-section">
        <div className="form-section-head">
          <div>
            <span>STEP 3</span>
            <h2>Who should receive it?</h2>
          </div>
        </div>

        <label>
          Audience

          <select
            value={scope}
            disabled={teacher}
            onChange={(event) => {
              setScope(
                event.target.value
              );

              setSelectedSection("");
            }}
          >
            {!teacher &&
              !hod && (
                <option value="COLLEGE">
                  Entire College
                </option>
              )}

            {!teacher && (
              <option value="DEPARTMENT">
                Department
              </option>
            )}

            <option value="SECTION">
              Class / Bunker
            </option>
          </select>
        </label>

        {scope !== "COLLEGE" &&
          !teacher &&
          !hod && (
            <label>
              Department

              <select
                value={
                  selectedDepartment
                }
                onChange={(event) => {
                  setSelectedDepartment(
                    event.target.value
                  );

                  setSelectedSection("");
                }}
                required
              >
                <option value="">
                  Select Department
                </option>

                {departments.map(
                  (department) => (
                    <option
                      key={
                        department.id
                      }
                      value={
                        department.id
                      }
                    >
                      {
                        department.code
                      }{" "}
                      —{" "}
                      {
                        department.name
                      }
                    </option>
                  )
                )}
              </select>
            </label>
          )}

        {scope === "SECTION" && (
          <label>
            Class / Bunker

            <select
              value={
                selectedSection
              }
              onChange={(event) =>
                setSelectedSection(
                  event.target.value
                )
              }
              required
            >
              <option value="">
                Select Class
              </option>

              {visibleSections.map(
                (section) => (
                  <option
                    key={section.id}
                    value={section.id}
                  >
                    {section.name}
                  </option>
                )
              )}
            </select>
          </label>
        )}

        {scope === "SECTION" && (
          <div className="form-grid">
            <label>
              Year

              <select
                value={targetYear}
                onChange={(event) =>
                  setTargetYear(
                    event.target.value
                )
                }
              >
                <option value="">
                  All Years
                </option>

                <option value="1">
                  1st Year
                </option>

                <option value="2">
                  2nd Year
                </option>

                <option value="3">
                  3rd Year
                </option>

                <option value="4">
                  4th Year
                </option>
              </select>
            </label>

            <label>
              Semester

              <select
                value={
                  targetSemester
                }
                onChange={(event) =>
                  setTargetSemester(
                    event.target.value
                  )
                }
              >
                <option value="">
                  All Semesters
                </option>

                {Array.from({
                  length: 8,
                }).map(
                  (_, index) => (
                    <option
                      key={index + 1}
                      value={index + 1}
                    >
                      Semester{" "}
                      {index + 1}
                    </option>
                  )
                )}
              </select>
            </label>
          </div>
        )}
      </section>

      {academicType && (
        <section className="form-section smart-form-section">
          <div className="form-section-head">
            <div>
              <span>ACADEMIC</span>
              <h2>Academic deadline</h2>
            </div>
          </div>

          <label>
            Due Date

            <input
              type="datetime-local"
              value={dueDate}
              onChange={(event) =>
                setDueDate(
                  event.target.value
                )
              }
            />
          </label>

          <p className="form-helper">
            Use this for assignment
            submissions, tests and
            examinations.
          </p>
        </section>
      )}

      {eventLike && (
        <section className="form-section smart-form-section">
          <div className="form-section-head">
            <div>
              <span>EVENT</span>
              <h2>Event & registration</h2>
            </div>
          </div>

          <div className="form-grid">
            <label>
              Event Date

              <input
                type="datetime-local"
                value={eventDate}
                onChange={(event) =>
                  setEventDate(
                    event.target.value
                  )
                }
              />
            </label>

            <label>
              Registration Deadline

              <input
                type="datetime-local"
                value={
                  registrationDeadline
                }
                onChange={(event) =>
                  setRegistrationDeadline(
                    event.target.value
                  )
                }
              />
            </label>
          </div>

          <div className="form-grid">
            <label>
              Action Button

              <select
                value={actionLabel}
                onChange={(event) =>
                  setActionLabel(
                    event.target.value
                  )
                }
              >
                <option value="NONE">
                  No Button
                </option>

                <option value="REGISTER">
                  Register
                </option>

                <option value="APPLY">
                  Apply
                </option>

                <option value="JOIN">
                  Join
                </option>

                <option value="VIEW_DETAILS">
                  View Details
                </option>

                <option value="DOWNLOAD">
                  Download
                </option>
              </select>
            </label>

            {actionLabel !==
              "NONE" && (
              <label>
                Action Link

                <input
                  type="url"
                  value={actionUrl}
                  onChange={(event) =>
                    setActionUrl(
                      event.target.value
                    )
                  }
                  placeholder="https://..."
                  required
                />
              </label>
            )}
          </div>
        </section>
      )}

      {!eventLike && (
        <section className="form-section">
          <div className="form-section-head">
            <div>
              <span>OPTIONAL</span>
              <h2>Action</h2>
            </div>
          </div>

          <div className="form-grid">
            <label>
              Action Button

              <select
                value={actionLabel}
                onChange={(event) =>
                  setActionLabel(
                    event.target.value
                  )
                }
              >
                <option value="NONE">
                  No Button
                </option>

                <option value="REGISTER">
                  Register
                </option>

                <option value="APPLY">
                  Apply
                </option>

                <option value="JOIN">
                  Join
                </option>

                <option value="VIEW_DETAILS">
                  View Details
                </option>

                <option value="DOWNLOAD">
                  Download
                </option>
              </select>
            </label>

            {actionLabel !==
              "NONE" && (
              <label>
                Action Link

                <input
                  type="url"
                  value={actionUrl}
                  onChange={(event) =>
                    setActionUrl(
                      event.target.value
                    )
                  }
                  placeholder="https://..."
                  required
                />
              </label>
            )}
          </div>
        </section>
      )}

      <section className="form-section">
        <div className="form-section-head">
          <div>
            <span>MEDIA</span>

            <h2>
              {postStyle === "POSTER"
                ? "Poster"
                : "Attachment"}
            </h2>
          </div>
        </div>

        <label>
          {postStyle === "POSTER"
            ? "Upload Poster"
            : "Upload Document or Image"}

          <input
            type="file"
            accept=".pdf,image/jpeg,image/png,image/webp"
            onChange={(event) =>
              setAttachment(
                event.target.files?.[0] ||
                  null
              )
            }
          />
        </label>

        <p className="form-helper">
          PDF, JPG, PNG or WEBP.
          Maximum 8 MB.
        </p>
      </section>

      <section className="form-section">
        <div className="form-section-head">
          <div>
            <span>VISIBILITY</span>
            <h2>Publishing options</h2>
          </div>
        </div>

        <label className="form-checkbox">
          <input
            type="checkbox"
            checked={showInFeed}
            onChange={(event) =>
              setShowInFeed(
                event.target.checked
              )
            }
          />

          Show in Campus Feed
        </label>

        {tickerRelevant && (
          <label className="form-checkbox">
            <input
              type="checkbox"
              checked={showInTicker}
              onChange={(event) =>
                setShowInTicker(
                  event.target.checked
                )
              }
            />

            Show in Live Deadline Radar
          </label>
        )}

        <label className="form-checkbox">
          <input
            type="checkbox"
            checked={isPinned}
            onChange={(event) =>
              setIsPinned(
                event.target.checked
              )
            }
          />

          Pin / feature this update
        </label>

        <label>
          Automatically Remove After

          <input
            type="datetime-local"
            value={expiresAt}
            onChange={(event) =>
              setExpiresAt(
                event.target.value
              )
            }
          />
        </label>
      </section>

      {teacher &&
        !autoApprovalRequired && (
          <section className="form-section">
            <div className="form-section-head">
              <div>
                <span>APPROVAL</span>
                <h2>HOD review</h2>
              </div>
            </div>

            <label className="form-checkbox">
              <input
                type="checkbox"
                checked={
                  requestApproval
                }
                onChange={(event) =>
                  setRequestApproval(
                    event.target.checked
                  )
                }
              />

              Send this notice for HOD
              approval before publishing
            </label>
          </section>
        )}

      {needsHodApproval && (
        <div className="approval-notice">
          <strong>
            HOD approval required
          </strong>

          <p>
            Students will not see this
            notice until your HOD
            approves it.
          </p>
        </div>
      )}

      {error && (
        <div className="login-error">
          {error}
        </div>
      )}

      <div className="form-actions">
        <a href="/portal/notices">
          Cancel
        </a>

        <button
          type="submit"
          disabled={saving}
        >
          {saving
            ? needsHodApproval
              ? "Submitting..."
              : "Publishing..."
            : needsHodApproval
              ? "Submit for HOD Approval"
              : "Publish Update"}
        </button>
      </div>
    </form>
  );
}
