import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { requireSupabase } from "../../lib/supabase";

type ProfileRow = {
  user_id: string;
  full_name: string | null;
  is_organiser: boolean;
  created_at: string;
};

export function AdminUsersPage() {
  const [items, setItems] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const loadGenRef = useRef(0);

  const load = useCallback(async (opts?: { quiet?: boolean }) => {
    const id = ++loadGenRef.current;
    if (!opts?.quiet) {
      setLoading(true);
      setError(null);
    }
    try {
      const { data, error: profErr } = await requireSupabase()
        .from("profiles")
        .select("user_id, full_name, is_organiser, created_at")
        .order("created_at", { ascending: false });
      if (id !== loadGenRef.current) return;
      if (profErr) setError(profErr.message);
      else setError(null);
      setItems(data ?? []);
    } catch (e) {
      if (id === loadGenRef.current) setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      if (id === loadGenRef.current && !opts?.quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const saveFullName = async (row: ProfileRow, fullName: string) => {
    setBusyId(row.user_id);
    setMessage(null);
    setError(null);
    try {
      const { error } = await requireSupabase()
        .from("profiles")
        .update({ full_name: fullName.trim() || null })
        .eq("user_id", row.user_id);
      if (error) throw error;
      setMessage("Name saved.");
      await load({ quiet: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save name");
    } finally {
      setBusyId(null);
    }
  };

  const toggleOrganiser = async (row: ProfileRow) => {
    setMessage(null);
    setError(null);
    try {
      const { error } = await requireSupabase()
        .from("profiles")
        .update({ is_organiser: !row.is_organiser })
        .eq("user_id", row.user_id);
      if (error) throw error;
      setMessage("Role updated.");
      await load({ quiet: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update role");
    }
  };

  return (
    <div className="grid">
      <section className="card">
        <div className="cardHeader">
          <h1 className="h1">Manage users</h1>
          <Link className="pill" to="/admin">
            Back
          </Link>
        </div>

        <div className="muted">
          New sign-ups use the login page (Need an account?). Here you can edit names (shown on class lists) and grant or
          revoke organiser access.
        </div>

        {loading ? <div className="muted">Loading…</div> : null}
        {error ? <div className="muted">Error: {error}</div> : null}
        {message ? <div className="muted">{message}</div> : null}

        <div className="stack">
          {items.map((p) => (
            <UserCard
              key={p.user_id}
              row={p}
              busy={busyId === p.user_id}
              onSaveName={(name) => void saveFullName(p, name)}
              onToggleOrganiser={() => void toggleOrganiser(p)}
            />
          ))}
          {!loading && items.length === 0 ? <div className="muted">No users yet.</div> : null}
        </div>
      </section>
    </div>
  );
}

function UserCard({
  row,
  busy,
  onSaveName,
  onToggleOrganiser,
}: {
  row: ProfileRow;
  busy: boolean;
  onSaveName: (name: string) => void;
  onToggleOrganiser: () => void;
}) {
  const [fullName, setFullName] = useState(row.full_name ?? "");

  useEffect(() => {
    setFullName(row.full_name ?? "");
  }, [row.user_id, row.full_name]);

  return (
    <div className="card" style={{ boxShadow: "none" }}>
      <div className="cardHeader">
        <h2 className="h2">{row.full_name || "(no name)"}</h2>
        <div className="muted">{row.is_organiser ? "Organiser" : "User"}</div>
      </div>
      <div className="muted" style={{ wordBreak: "break-all" }}>
        User id: {row.user_id}
      </div>

      <div className="stack" style={{ marginTop: 12 }}>
        <label className="stack">
          <div className="muted">Full name</div>
          <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
            <input className="input" style={{ minWidth: 200, flex: 1 }} value={fullName} onChange={(e) => setFullName(e.target.value)} />
            <button className="pill pillPrimary" disabled={busy} onClick={() => onSaveName(fullName)}>
              Save name
            </button>
          </div>
        </label>
      </div>

      <div className="row" style={{ marginTop: 12, flexWrap: "wrap", gap: 8 }}>
        <button className="pill pillPrimary" disabled={busy} onClick={onToggleOrganiser}>
          {row.is_organiser ? "Remove organiser" : "Make organiser"}
        </button>
      </div>
    </div>
  );
}
