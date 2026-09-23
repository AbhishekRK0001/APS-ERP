"use client";

import {
  useEffect,
  useState,
} from "react";

type Transition = {
  semester: number;
  count: number;
};

type Cycle = {
  _id: string;
  academicYear: string;
  cycleType: "ODD" | "EVEN";
  startDate: string;
  endDate: string;
};

type PreviewData = {
  success: boolean;
  currentCycle: Cycle | null;
  totalStudents: number;
  transitions: Transition[];
};

function nextSemesterLabel(
  semester: number
) {
  if (semester === 8) {
    return "Completed";
  }

  const next =
    semester + 1;

  const yearChanges =
    [2, 4, 6].includes(semester);

  return yearChanges
    ? `Semester ${next} + Next Year`
    : `Semester ${next}`;
}

function formatDate(
  value?: string
) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat(
    "en-IN",
    {
      day: "numeric",
      month: "long",
      year: "numeric",
    }
  ).format(
    new Date(value)
  );
}

export default function AcademicCycleManager() {
  const [
    data,
    setData,
  ] =
    useState<PreviewData | null>(
      null
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    advancing,
    setAdvancing,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    success,
    setSuccess,
  ] =
    useState("");

  async function loadPreview() {
    setLoading(true);
    setError("");

    try {
      const response =
        await fetch(
          "/api/academic-cycle/preview",
          {
            cache: "no-store",
          }
        );

      const result =
        await response.json();

      if (
        !response.ok ||
        !result.success
      ) {
        setError(
          result.message ||
            "Unable to load academic cycle."
        );

        return;
      }

      setData(result);
    } catch {
      setError(
        "Unable to load academic cycle."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPreview();
  }, []);

  async function advanceCycle() {
    if (
      !data?.currentCycle
    ) {
      return;
    }

    const confirmation =
      window.confirm(
        "This will advance every active student to the next semester. Semester 8 students will be marked completed. Continue?"
      );

    if (!confirmation) {
      return;
    }

    setAdvancing(true);
    setError("");
    setSuccess("");

    try {
      const response =
        await fetch(
          "/api/academic-cycle/advance",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                cycleId:
                  data.currentCycle._id,
              }),
          }
        );

      const result =
        await response.json();

      if (
        !response.ok ||
        !result.success
      ) {
        setError(
          result.message ||
            "Unable to advance academic cycle."
        );

        return;
      }

      setSuccess(
        `${result.advanced} students advanced. ${result.completed} students completed their degree.`
      );

      await loadPreview();
    } catch {
      setError(
        "Unable to advance academic cycle."
      );
    } finally {
      setAdvancing(false);
    }
  }

  if (loading) {
    return (
      <div className="portal-empty">
        Loading academic cycle...
      </div>
    );
  }

  if (!data?.currentCycle) {
    return (
      <div className="portal-empty">
        <h2>
          No active academic cycle
        </h2>

        <p>
          Create an active academic cycle
          before advancing students.
        </p>
      </div>
    );
  }

  const activeTransitions =
    data.transitions.filter(
      (item) =>
        item.count > 0
    );

  return (
    <div className="cycle-manager">
      <section className="cycle-current">
        <div>
          <span>
            CURRENT CYCLE
          </span>

          <h2>
            {
              data.currentCycle
                .academicYear
            }
          </h2>

          <p>
            {
              data.currentCycle
                .cycleType
            }{" "}
            Semester Cycle
          </p>
        </div>

        <div className="cycle-dates">
          <div>
            <span>
              Started
            </span>

            <strong>
              {formatDate(
                data.currentCycle
                  .startDate
              )}
            </strong>
          </div>

          <div>
            <span>
              Ends
            </span>

            <strong>
              {formatDate(
                data.currentCycle
                  .endDate
              )}
            </strong>
          </div>

          <div>
            <span>
              Active Students
            </span>

            <strong>
              {
                data.totalStudents
              }
            </strong>
          </div>
        </div>
      </section>

      <section className="cycle-preview">
        <div className="cycle-section-heading">
          <div>
            <span>
              ADVANCEMENT PREVIEW
            </span>

            <h2>
              Student transitions
            </h2>
          </div>

          <p>
            Department and section
            assignments will remain
            unchanged.
          </p>
        </div>

        {activeTransitions.length ===
        0 ? (
          <div className="portal-empty">
            No active students to
            advance.
          </div>
        ) : (
          <div className="transition-list">
            {activeTransitions.map(
              (item) => (
                <div
                  className="transition-row"
                  key={
                    item.semester
                  }
                >
                  <div>
                    <span>
                      Semester{" "}
                      {
                        item.semester
                      }
                    </span>

                    <strong>
                      {
                        nextSemesterLabel(
                          item.semester
                        )
                      }
                    </strong>
                  </div>

                  <span className="transition-count">
                    {item.count}{" "}
                    {item.count === 1
                      ? "student"
                      : "students"}
                  </span>
                </div>
              )
            )}
          </div>
        )}
      </section>

      <section className="cycle-warning">
        <strong>
          Important
        </strong>

        <p>
          This operation updates
          student semester and year
          information. Semester 8
          students will be marked as
          completed.
        </p>
      </section>

      {error && (
        <div className="login-error">
          {error}
        </div>
      )}

      {success && (
        <div className="notice-success">
          {success}
        </div>
      )}

      <div className="cycle-actions">
        <button
          type="button"
          disabled={
            advancing ||
            data.totalStudents === 0
          }
          onClick={
            advanceCycle
          }
        >
          {advancing
            ? "Advancing..."
            : "Advance Academic Cycle"}
        </button>
      </div>
    </div>
  );
}
