import { useState } from "react";
import api, { message } from "../api";
import { Alert, Field } from "../ui";
export default function Login({ onLogin, initialError }) {
  const [mode, setMode] = useState("login"),
    [error, setError] = useState(initialError),
    [info, setInfo] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setInfo("");
    const b = Object.fromEntries(new FormData(e.target));
    try {
      if (mode === "login")
        onLogin((await api.post("/auth/login", b)).data.user);
      else
        setInfo(
          (
            await api.post(
              mode === "request"
                ? "/auth/activation/request"
                : "/auth/activation/verify",
              b,
            )
          ).data.message,
        );
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-layout">
      <section className="login-story">
        <div className="brand">
          <b>A</b>
          <span>
            APS<span>Campus workspace</span>
          </span>
        </div>
        <div>
          <small>LESS ADMIN. MORE CAMPUS.</small>
          <h1>
            A connected
            <br />
            day starts here.
          </h1>
          <p>
            Classes, people and campus updates.
            <br />
            Everything you need, in one place.
          </p>
          <div className="orbit">
            <span>YOUR CAMPUS</span>
            <b>Timetables</b>
            <b>People</b>
            <b>Notices</b>
            <b>Leave</b>
          </div>
        </div>
        <small>APS ERP · Built for the way your campus works</small>
      </section>
      <section className="login-form">
        <small>WELCOME TO APS</small>
        <h2>
          {mode === "login"
            ? "Sign in to your workspace"
            : mode === "request"
              ? "First time here?"
              : "Activate your account"}
        </h2>
        <p className="muted">
          {mode === "login"
            ? "Use your college account to continue."
            : "Your administrator must create your account first."}
        </p>
        <form onSubmit={submit}>
          <Field
            label="Email or college ID"
            name="identifier"
            required
            autoComplete="username"
          />
          {mode === "login" ? (
            <Field
              label="Password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
            />
          ) : mode === "verify" ? (
            <>
              <Field
                label="Six-digit activation code"
                name="otp"
                inputMode="numeric"
                pattern="[0-9]{6}"
                required
              />
              <Field
                label="New password · at least 12 characters"
                name="newPassword"
                type="password"
                minLength={12}
                maxLength={128}
                required
                autoComplete="new-password"
              />
            </>
          ) : null}
          <Alert>{error}</Alert>
          {info && (
            <p className="success" role="status">
              {info}
            </p>
          )}
          <button className="button primary" disabled={busy}>
            {busy
              ? "Please wait…"
              : mode === "login"
                ? "Sign in →"
                : mode === "request"
                  ? "Send activation code"
                  : "Activate account"}
          </button>
        </form>
        <div className="login-links">
          {["login", "request", "verify"]
            .filter((m) => m !== mode)
            .map((m) => (
              <button
                className="ghost"
                key={m}
                onClick={() => {
                  setMode(m);
                  setError("");
                  setInfo("");
                }}
              >
                {m === "login"
                  ? "Back to sign in"
                  : m === "request"
                    ? "First-time activation"
                    : "I have an activation code"}
              </button>
            ))}
        </div>
        <small className="muted">
          Need access? Contact your campus administrator.
        </small>
      </section>
    </div>
  );
}
