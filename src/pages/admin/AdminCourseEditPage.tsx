import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { formatDateTime, formatMoneyGBP } from "../../lib/format";
import { requireSupabase } from "../../lib/supabase";

type Course = {
  id: string;
  name: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  is_published: boolean;
};

type Session = {
  id: string;
  course_id: string;
  starts_at: string;
  ends_at: string;
  title: string;
  description: string | null;
  location: string;
  price_pence: number;
};

type BookingRow = {
  id: string;
  created_at: string;
  user_id: string;
  profiles: { full_name: string | null } | null;
};

export function AdminCourseEditPage() {
  const { courseId } = useParams();
  const [course, setCourse] = useState<Course | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    starts_at: "",
    ends_at: "",
    location: "",
    price_pence: 0,
    description: "",
  });

  const [classListSessionId, setClassListSessionId] = useState<string | null>(null);
  const [classList, setClassList] = useState<BookingRow[]>([]);
  const [classListBusy, setClassListBusy] = useState(false);

  /** Bumps when session list is refetched after a mutation; stale initial-load responses must not overwrite. */
  const sessionReloadIdRef = useRef(0);
  const initialLoadGenRef = useRef(0);

  const resetSessionForm = () => {
    setEditingSessionId(null);
    setForm({
      title: "",
      starts_at: "",
      ends_at: "",
      location: "",
      price_pence: 0,
      description: "",
    });
  };

  const reloadSessionsOnly = useCallback(async () => {
    if (!courseId) return;
    const id = ++sessionReloadIdRef.current;
    const { data: s, error: se } = await requireSupabase()
      .from("class_sessions")
      .select("id, course_id, starts_at, ends_at, title, description, location, price_pence")
      .eq("course_id", courseId)
      .order("starts_at", { ascending: true });
    if (id !== sessionReloadIdRef.current) return;
    if (se) setError(se.message);
    else setSessions(s ?? []);
  }, [courseId]);

  useEffect(() => {
    let active = true;
    const loadGen = ++initialLoadGenRef.current;

    (async () => {
      if (!courseId) {
        setCourse(null);
        setSessions([]);
        setLoading(false);
        return;
      }

      sessionReloadIdRef.current = 0;
      const sessionEpochAtLoadStart = sessionReloadIdRef.current;

      setLoading(true);
      setError(null);
      setMessage(null);

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

        if (!active || loadGen !== initialLoadGenRef.current) return;

        if (courseRes.error) setError(courseRes.error.message);
        else setCourse(courseRes.data ?? null);

        if (sessionsRes.error) setError(sessionsRes.error.message);
        else if (sessionReloadIdRef.current === sessionEpochAtLoadStart) {
          setSessions(sessionsRes.data ?? []);
        }
      } catch (e) {
        if (active && loadGen === initialLoadGenRef.current) {
          setError(e instanceof Error ? e.message : "Failed to load");
        }
      } finally {
        if (active && loadGen === initialLoadGenRef.current) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [courseId]);

  const canSubmitSession = useMemo(() => {
    return Boolean(form.title.trim() && form.starts_at && form.ends_at && form.location.trim());
  }, [form]);

  /** Field saves (blur): do not full-reload or set page loading — avoids stuck spinners and races. */
  const saveCourse = async (patch: Partial<Course>) => {
    if (!courseId) return;
    setMessage(null);
    setError(null);
    try {
      const { error } = await requireSupabase().from("courses").update(patch).eq("id", courseId);
      if (error) throw error;
      setCourse((prev) => (prev ? { ...prev, ...patch } : null));
      setMessage("Saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    }
  };

  const deleteCourse = async () => {
    if (!courseId) return;
    if (!confirm("Delete this course and all its sessions?")) return;
    setMessage(null);
    setError(null);
    try {
      const { error } = await requireSupabase().from("courses").delete().eq("id", courseId);
      if (error) throw error;
      window.location.href = "/admin";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete");
    }
  };

  const startEditSession = (s: Session) => {
    setEditingSessionId(s.id);
    setForm({
      title: s.title,
      starts_at: s.starts_at.slice(0, 16),
      ends_at: s.ends_at.slice(0, 16),
      location: s.location,
      price_pence: s.price_pence,
      description: s.description ?? "",
    });
  };

  const upsertSession = async () => {
    if (!courseId || !canSubmitSession) return;
    setMessage(null);
    setError(null);
    try {
      const payload = {
        course_id: courseId,
        title: form.title.trim(),
        starts_at: new Date(form.starts_at).toISOString(),
        ends_at: new Date(form.ends_at).toISOString(),
        location: form.location.trim(),
        price_pence: Number.isFinite(form.price_pence) ? Math.max(0, Math.round(form.price_pence)) : 0,
        description: form.description.trim() || null,
      };

      const q = editingSessionId
        ? requireSupabase().from("class_sessions").update(payload).eq("id", editingSessionId)
        : requireSupabase().from("class_sessions").insert(payload);

      const { error } = await q;
      if (error) throw error;
      setMessage(editingSessionId ? "Session updated." : "Session created.");
      resetSessionForm();
      await reloadSessionsOnly();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save session");
    }
  };

  const deleteSession = async (id: string) => {
    if (!confirm("Delete this class session?")) return;
    setMessage(null);
    setError(null);
    try {
      const { error } = await requireSupabase().from("class_sessions").delete().eq("id", id);
      if (error) throw error;
      setMessage("Session deleted.");
      if (editingSessionId === id) resetSessionForm();
      await reloadSessionsOnly();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete session");
    }
  };

  const loadClassList = async (sessionId: string) => {
    setClassListSessionId(sessionId);
    setClassListBusy(true);
    setError(null);
    try {
      const { data, error } = await requireSupabase()
        .from("bookings")
        .select("id, created_at, user_id, profiles(full_name)")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      setClassList((data as unknown as BookingRow[]) ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load class list");
    } finally {
      setClassListBusy(false);
    }
  };

  return (
    <div className="grid">
      <section className="card">
        <div className="cardHeader">
          <h1 className="h1">Edit course</h1>
          <div className="row">
            <Link className="pill" to="/admin">
              Back
            </Link>
            <button className="pill pillDanger" onClick={() => void deleteCourse()}>
              Delete course
            </button>
          </div>
        </div>

        {loading ? <div className="muted">Loading…</div> : null}
        {error ? <div className="muted">Error: {error}</div> : null}
        {message ? <div className="muted">{message}</div> : null}

        {course ? (
          <div className="stack">
            <label className="stack">
              <div className="muted">Course name</div>
              <input
                className="input"
                value={course.name}
                onChange={(e) => setCourse({ ...course, name: e.target.value })}
                onBlur={(e) => void saveCourse({ name: e.target.value })}
              />
            </label>

            <label className="stack">
              <div className="muted">Description</div>
              <textarea
                className="input"
                style={{ minHeight: 90, resize: "vertical" }}
                value={course.description ?? ""}
                onChange={(e) => setCourse({ ...course, description: e.target.value })}
                onBlur={(e) => void saveCourse({ description: e.target.value.trim() || null })}
              />
            </label>

            <div className="row">
              <label className="stack" style={{ minWidth: 220 }}>
                <div className="muted">Start date</div>
                <input
                  className="input"
                  type="date"
                  value={course.start_date ?? ""}
                  onChange={(e) => setCourse({ ...course, start_date: e.target.value || null })}
                  onBlur={(e) => void saveCourse({ start_date: e.target.value || null })}
                />
              </label>
              <label className="stack" style={{ minWidth: 220 }}>
                <div className="muted">End date</div>
                <input
                  className="input"
                  type="date"
                  value={course.end_date ?? ""}
                  onChange={(e) => setCourse({ ...course, end_date: e.target.value || null })}
                  onBlur={(e) => void saveCourse({ end_date: e.target.value || null })}
                />
              </label>
              <button
                className="button buttonPrimary"
                onClick={() => void saveCourse({ is_published: !course.is_published })}
              >
                {course.is_published ? "Unpublish" : "Publish"}
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="card">
        <div className="cardHeader">
          <h2 className="h2">Sessions</h2>
          <div className="muted">Add / edit / delete classes</div>
        </div>

        <div className="grid">
          <div className="card cardHalf" style={{ boxShadow: "none" }}>
            <div className="cardHeader">
              <h3 className="h2" style={{ margin: 0 }}>
                {editingSessionId ? "Edit session" : "New session"}
              </h3>
              {editingSessionId ? (
                <button className="pill" onClick={() => resetSessionForm()}>
                  Cancel
                </button>
              ) : null}
            </div>

            <div className="stack">
              <label className="stack">
                <div className="muted">Title</div>
                <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </label>
              <div className="row">
                <label className="stack" style={{ minWidth: 220 }}>
                  <div className="muted">Starts</div>
                  <input
                    className="input"
                    type="datetime-local"
                    value={form.starts_at}
                    onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
                  />
                </label>
                <label className="stack" style={{ minWidth: 220 }}>
                  <div className="muted">Ends</div>
                  <input
                    className="input"
                    type="datetime-local"
                    value={form.ends_at}
                    onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
                  />
                </label>
              </div>
              <label className="stack">
                <div className="muted">Location</div>
                <input
                  className="input"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                />
              </label>
              <label className="stack">
                <div className="muted">Price (pence)</div>
                <input
                  className="input"
                  inputMode="numeric"
                  value={String(form.price_pence)}
                  onChange={(e) => setForm({ ...form, price_pence: Number(e.target.value) })}
                />
                <div className="muted">Preview: {formatMoneyGBP(Math.max(0, Math.round(form.price_pence || 0)))}</div>
              </label>
              <label className="stack">
                <div className="muted">Description</div>
                <textarea
                  className="input"
                  style={{ minHeight: 90, resize: "vertical" }}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </label>
              <button
                className="button buttonPrimary"
                disabled={!canSubmitSession || loading}
                onClick={() => void upsertSession()}
              >
                {editingSessionId ? "Save changes" : "Create session"}
              </button>
            </div>
          </div>

          <div className="card cardHalf" style={{ boxShadow: "none" }}>
            <div className="cardHeader">
              <h3 className="h2" style={{ margin: 0 }}>
                Existing sessions
              </h3>
              <div className="muted">{sessions.length}</div>
            </div>

            <div className="stack">
              {sessions.map((s) => (
                <div key={s.id} className="card" style={{ boxShadow: "none", background: "rgba(255,255,255,0.06)" }}>
                  <div className="cardHeader">
                    <h4 className="h2" style={{ margin: 0 }}>
                      {s.title}
                    </h4>
                    <div className="muted">{formatMoneyGBP(s.price_pence)}</div>
                  </div>
                  <div className="muted">
                    {formatDateTime(s.starts_at)} – {formatDateTime(s.ends_at)}
                  </div>
                  <div className="muted">{s.location}</div>
                  <div className="row" style={{ marginTop: 10 }}>
                    <button className="pill pillPrimary" onClick={() => startEditSession(s)}>
                      Edit
                    </button>
                    <button className="pill" onClick={() => void loadClassList(s.id)}>
                      Class list
                    </button>
                    <button className="pill pillDanger" onClick={() => void deleteSession(s.id)}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
              {sessions.length === 0 ? <div className="muted">No sessions yet.</div> : null}
            </div>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="cardHeader">
          <h2 className="h2">Class list</h2>
          <div className="muted">
            {classListSessionId ? `Session ${classListSessionId}` : "Pick a session above"}
          </div>
        </div>
        {classListBusy ? <div className="muted">Loading class list…</div> : null}
        <div className="stack">
          {classList.map((b) => (
            <div key={b.id} className="card" style={{ boxShadow: "none" }}>
              <div className="muted">
                {b.profiles?.full_name ?? "(no name)"} — {b.user_id}
              </div>
            </div>
          ))}
          {classListSessionId && !classListBusy && classList.length === 0 ? (
            <div className="muted">No bookings yet for this session.</div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
