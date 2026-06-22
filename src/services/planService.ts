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
  form_type: string;
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
    // Only include form_type when explicitly provided — archive/restore calls don't pass it
    // and we must not overwrite it with a default.
    const patch: Record<string, unknown> = {
      slug: plan.slug,
      name: plan.name,
      price_paise: plan.price_paise,
      tag: plan.tag,
      display_order: plan.display_order ?? 0,
      duration_weeks: plan.duration_weeks ?? null,
      session_limit: plan.session_limit ?? null,
      is_active: plan.is_active ?? true,
      gmeet_link: plan.gmeet_link ?? null,
    };
    if (plan.form_type !== undefined) patch.form_type = plan.form_type;

    const { error } = await supabase.from("plans").update(patch).eq("id", plan.id);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from("plans").insert({
    slug: plan.slug,
    name: plan.name,
    price_paise: plan.price_paise,
    tag: plan.tag,
    display_order: plan.display_order ?? 0,
    duration_weeks: plan.duration_weeks ?? null,
    session_limit: plan.session_limit ?? null,
    is_active: plan.is_active ?? true,
    gmeet_link: plan.gmeet_link ?? null,
    form_type: plan.form_type ?? "paid",
  });
  if (error) throw error;
}

export async function deletePlanAdmin(id: string) {
  const { error } = await supabase.from("plans").delete().eq("id", id);
  if (error) throw error;
}
