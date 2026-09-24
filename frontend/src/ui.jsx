import { useEffect, useState, useRef, useCallback } from "react";
import api, { message } from "./api";
export const managers = ["super_admin", "admin", "principal"];
export const editors = [...managers, "hod"];
export const staff = ["teacher", "class_teacher", "hod", "principal"];
export const label = (s) =>
  String(s || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
export function useData(path) {
  const [data, setData] = useState(null),
    [error, setError] = useState("");
  const active = useRef(null);
  const refresh = useCallback(() => {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    return api
      .get(path, { signal: controller.signal })
      .then((r) => {
        if (!controller.signal.aborted) {
          setData(r.data);
          setError("");
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(message(e));
      });
  }, [path]);
  useEffect(() => {
    setData(null);
    setError("");
    refresh();
    return () => active.current?.abort();
  }, [refresh]);
  return { data, error, refresh };
}
export function Alert({ children }) {
  return children ? (
    <div className="alert" role="alert">
      {children}
    </div>
  ) : null;
}
export function Empty({ children = "Nothing here yet." }) {
  return (
    <div className="empty">
      <span>◎</span>
      <p>{children}</p>
    </div>
  );
}
export function Heading({ eyebrow = "CAMPUS WORKSPACE", title, children }) {
  return (
    <div className="heading">
      <div>
        <small>{eyebrow}</small>
        <h1>{title}</h1>
      </div>
      {children}
    </div>
  );
}
export function Badge({ children }) {
  return <span className="badge">{label(children)}</span>;
}
export function Field({ label: caption, children, ...props }) {
  return (
    <label className="field">
      <span>{caption}</span>
      {children || <input {...props} />}
    </label>
  );
}
export function Select({ label: caption, children, ...props }) {
  return (
    <Field label={caption}>
      <select {...props}>{children}</select>
    </Field>
  );
}
export function Loading({ error }) {
  return error ? (
    <Alert>{error}</Alert>
  ) : (
    <p className="muted">Loading your workspace…</p>
  );
}
export function Action({ run, children, className = "button", onDone }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <>
      <button
        type="button"
        className={className}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            await run();
            onDone?.();
          } catch (e) {
            setError(message(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Working…" : children}
      </button>
      <Alert>{error}</Alert>
    </>
  );
}
