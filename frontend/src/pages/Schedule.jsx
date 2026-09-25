import { useData, Heading, Empty, Loading } from "../ui";
import TimetableGrid from "../modules/timetable/components/TimetableGrid";
export default function Schedule({ user }) {
  const { data, error } = useData("/schedule/my");
  if (!data) return <Loading error={error} />;
  return (
    <>
      <Heading title="My timetable" />
      <p className="muted">
        Your schedule is read directly from the saved campus timetable. Times
        use the campus local clock.
      </p>
      {user.role === "student" ? (
        data.length ? (
          data.map((tt) => (
            <section className="card" key={tt._id}>
              <h3>{tt.sectionId?.name}</h3>
              <TimetableGrid data={tt.grid} workingPeriod={tt.workingPeriod} />
            </section>
          ))
        ) : (
          <Empty>No timetable is assigned to your section yet.</Empty>
        )
      ) : data.days?.some((d) => d.periods.length) ? (
        <div className="day-grid">
          {data.days.map((d) => (
            <section className="card" key={d.dayOfWeek}>
              <h3>{d.dayOfWeek}</h3>
              {d.periods.length ? (
                d.periods.map((p, i) => (
                  <div className="period" key={i}>
                    <small>
                      {p.startTime}–{p.endTime}
                    </small>
                    <strong>{p.subject}</strong>
                    <span>{p.classLabel}</span>
                    <small className="muted">
                      {p.validFrom} — {p.validTo}
                    </small>
                  </div>
                ))
              ) : (
                <p className="muted">No classes</p>
              )}
            </section>
          ))}
        </div>
      ) : (
        <Empty>
          No timetable is assigned yet. An administrator needs to link your
          staff account and save a timetable.
        </Empty>
      )}
    </>
  );
}
