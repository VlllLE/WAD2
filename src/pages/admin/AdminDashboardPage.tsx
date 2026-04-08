import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { requireSupabase } from "../../lib/supabase";

type CourseRow = {
  id: string;
  name: string;
  is_published: boolean;
};

export function AdminDashboardPage() {
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const loadGenRef = useRef(0);

  const load = useCallback(async (opts?: { quiet?: boolean }) => {
    const id = ++loadGenRef.current;
    if (!opts?.quiet) {
      setLoading(true);
      setError(null);
    }
    try {
      const { data, error: qErr } = await requireSupabase()
        .from("courses")
        .select("id, name, is_published")
        .order("created_at", { ascending: false });
      if (id !== loadGenRef.current) return;
      if (qErr) setError(qErr.message);
      else setError(null);
      setCourses(data ?? []);
    } catch (e) {
      if (id === loadGenRef.current) setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      if (id === loadGenRef.current && !opts?.quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const createCourse = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    setMessage(null);
    try {
      const { error } = await requireSupabase().from("courses").insert({
        name: newName.trim(),
        is_published: false,
      });
      if (error) throw error;
      setNewName("");
      setMessage("Course created (draft).");
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not create");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid">
      <section className="card">
        <div className="cardHeader">
          <h1 className="h1">Admin</h1>
          <div className="muted">Create and manage courses, classes, and users</div>
        </div>

        <div className="row" style={{ justifyContent: "space-between" }}>
          <div className="row">
            <input
              className="input"
              style={{ minWidth: 260 }}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New course name"
            />
            <button className="button buttonPrimary" disabled={busy} onClick={() => void createCourse()}>
              {busy ? "Creating…" : "Create course"}
            </button>
          </div>
          <Link className="pill" to="/admin/users">
            Manage users
          </Link>
        </div>

        {loading ? <div className="muted">Loading…</div> : null}
        {error ? <div className="muted">Error: {error}</div> : null}
        {message ? <div className="muted">{message}</div> : null}

        <div className="stack">
          {courses.map((c) => (
            <div key={c.id} className="card" style={{ boxShadow: "none" }}>
              <div className="cardHeader">
                <h2 className="h2">{c.name}</h2>
                <div className="muted">{c.is_published ? "Published" : "Draft"}</div>
              </div>
              <div className="muted">
                <Link className="pill" to={`/admin/courses/${c.id}`}>
                  Edit course & sessions
                </Link>
              </div>
            </div>
          ))}
          {!loading && courses.length === 0 ? <div className="muted">No courses yet.</div> : null}
        </div>
      </section>
    </div>
  );
}
