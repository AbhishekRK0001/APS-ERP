import { useState } from "react";
import api, { message } from "../api";
import {
  Heading,
  useData,
  Alert,
  Field,
  Select,
  Badge,
  Action,
  Empty,
  managers,
  editors,
} from "../ui";
export default function Notices({ user }) {
  const [tab, setTab] = useState("published"),
    [scope, setScope] = useState("SECTION"),
    [error, setError] = useState(""),
    [info, setInfo] = useState(""),
    [busy, setBusy] = useState(false),
    [attachments, setAttachments] = useState([]);
  const notices = useData(
    "/notices" +
      (tab === "mine" ? "/mine" : tab === "pending" ? "/pending" : ""),
  );
  const sections = useData("/sections"),
    departments = useData("/departments");
  const writer = editors.includes(user.role),
    reviewer = managers.includes(user.role) || user.role === "hod";
  const teacher = ["teacher", "class_teacher"].includes(user.role);
  async function create(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = e.target;
    const b = Object.fromEntries(new FormData(form));
    for (const key of [
      "publishAt",
      "expiresAt",
      "eventDate",
      "dueDate",
      "registrationDeadline",
    ]) {
      if (b[key]) b[key] = new Date(b[key]).toISOString();
    }
    for (const k of ["isPinned", "showInTicker", "requestApproval"])
      b[k] = b[k] === "on";
    try {
      const r = await api.post("/notices", { ...b, attachments });
      setInfo(r.data.message);
      setAttachments([]);
      form.reset();
      setTab("mine");
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Heading title="Campus noticeboard" eyebrow="WHAT’S HAPPENING AT APS">
        {writer && (
          <button className="button" onClick={() => setTab("create")}>
            + Create notice
          </button>
        )}
      </Heading>
      <div className="tabs">
        {[
          ["published", "Published notices"],
          ...(writer ? [["mine", "My notices"]] : []),
          ...(reviewer ? [["pending", "Awaiting approval"]] : []),
        ].map(([key, name]) => (
          <button
            className={tab === key ? "active" : ""}
            key={key}
            onClick={() => setTab(key)}
          >
            {name}
          </button>
        ))}
      </div>
      <Alert>
        {error || notices.error || sections.error || departments.error}
      </Alert>
      {info && <p className="success">{info}</p>}
      {tab === "create" ? (
        <section className="card">
          <h2>Share a campus update</h2>
          <form className="form-grid" onSubmit={create}>
            <Field label="Title" name="title" required maxLength={200} />
            <Select label="Type" name="type">
              {[
                "GENERAL",
                "IMPORTANT",
                "EVENT",
                "ASSIGNMENT_REMINDER",
                "TEST",
                "EXAM",
              ].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </Select>
            <Field label="Description">
              <textarea
                name="description"
                rows={5}
                required
                maxLength={10000}
              />
            </Field>
            <Select label="Category" name="category">
              {[
                "GENERAL",
                "ACADEMIC",
                "TECHNICAL",
                "CULTURAL",
                "SPORTS",
                "PLACEMENT",
                "CLUB",
                "DEPARTMENT",
              ].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </Select>
            <Select
              label="Audience"
              name="scope"
              value={scope}
              onChange={(e) => setScope(e.target.value)}
            >
              {(teacher
                ? ["SECTION"]
                : user.role === "hod"
                  ? ["SECTION", "DEPARTMENT"]
                  : ["SECTION", "DEPARTMENT", "COLLEGE"]
              ).map((x) => (
                <option key={x}>{x}</option>
              ))}
            </Select>
            {scope === "SECTION" && (
              <Select label="Section" name="sectionId" required>
                <option value="">Choose section</option>
                {sections.data
                  ?.filter(
                    (s) =>
                      user.role !== "hod" ||
                      String(s.departmentId?._id || s.departmentId) ===
                        String(user.departmentId),
                  )
                  .map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name}
                    </option>
                  ))}
              </Select>
            )}
            {scope === "DEPARTMENT" && (
              <Select label="Department" name="departmentId" required>
                <option value="">Choose department</option>
                {departments.data
                  ?.filter(
                    (d) => user.role !== "hod" || d._id === user.departmentId,
                  )
                  .map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.name}
                    </option>
                  ))}
              </Select>
            )}
            <Select label="Priority" name="priority">
              {["NORMAL", "LOW", "HIGH", "URGENT"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </Select>
            <Field
              label="Publish at · optional"
              name="publishAt"
              type="datetime-local"
            />
            <Field
              label="Expires at · optional"
              name="expiresAt"
              type="datetime-local"
            />
            <Field label="Event date" name="eventDate" type="datetime-local" />
            <Field label="Due date" name="dueDate" type="datetime-local" />
            <Field
              label="Registration deadline"
              name="registrationDeadline"
              type="datetime-local"
            />
            <Field
              label="Target semester · optional"
              name="targetSemester"
              type="number"
              min="1"
              max="8"
            />
            <Field
              label="Target year · optional"
              name="targetYear"
              type="number"
              min="1"
              max="4"
            />
            <Field label="Action URL" name="actionUrl" type="url" />
            <Select label="Action label" name="actionLabel">
              {[
                "NONE",
                "REGISTER",
                "APPLY",
                "JOIN",
                "VIEW_DETAILS",
                "DOWNLOAD",
              ].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </Select>
            <Field label="Attachment · PDF or image, up to 8 MB">
              <input
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp"
                onChange={async (e) => {
                  const file = e.target.files[0];
                  if (!file) return;
                  setBusy(true);
                  try {
                    const f = new FormData();
                    f.append("file", file);
                    const r = await api.post("/uploads/notices", f);
                    setAttachments((items) => [...items, r.data]);
                  } catch (e) {
                    setError(message(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            </Field>
            <div className="chips">
              {attachments.map((a) => (
                <span className="badge" key={a.url}>
                  {a.name}
                </span>
              ))}
            </div>
            <label className="check">
              <input type="checkbox" name="isPinned" /> Pin notice
            </label>
            <label className="check">
              <input type="checkbox" name="showInTicker" /> Include in ticker
            </label>
            {writer && (
              <label className="check">
                <input type="checkbox" name="requestApproval" /> Request review
                by another authorized manager
              </label>
            )}
            <div className="form-end">
              <button className="button" disabled={busy}>
                {busy ? "Saving…" : "Publish / send for approval"}
              </button>
            </div>
          </form>
        </section>
      ) : notices.data?.length ? (
        <div className="notice-grid">
          {notices.data.map((n) => (
            <article className="card notice" key={n._id}>
              <div className="section-title">
                <Badge>{n.category}</Badge>
                <small>{n.isPinned ? "PINNED" : n.scope}</small>
              </div>
              <h2>{n.title}</h2>
              <p className="pre-line">{n.description}</p>
              <small className="muted">
                {n.postedBy?.name} ·{" "}
                {new Date(n.publishAt).toLocaleDateString("en-IN")}
              </small>
              {n.eventDate && (
                <p>Event: {new Date(n.eventDate).toLocaleString("en-IN")}</p>
              )}
              {n.dueDate && (
                <p>Due: {new Date(n.dueDate).toLocaleString("en-IN")}</p>
              )}
              {n.actionUrl && (
                <p>
                  <a href={n.actionUrl} target="_blank" rel="noreferrer">
                    {n.actionLabel.replaceAll("_", " ")} ↗
                  </a>
                </p>
              )}
              {n.attachments.map((a) => (
                <p key={a.url}>
                  <a href={a.url} target="_blank" rel="noreferrer">
                    ↗ {a.name}
                  </a>
                </p>
              ))}
              {tab !== "published" && <Badge>{n.approvalStatus}</Badge>}
              {writer &&
                (user.role !== "hod" ||
                  String(n.departmentId?._id || n.departmentId) ===
                    String(user.departmentId)) && (
                  <details>
                    <summary>Edit notice</summary>
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        try {
                          const b = Object.fromEntries(new FormData(e.target));
                          await api.patch(`/notices/${n._id}`, {
                            ...b,
                            isPinned: b.isPinned === "on",
                          });
                          notices.refresh();
                          setInfo("Notice updated.");
                        } catch (e) {
                          setError(message(e));
                        }
                      }}
                    >
                      <Field
                        label="Title"
                        name="title"
                        defaultValue={n.title}
                        required
                        maxLength={200}
                      />
                      <Field label="Description">
                        <textarea
                          name="description"
                          defaultValue={n.description}
                          required
                          maxLength={10000}
                        />
                      </Field>
                      <label className="check">
                        <input
                          name="isPinned"
                          type="checkbox"
                          defaultChecked={n.isPinned}
                        />
                        Pin notice
                      </label>
                      <div className="inline-actions">
                        <button className="button">Save changes</button>
                        <Action
                          className="button secondary"
                          run={async () => {
                            if (window.confirm("Delete this notice?"))
                              await api.delete(`/notices/${n._id}`);
                          }}
                          onDone={notices.refresh}
                        >
                          Delete notice
                        </Action>
                      </div>
                    </form>
                  </details>
                )}

              {n.rejectionReason && <Alert>{n.rejectionReason}</Alert>}
              {tab === "pending" && (
                <div className="inline-actions">
                  <Action
                    run={() =>
                      api.post(`/notices/${n._id}/approval`, {
                        action: "APPROVE",
                      })
                    }
                    onDone={notices.refresh}
                  >
                    Approve
                  </Action>
                  <Action
                    className="button secondary"
                    run={async () => {
                      const reason = window.prompt("Reason for rejection");
                      if (reason)
                        await api.post(`/notices/${n._id}/approval`, {
                          action: "REJECT",
                          reason,
                        });
                    }}
                    onDone={notices.refresh}
                  >
                    Reject
                  </Action>
                </div>
              )}
            </article>
          ))}
        </div>
      ) : (
        <Empty>No notices in this view yet.</Empty>
      )}
    </>
  );
}
