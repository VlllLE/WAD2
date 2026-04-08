import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function RequireOrganiser({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!profile?.is_organiser) return <Navigate to="/" replace />;
  return <>{children}</>;
}

