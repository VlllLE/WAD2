import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

type Profile = {
  user_id: string;
  full_name: string | null;
  is_organiser: boolean;
};

type AuthState = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

async function fetchMyProfile(): Promise<Profile | null> {
  if (!supabase) return null;
  const client = supabase;
  const { data: userData } = await client.auth.getUser();
  const user = userData.user;
  if (!user) return null;

  const { data, error } = await client
    .from("profiles")
    .select("user_id, full_name, is_organiser")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = async () => {
    const p = await fetchMyProfile();
    setProfile(p);
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  };

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    const client = supabase;
    let cancelledInitial = false;
    let alive = true;

    /** Never block session/UI on profile — avoids infinite "Checking session…" if profile query hangs. */
    const hydrateProfile = () => {
      void fetchMyProfile()
        .then((p) => {
          if (alive) setProfile(p);
        })
        .catch(() => {
          if (alive) setProfile(null);
        });
    };

    (async () => {
      try {
        const { data } = await client.auth.getSession();
        if (cancelledInitial) return;
        setSession(data.session);
        setUser(data.session?.user ?? null);
        setLoading(false);
        hydrateProfile();
      } catch {
        if (!cancelledInitial) {
          setSession(null);
          setUser(null);
          setProfile(null);
        }
      } finally {
        setLoading(false);
      }
    })();

    const { data: sub } = client.auth.onAuthStateChange((_event, newSession) => {
      if (!alive) return;
      setSession(newSession);
      setUser(newSession?.user ?? null);
      setLoading(false);
      hydrateProfile();
    });

    return () => {
      cancelledInitial = true;
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthState>(
    () => ({ session, user, profile, loading, refreshProfile, signOut }),
    [session, user, profile, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
