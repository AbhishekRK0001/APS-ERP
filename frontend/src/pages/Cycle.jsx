import { useState } from "react";
import api, { message } from "../api";
import { Heading, useData, Field, Select, Alert, Action } from "../ui";
export default function Cycle() {
  const { data, error, refresh } = useData("/academic-cycle/preview");
  const [msg, setMsg] = useState("");
  return (
    <>
      <Heading title="Academic cycle" />
      <Alert>{error || msg}</Alert>
      <section className="card">
        {data?.currentCycle ? (
          <>
            <h2>
              {data.currentCycle.academicYear} · {data.currentCycle.cycleType}{" "}
              semester
            </h2>
            <p>
              {data.students.length} active students. Advancing increments
              semesters and marks semester-eight students as alumni.
            </p>
            <p>
              Students’ section assignments are cleared so old class notices do
              not reach their new cohort. Assign their new sections after
              advancement.
            </p>
            <Action
              run={async () => {
                if (
                  window.confirm(
                    "Advance the academic cycle for all active students?",
                  )
                ) {
                  const r = await api.post("/academic-cycle/advance", {
                    cycleId: data.currentCycle._id,
                  });
                  setMsg(r.data.message);
                }
              }}
              onDone={refresh}
            >
              Advance academic cycle
            </Action>
          </>
        ) : (
          <>
            <h2>Initialize academic cycle</h2>
            <form
              className="form-grid"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await api.post(
                    "/academic-cycle/initialize",
                    Object.fromEntries(new FormData(e.target)),
                  );
                  refresh();
                } catch (e) {
                  setMsg(message(e));
                }
              }}
            >
              <Field
                label="Academic year"
                name="academicYear"
                placeholder="2026-27"
                pattern="[0-9]{4}-[0-9]{2}"
                required
              />
              <Select label="Cycle" name="cycleType">
                <option>ODD</option>
                <option>EVEN</option>
              </Select>
              <Field label="Start date" type="date" name="startDate" required />
              <Field label="End date" type="date" name="endDate" required />
              <button className="button">Initialize cycle</button>
            </form>
          </>
        )}
      </section>
    </>
  );
}
