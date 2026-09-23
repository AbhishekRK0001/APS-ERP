"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          identifier,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.message || "Unable to sign in.");
        return;
      }

      router.push("/portal");
      router.refresh();
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <div className="login-brand">
        <a href="/" className="college-brand">
          <div className="college-emblem">EC</div>

          <div className="college-brand-text">
            <strong>Engineering College</strong>
            <span>Academic Portal</span>
          </div>
        </a>
      </div>

      <section className="login-panel">
        <div className="login-card">
          <p className="page-eyebrow">
            COLLEGE PORTAL
          </p>

          <h1>Welcome back.</h1>

          <p className="login-intro">
            Sign in using your registered college account.
          </p>

          <form
            className="login-form"
            onSubmit={handleSubmit}
          >
            <label>
              College ID or email

              <input
                type="text"
                value={identifier}
                onChange={(event) =>
                  setIdentifier(event.target.value)
                }
                placeholder="Enter college ID or email"
                autoComplete="username"
                required
              />
            </label>

            <label>
              Password

              <input
                type="password"
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                placeholder="Enter your password"
                autoComplete="current-password"
                required
              />
            </label>

            {error && (
              <div className="login-error">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="login-submit"
              disabled={loading}
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <p className="login-help">
            Having trouble signing in? Contact your college administrator.
          </p>
        </div>
      </section>
    </main>
  );
}
