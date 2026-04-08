import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { formatDateTime, formatMoneyGBP } from "../lib/format";
import { requireSupabase } from "../lib/supabase";

type MyBooking = {
  id: string;
  created_at: string;
  class_sessions: {
    id: string;
    title: string;
    starts_at: string;
    ends_at: string;
    location: string;
    price_pence: number;
    courses: { id: string; name: string } | null;
  } | null;
};

export function MyBookingsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<MyBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchIdRef = useRef(0);

  useEffect(() => {
    const id = ++fetchIdRef.current;
    let active = true;
    (async () => {
      if (!user) {
        if (id !== fetchIdRef.current) return;
        setItems([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const { data, error } = await requireSupabase()
          .from("bookings")
          .select(
            "id, created_at, class_sessions(id, title, starts_at, ends_at, location, price_pence, courses(id, name))",
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (!active || id !== fetchIdRef.current) return;
        if (error) setError(error.message);
        setItems((data as unknown as MyBooking[]) ?? []);
      } catch (e) {
        if (active && id === fetchIdRef.current) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (active && id === fetchIdRef.current) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [user?.id]);

  return (
    <div className="grid">
      <section className="card">
        <div className="cardHeader">
          <h1 className="h1">My bookings</h1>
          <div className="muted">Your upcoming classes</div>
        </div>

        {loading ? <div className="muted">Loading…</div> : null}
        {error ? <div className="muted">Error: {error}</div> : null}

        <div className="stack">
          {items.map((b) => (
            <div key={b.id} className="card" style={{ boxShadow: "none" }}>
              <div className="cardHeader">
                <h2 className="h2">{b.class_sessions?.title ?? "Session"}</h2>
                <div className="muted">
                  {b.class_sessions ? formatMoneyGBP(b.class_sessions.price_pence) : null}
                </div>
              </div>
              <div className="muted">{b.class_sessions?.courses?.name ?? "Course"}</div>
              <div className="row">
                {b.class_sessions ? (
                  <div className="muted">
                    {formatDateTime(b.class_sessions.starts_at)} – {formatDateTime(b.class_sessions.ends_at)}
                  </div>
                ) : null}
                <div className="muted">• {b.class_sessions?.location}</div>
              </div>
            </div>
          ))}
          {!loading && items.length === 0 ? <div className="muted">No bookings yet.</div> : null}
        </div>
      </section>
    </div>
  );
}

