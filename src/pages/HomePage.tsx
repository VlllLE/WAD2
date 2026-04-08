import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { formatDateTime } from "../lib/format";
import { isCourseCurrentOrUpcoming } from "../lib/courseSchedule";
import { requireSupabase } from "../lib/supabase";

type CourseRow = {
  id: string;
  name: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
};

type SessionRow = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  location: string;
  course_id: string;
};

type UpcomingRow = {
  id: string;
  courseId: string;
  courseName: string;
  title: string;
  starts_at: string;
  ends_at: string;
  location: string;
};

const UPCOMING_PREVIEW_LIMIT = 24;
/** Only fetch near-future sessions; RLS still hides unpublished courses. */
const FUTURE_SESSIONS_CAP = 200;

export function HomePage() {
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [futureSessions, setFutureSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchIdRef = useRef(0);

  useEffect(() => {
    const id = ++fetchIdRef.current;
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const sb = requireSupabase();
        const nowIso = new Date().toISOString();

        const [coursesRes, sessionsRes] = await Promise.all([
          sb
            .from("courses")
            .select("id, name, description, start_date, end_date")
            .eq("is_published", true)
            .order("start_date", { ascending: true, nullsFirst: false }),
          sb
            .from("class_sessions")
            .select("id, title, starts_at, ends_at, location, course_id")
            .gte("ends_at", nowIso)
            .order("starts_at", { ascending: true })
            .limit(FUTURE_SESSIONS_CAP),
        ]);

        if (!active || id !== fetchIdRef.current) return;
        if (coursesRes.error) setError(coursesRes.error.message);
        else if (sessionsRes.error) setError(sessionsRes.error.message);
        setCourses((coursesRes.data as CourseRow[]) ?? []);
        setFutureSessions((sessionsRes.data as SessionRow[]) ?? []);
      } catch (e) {
        if (active && id === fetchIdRef.current) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (active && id === fetchIdRef.current) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const courseNameById = useMemo(() => new Map(courses.map((c) => [c.id, c.name])), [courses]);

  const sessionsByCourseId = useMemo(() => {
    const m = new Map<string, SessionRow[]>();
    for (const s of futureSessions) {
      const list = m.get(s.course_id) ?? [];
      list.push(s);
      m.set(s.course_id, list);
    }
    return m;
  }, [futureSessions]);

  const { activeCourses, upcomingRows, uniqueLocations } = useMemo(() => {
    const active = courses.filter((c) =>
      isCourseCurrentOrUpcoming(c, sessionsByCourseId.get(c.id) ?? []),
    );

    const rows: UpcomingRow[] = futureSessions.map((s) => ({
      id: s.id,
      courseId: s.course_id,
      courseName: courseNameById.get(s.course_id) ?? "Course",
      title: s.title,
      starts_at: s.starts_at,
      ends_at: s.ends_at,
      location: s.location,
    }));
    const sliced = rows.slice(0, UPCOMING_PREVIEW_LIMIT);

    const locs = new Set<string>();
    for (const s of futureSessions) {
      if (s.location.trim()) locs.add(s.location.trim());
    }

    return { activeCourses: active, upcomingRows: sliced, uniqueLocations: [...locs].sort() };
  }, [courses, futureSessions, sessionsByCourseId, courseNameById]);

  return (
    <div className="grid">
      <section className="card cardHalf">
        <div className="cardHeader">
          <h1 className="h1">Welcome</h1>
        </div>
        <div className="stack">
          <div className="muted">
            <strong>Yoga & Mindfulness Studio</strong> - a calm, supportive space for weekly classes
            and occasional weekend workshops, open to all levels of fitness and ability.
          </div>
          <div className="muted">
            Browse the current & upcoming courses, see dates, times, venues, and prices, then sign in to book.
          </div>
        </div>
      </section>

      <section className="card cardHalf">
        <div className="cardHeader">
          <h2 className="h2">Locations</h2>
        </div>
        <div className="stack">
          {loading ? <div className="muted">Loading venues…</div> : null}
          {error ? <div className="muted">Error: {error}</div> : null}
          {!loading && !error && uniqueLocations.length === 0 ? (
            <div className="muted">Venues are listed on each class when sessions are published.</div>
          ) : null}
          {!loading && uniqueLocations.length > 0 ? (
            <ul className="stack" style={{ margin: 0, paddingLeft: 18 }}>
              {uniqueLocations.map((loc) => (
                <li key={loc} className="muted">
                  {loc}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>

      <section className="card">
        <div className="cardHeader">
          <h2 className="h2">Current & upcoming courses</h2>
          <div className="muted">{activeCourses.length} course{activeCourses.length === 1 ? "" : "s"}</div>
        </div>
        {loading ? <div className="muted">Loading…</div> : null}
        <div className="stack">
          {activeCourses.map((c) => (
            <div key={c.id} className="card" style={{ boxShadow: "none", background: "rgba(255,255,255,0.06)" }}>
              <div className="cardHeader">
                <h3 className="h2" style={{ margin: 0 }}>
                  <Link to={`/courses/${c.id}`}>{c.name}</Link>
                </h3>
                <div className="muted">
                  {c.start_date ?? "TBC"} → {c.end_date ?? "TBC"}
                </div>
              </div>
              <div className="muted">{c.description ?? "No description yet."}</div>
            </div>
          ))}
          {!loading && activeCourses.length === 0 ? (
            <div className="muted">No current or upcoming courses right now. Check back soon.</div>
          ) : null}
        </div>
      </section>

      <section className="card">
        <div className="cardHeader">
          <h2 className="h2">Upcoming classes</h2>
          <div className="muted">Next sessions (date, time, venue)</div>
        </div>
        {loading ? <div className="muted">Loading…</div> : null}
        <div className="stack">
          {upcomingRows.map((r) => (
            <div key={r.id} className="card" style={{ boxShadow: "none", background: "rgba(255,255,255,0.06)" }}>
              <div className="cardHeader">
                <h3 className="h2" style={{ margin: 0 }}>
                  <Link to={`/courses/${r.courseId}`}>{r.title}</Link>
                </h3>
                <div className="muted">{r.courseName}</div>
              </div>
              <div className="muted">
                {formatDateTime(r.starts_at)} – {formatDateTime(r.ends_at)}
              </div>
              <div className="muted">{r.location}</div>
            </div>
          ))}
          {!loading && upcomingRows.length === 0 ? (
            <div className="muted">No upcoming sessions scheduled yet.</div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
