import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { formatCourseDuration, isCourseCurrentOrUpcoming } from "../lib/courseSchedule";
import { requireSupabase } from "../lib/supabase";

type CourseRow = {
  id: string;
  name: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  is_published: boolean;
  class_sessions: { ends_at: string }[] | null;
};

export function CoursesPage() {
  const [courses, setCourses] = useState<CourseRow[]>([]);
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

        const { data: courseList, error: courseErr } = await sb
          .from("courses")
          .select("id, name, description, start_date, end_date, is_published")
          .eq("is_published", true)
          .order("start_date", { ascending: true, nullsFirst: false });

        if (!active || id !== fetchIdRef.current) return;
        if (courseErr) {
          setError(courseErr.message);
          setCourses([]);
          return;
        }

        const list = courseList ?? [];
        const ids = list.map((c) => c.id);
        const endsByCourse = new Map<string, { ends_at: string }[]>();

        if (ids.length > 0) {
          const { data: sessRows, error: sessErr } = await sb
            .from("class_sessions")
            .select("course_id, ends_at")
            .in("course_id", ids);
          if (!active || id !== fetchIdRef.current) return;
          if (sessErr) setError(sessErr.message);
          for (const row of sessRows ?? []) {
            const cid = row.course_id as string;
            const arr = endsByCourse.get(cid) ?? [];
            arr.push({ ends_at: row.ends_at as string });
            endsByCourse.set(cid, arr);
          }
        }

        if (!active || id !== fetchIdRef.current) return;
        setCourses(
          list.map((c) => ({
            ...c,
            class_sessions: endsByCourse.get(c.id) ?? [],
          })),
        );
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

  const visible = useMemo(() => {
    return courses.filter((c) => isCourseCurrentOrUpcoming(c, c.class_sessions ?? []));
  }, [courses]);

  return (
    <div className="grid">
      <section className="card">
        <div className="cardHeader">
          <h1 className="h1">Current & upcoming courses</h1>
          <div className="muted">Weekly blocks and weekend workshops</div>
        </div>

        {loading ? <div className="muted">Loading…</div> : null}
        {error ? <div className="muted">Error: {error}</div> : null}

        <div className="stack">
          {visible.map((c) => (
            <Link key={c.id} to={`/courses/${c.id}`} className="card" style={{ boxShadow: "none" }}>
              <div className="cardHeader">
                <h2 className="h2">{c.name}</h2>
                <div className="muted">
                  {c.start_date ?? "TBC"} → {c.end_date ?? "TBC"}
                </div>
              </div>
              {formatCourseDuration(c.start_date, c.end_date) ? (
                <div className="muted">Duration: {formatCourseDuration(c.start_date, c.end_date)}</div>
              ) : null}
              <div className="muted">{c.description ?? "No description yet."}</div>
            </Link>
          ))}
          {!loading && visible.length === 0 ? (
            <div className="muted">No current or upcoming courses right now.</div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
