import { supabase } from "../lib/supabase";

export interface AdminProfile {
  user_id: string;
  email: string;
  role: "admin" | "super_admin";
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function getAdminProfile(): Promise<AdminProfile | null> {
  const { data, error } = await supabase
    .from("admin_profiles")
    .select("user_id, email, role")
    .eq("user_id", (await supabase.auth.getUser()).data.user?.id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function isAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_admin").single();
  if (error) throw error;
  return Boolean(data);
}

export function onAuthStateChange(callback: (sessionPresent: boolean) => void) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(Boolean(session));
  });
  return data.subscription;
}

export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;

  const ok = await isAdmin();
  if (!ok) {
    await supabase.auth.signOut();
    throw new Error("This account is not registered as an admin.");
  }
}

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin,
    },
  });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
