import type { User } from "@supabase/supabase-js";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

function sessionDisplayName(user: User, profile: { full_name: string | null } | null) {
  const name = profile?.full_name?.trim();
  return name || user.email || "Signed in";
}

export function Layout() {
  const { user, profile, loading, signOut } = useAuth();

  return (
    <>
      <header className="nav">
        <div className="navInner">
          <div className="brand">
            <div className="brandTitle">Yoga & Mindfulness Studio</div>
            <div className="brandSub">Classes and weekend workshops</div>
          </div>

          <div className="navRight">
            <div className="navSession muted" aria-live="polite">
              {loading ? "Checking session…" : user ? (
                <>
                  Signed in as <span className="navSessionName">{sessionDisplayName(user, profile)}</span>
                  {profile?.is_organiser ? <span className="navSessionRole"> · Organiser</span> : null}
                </>
              ) : (
                "Not signed in"
              )}
            </div>

            <nav className="navLinks">
              <NavLink className="pill" to="/">
                Home
              </NavLink>
              <NavLink className="pill" to="/courses">
                Courses
              </NavLink>

              {loading ? null : user ? (
                <>
                  <NavLink className="pill" to="/me/bookings">
                    My bookings
                  </NavLink>
                  {profile?.is_organiser ? (
                    <NavLink className="pill pillPrimary" to="/admin">
                      Admin
                    </NavLink>
                  ) : null}
                  <button className="pill pillDanger" onClick={() => void signOut()}>
                    Sign out
                  </button>
                </>
              ) : (
                <NavLink className="pill pillPrimary" to="/login">
                  Sign in
                </NavLink>
              )}
            </nav>
          </div>
        </div>
      </header>

      <main className="container">
        <Outlet />
      </main>
    </>
  );
}

