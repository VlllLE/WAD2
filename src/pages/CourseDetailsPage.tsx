import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { formatDateTime, formatMoneyGBP } from "../lib/format";
import { formatCourseDuration, splitSessionsByUpcoming } from "../lib/courseSchedule";
import { requireSupabase } from "../lib/supabase";

type Course = {
  id: string;
  name: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  is_published: boolean;
};

type ClassSession = {
  id: string;
  course_id: string;
  starts_at: string;
  ends_at: string;
  title: string;
  description: string | null;
  location: string;
  price_pence: number;
};

export function CourseDetailsPage() {
  const { courseId } = useParams();
  const { user } = useAuth();

  const [course, setCourse] = useState<Course | null>(null);
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [bookedIds, setBookedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bookingAll, setBookingAll] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const fetchIdRef = useRef(0);

  const canBook = useMemo(() => Boolean(user), [user]);

  const { upcoming, past } = useMemo(() => splitSessionsByUpcoming(sessions), [sessions]);

  const refreshBookings = async () => {
    if (!user || sessions.length === 0) {
      setBookedIds(new Set());
      return;
    }
    const sessionIds = sessions.map((s) => s.id);
    const { data, error } = await requireSupabase()
      .from("bookings")
      .select("session_id")
      .eq("user_id", user.id)
      .in("session_id", sessionIds);
    if (error) throw error;
    setBookedIds(new Set((data ?? []).map((r) => r.session_id)));
  };

  useEffect(() => {
    const id = ++fetchIdRef.current;
    let active = true;
    (async () => {
      if (!courseId) {
        if (id !== fetchIdRef.current) return;
        setCourse(null);
        setSessions([]);
        setBookedIds(new Set());
        setError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      setMessage(null);

      const uid = user?.id;

      try {
        const sb = requireSupabase();
        const [courseRes, sessionsRes] = await Promise.all([
          sb.from("courses").select("id, name, description, start_date, end_date, is_published").eq("id", courseId).maybeSingle(),
          sb
            .from("class_sessions")
            .select("id, course_id, starts_at, ends_at, title, description, location, price_pence")
            .eq("course_id", courseId)
            .order("starts_at", { ascending: true }),
        ]);

        if (!active || id !== fetchIdRef.current) return;

        if (courseRes.error) setError(courseRes.error.message);
        else if (!courseRes.data) setError("Course not found");
        else setCourse(courseRes.data);

        if (sessionsRes.error) setError(sessionsRes.error.message);
        const list = sessionsRes.data ?? [];
        setSessions(list);

        if (uid && list.length > 0) {
          const { data: bookingRows, error: bookingErr } = await sb
            .from("bookings")
            .select("session_id")
            .eq("user_id", uid)
            .in(
              "session_id",
              list.map((s) => s.id),
            );
          if (!active || id !== fetchIdRef.current) return;
          if (bookingErr) setBookedIds(new Set());
          else setBookedIds(new Set((bookingRows ?? []).map((r) => r.session_id)));
        } else {
          setBookedIds(new Set());
        }
      } catch (e) {
        if (active && id === fetchIdRef.current) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (active && id === fetchIdRef.current) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [courseId, user?.id]);

  const bookSession = async (sessionId: string) => {
    if (!user) return;
    setBusyId(sessionId);
    setMessage(null);
    try {
      const { error } = await requireSupabase()
        .from("bookings")
        .insert({ session_id: sessionId, user_id: user.id });
      if (error) throw error;
      setMessage("Booked.");
      await refreshBookings();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not book");
    } finally {
      setBusyId(null);
    }
  };

  const bookAllUpcoming = async () => {
    if (!user) return;
    const targets = upcoming.filter((s) => !bookedIds.has(s.id));
    if (targets.length === 0) {
      setMessage("You are already booked for all upcoming sessions.");
      return;
    }
    setBookingAll(true);
    setMessage(null);
    try {
      let booked = 0;
      for (const s of targets) {
        const { error } = await requireSupabase()
          .from("bookings")
          .insert({ session_id: s.id, user_id: user.id });
        if (error) {
          const code = (error as { code?: string | number }).code;
          if (code === "23505" || code === 23505) continue;
          throw new Error(error.message);
        }
        booked += 1;
      }
      setMessage(
        booked === targets.length
          ? `Booked ${booked} session${booked === 1 ? "" : "s"}.`
          : `Booked ${booked} of ${targets.length} sessions (some were already reserved).`,
      );
      await refreshBookings();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not book all sessions");
    } finally {
      setBookingAll(false);
    }
  };

  const durationLabel = formatCourseDuration(course?.start_date ?? null, course?.end_date ?? null);

  const renderSessionCard = (s: ClassSession) => {
    const isBooked = bookedIds.has(s.id);
    const isPast = new Date(s.ends_at).getTime() < Date.now();
    return (
      <div key={s.id} className="card" style={{ boxShadow: "none", background: "rgba(255,255,255,0.06)" }}>
        <div className="cardHeader">
          <h3 className="h2" style={{ margin: 0 }}>
            {s.title}
          </h3>
          <div className="muted">{formatMoneyGBP(s.price_pence)}</div>
        </div>
        <div className="row">
          <div className="muted">
            {formatDateTime(s.starts_at)} – {formatDateTime(s.ends_at)}
          </div>
          <div className="muted">• {s.location}</div>
        </div>
        {s.description ? <div className="muted">{s.description}</div> : null}

        <div className="row" style={{ marginTop: 10 }}>
          <button
            className="button buttonPrimary"
            disabled={!canBook || busyId === s.id || isPast || isBooked}
            onClick={() => void bookSession(s.id)}
          >
            {isPast ? "Ended" : isBooked ? "Booked" : busyId === s.id ? "Booking…" : "Book this class"}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="grid">
      <section className="card">
        {loading ? <div className="muted">Loading…</div> : null}
        {error ? <div className="muted">Error: {error}</div> : null}
        {course ? (
          <>
            <div className="cardHeader">
              <h1 className="h1">{course.name}</h1>
              <div className="muted">
                {course.start_date ?? "TBC"} → {course.end_date ?? "TBC"}
              </div>
            </div>
            {durationLabel ? <div className="muted">Duration: {durationLabel}</div> : null}
            <div className="muted">{course.description ?? "No description yet."}</div>
          </>
        ) : null}
      </section>

      <section className="card">
        <div className="cardHeader">
          <h2 className="h2">Classes in this course</h2>
          <div className="muted">{canBook ? "Book sessions or the whole upcoming block." : "Sign in to book."}</div>
        </div>

        {canBook && upcoming.some((s) => !bookedIds.has(s.id)) ? (
          <div className="row" style={{ marginBottom: 12 }}>
            <button
              className="button buttonPrimary"
              disabled={bookingAll}
              onClick={() => void bookAllUpcoming()}
            >
              {bookingAll ? "Booking…" : "Book entire course (all upcoming classes)"}
            </button>
          </div>
        ) : null}

        {message ? <div className="muted">{message}</div> : null}

        <div className="stack">
          {upcoming.length > 0 ? (
            <>
              <h3 className="h2" style={{ marginBottom: 0 }}>
                Upcoming
              </h3>
              {upcoming.map((s) => renderSessionCard(s))}
            </>
          ) : null}

          {past.length > 0 ? (
            <>
              <h3 className="h2" style={{ marginBottom: 0 }}>
                Past
              </h3>
              {past.map((s) => renderSessionCard(s))}
            </>
          ) : null}

          {!loading && sessions.length === 0 ? <div className="muted">No sessions yet.</div> : null}
        </div>
      </section>
    </div>
  );
}
