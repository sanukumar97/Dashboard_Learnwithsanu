import { supabase } from "../lib/supabase";

export interface AdminPlan {
  id: string;
  slug: string;
  name: string;
  price_paise: number;
  tag: string | null;
  display_order: number;
  duration_weeks: string | null;
  session_limit: string | null;
  is_active: boolean;
  gmeet_link: string | null;
}

export async function fetchAllPlansAdmin(): Promise<AdminPlan[]> {
  const { data, error } = await supabase
    .from("plans")
    .select("*")
    .order("display_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchActivePlansAdmin(): Promise<AdminPlan[]> {
  const { data, error } = await supabase
    .from("plans")
    .select("*")
    .eq("is_active", true)
    .order("display_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function upsertPlanAdmin(plan: Partial<AdminPlan> & { slug: string; name: string; price_paise: number }) {
  if (plan.id) {
    const { error } = await supabase.from("plans").update({
      slug: plan.slug,
      name: plan.name,
      price_paise: plan.price_paise,
      tag: plan.tag,
      display_order: plan.display_order ?? 0,
      duration_weeks: plan.duration_weeks ?? null,
      session_limit: plan.session_limit ?? null,
      is_active: plan.is_active ?? true,
      gmeet_link: plan.gmeet_link ?? null,
    }).eq("id", plan.id);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from("plans").insert({
    slug: plan.slug,
    name: plan.name,
    price_paise: plan.price_paise,
    tag: plan.tag,
    display_order: plan.display_order ?? 0,
    duration_weeks: plan.duration_weeks ?? 0,
    session_limit: plan.session_limit ?? 0,
    is_active: plan.is_active ?? true,
    gmeet_link: plan.gmeet_link ?? null,
  });
  if (error) throw error;
}

export async function deletePlanAdmin(id: string) {
  const { error } = await supabase.from("plans").delete().eq("id", id);
  if (error) throw error;
}
