import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { getMemberApprovalRecord } from "../lib/memberApproval";
import { supabase } from "../lib/supabaseClient";
import { AuthContext } from "./authContextValue";

export function AuthProvider({ children }) {
  const [state, setState] = useState({
    loading: true,
    user: null,
    session: null,
    member: null,
    error: null,
  });

  const loadSession = useCallback(async (session) => {
    const user = session?.user || null;

    if (!user) {
      setState({
        loading: false,
        user: null,
        session: null,
        member: null,
        error: null,
      });
      return;
    }

    const { member, error } = await getMemberApprovalRecord(user.id);
    setState({
      loading: false,
      user,
      session,
      member,
      error: error || null,
    });
  }, []);

  const refreshAuth = useCallback(async () => {
    setState((current) => ({ ...current, loading: true }));
    const {
      data: { session },
    } = await supabase.auth.getSession();
    await loadSession(session);
  }, [loadSession]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setState({
      loading: false,
      user: null,
      session: null,
      member: null,
      error: null,
    });
  }, []);

  useEffect(() => {
    let active = true;

    const loadIfActive = async (session) => {
      if (!active) return;
      await loadSession(session);
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      loadIfActive(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      loadIfActive(session);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [loadSession]);

  const value = useMemo(() => {
    const displayName =
      state.member?.name ||
      state.user?.user_metadata?.name ||
      state.user?.user_metadata?.full_name ||
      state.user?.email ||
      "";

    return {
      ...state,
      approved: Boolean(state.member?.approved),
      displayName,
      refreshAuth,
      signOut,
    };
  }, [refreshAuth, signOut, state]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
