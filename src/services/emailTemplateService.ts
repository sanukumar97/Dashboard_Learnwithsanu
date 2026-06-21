import { supabase } from "../lib/supabase";

export interface EmailTemplate {
  id: string;
  name: string;
  description: string;
  body: string;
  archived: boolean;
  lastEdited: string;
}

function mapRow(row: Record<string, unknown>): EmailTemplate {
  return {
    id:          row.id as string,
    name:        row.name as string,
    description: row.description as string,
    body:        row.body as string,
    archived:    row.archived as boolean,
    lastEdited:  ((row.updated_at ?? row.created_at) as string).slice(0, 10),
  };
}

export async function fetchEmailTemplates(): Promise<EmailTemplate[]> {
  const { data, error } = await supabase
    .from("email_templates")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function upsertEmailTemplate(tpl: {
  id?: string;
  name: string;
  description: string;
  body: string;
}): Promise<void> {
  const now = new Date().toISOString();
  if (tpl.id) {
    const { error } = await supabase.from("email_templates").update({
      name: tpl.name, description: tpl.description, body: tpl.body, updated_at: now,
    }).eq("id", tpl.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("email_templates").insert({
      name: tpl.name, description: tpl.description, body: tpl.body,
    });
    if (error) throw error;
  }
}

export async function archiveEmailTemplate(id: string): Promise<void> {
  const { error } = await supabase.from("email_templates")
    .update({ archived: true, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function restoreEmailTemplate(id: string): Promise<void> {
  const { error } = await supabase.from("email_templates")
    .update({ archived: false, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function deleteEmailTemplate(id: string): Promise<void> {
  const { error } = await supabase.from("email_templates").delete().eq("id", id);
  if (error) throw error;
}
