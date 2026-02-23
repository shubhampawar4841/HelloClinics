import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import supabase from "@/lib/supabase";
import { getMe, type MeResponse } from "@/api/client";

type AuthState = {
  session: Session | null;
  user: User | null;
  profile: MeResponse["profile"] | null;
  hospital: MeResponse["hospital"] | null;
  loading: boolean;
  meLoading: boolean;
};

type AuthContextValue = AuthState & {
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshMe: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<MeResponse["profile"] | null>(null);
  const [hospital, setHospital] = useState<MeResponse["hospital"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [meLoading, setMeLoading] = useState(true);

  const fetchMe = useCallback(async (token?: string | null) => {
    setMeLoading(true);
    try {
      const data = await getMe(token ?? session?.access_token ?? undefined);
      if (data) {
        setProfile(data.profile);
        setHospital(data.hospital);
      } else {
        setProfile(null);
        setHospital(null);
      }
    } catch {
      setProfile(null);
      setHospital(null);
    } finally {
      setMeLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    // FIRST: recover session immediately (handles OAuth redirect with #access_token)
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);

      // CLEAN URL: remove hash so it doesn't break loading logic
      if (typeof window !== "undefined" && window.location.hash) {
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname
        );
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (!s) {
        setProfile(null);
        setHospital(null);
        setMeLoading(false);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !session) {
      if (!user) {
        setProfile(null);
        setHospital(null);
        setMeLoading(false);
      }
      return;
    }
    fetchMe(session.access_token);
  }, [user, session, fetchMe]);

  const signInWithGoogle = useCallback(async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    });
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setHospital(null);
  }, []);

  const value: AuthContextValue = {
    session,
    user,
    profile,
    hospital,
    loading,
    meLoading,
    signInWithGoogle,
    signOut,
    refreshMe: fetchMe,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
