import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { requireSupabase } from "../lib/supabase";

export function LoginPage() {
  const nav = useNavigate();
  const loc = useLocation();
  const from = (loc.state as { from?: string } | null)?.from ?? "/courses";

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const title = useMemo(() => (mode === "signin" ? "Sign in" : "Create account"), [mode]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await requireSupabase().auth.signInWithPassword({ email, password });
        if (error) throw error;
        nav(from, { replace: true });
      } else {
        const { error } = await requireSupabase().auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName || null },
          },
        });
        if (error) throw error;
        setMessage("Account created. If email confirmation is enabled, check your inbox.");
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid">
      <section className="card cardHalf">
        <div className="cardHeader">
          <h1 className="h1">{title}</h1>
        </div>

        <form className="stack" onSubmit={(e) => void onSubmit(e)}>
          {mode === "signup" ? (
            <label className="stack">
              <div className="muted">Full name</div>
              <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </label>
          ) : null}

          <label className="stack">
            <div className="muted">Email</div>
            <input
              className="input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>

          <label className="stack">
            <div className="muted">Password</div>
            <input
              className="input"
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          <div className="row">
            <button className="button buttonPrimary" disabled={busy} type="submit">
              {busy ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>
            <button
              className="button"
              type="button"
              onClick={() => setMode((m) => (m === "signin" ? "signup" : "signin"))}
              disabled={busy}
            >
              {mode === "signin" ? "Need an account?" : "Already have an account?"}
            </button>
          </div>

          {message ? <div className="muted">{message}</div> : null}
        </form>
      </section>

      <section className="card cardHalf">
        <div className="cardHeader">
          <h2 className="h2">What you can do</h2>
        </div>
        <div className="stack">
          <div className="muted">- View course details (schedule, location, price)</div>
          <div className="muted">- Book attendance at individual classes</div>
          <div className="muted">- Enrol in multi-class courses / weekend workshops</div>
        </div>
      </section>
    </div>
  );
}

