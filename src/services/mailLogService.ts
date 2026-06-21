import { supabase } from "../lib/supabase";

export interface MailLogEntry {
  id: string;
  sentTo: string;
  email: string;
  template: string;
  sentDate: string;
  status: "Sent" | "Failed" | "Scheduled";
  scheduledFor?: string;
  enrollmentId?: string;
  body?: string;
  archived: boolean;
}

function mapRow(row: Record<string, unknown>): MailLogEntry {
  return {
    id:           row.id as string,
    sentTo:       row.sent_to as string,
    email:        row.email as string,
    template:     row.template as string,
    sentDate:     row.sent_date as string,
    status:       row.status as "Sent" | "Failed" | "Scheduled",
    scheduledFor: (row.scheduled_for as string | null) ?? undefined,
    enrollmentId: (row.enrollment_id as string | null) ?? undefined,
    body:         (row.body as string | null) ?? undefined,
    archived:     (row.archived as boolean) ?? false,
  };
}

export async function fetchMailLog(): Promise<MailLogEntry[]> {
  const { data, error } = await supabase
    .from("mail_log")
    .select("*")
    .eq("archived", false)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function fetchArchivedMailLog(): Promise<MailLogEntry[]> {
  const { data, error } = await supabase
    .from("mail_log")
    .select("*")
    .eq("archived", true)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function sendMail(params: {
  enrollmentId?: string;
  to: string;
  toName: string;
  plan: string;
  sessionDate?: string;
  sessionTime?: string;
  templateBody: string;
  templateName: string;
  grantAccess?: boolean;
  gmeetLink?: string;
  existingLogId?: string;
}): Promise<{ success: boolean; status: string }> {
  const { data, error } = await supabase.functions.invoke("send-mail", { body: params });
  if (error) throw error;
  return data as { success: boolean; status: string };
}

export async function markMailLogSent(id: string): Promise<void> {
  const { error } = await supabase.from("mail_log").update({ status: "Sent" }).eq("id", id);
  if (error) throw error;
}

export async function scheduleMail(params: {
  enrollmentId?: string;
  sentTo: string;
  email: string;
  templateName: string;
  scheduledFor: string;
  body?: string;
}): Promise<void> {
  const { error } = await supabase.from("mail_log").insert({
    enrollment_id: params.enrollmentId ?? null,
    sent_to:       params.sentTo,
    email:         params.email,
    template:      params.templateName,
    status:        "Scheduled",
    scheduled_for: params.scheduledFor,
    sent_date:     params.scheduledFor.slice(0, 10),
    body:          params.body ?? null,
  });
  if (error) throw error;
}

export async function archiveMailLogEntry(id: string): Promise<void> {
  const { error } = await supabase.from("mail_log").update({ archived: true }).eq("id", id);
  if (error) throw error;
}

export async function restoreMailLogEntry(id: string): Promise<void> {
  const { error } = await supabase.from("mail_log").update({ archived: false }).eq("id", id);
  if (error) throw error;
}

export async function deleteMailLogEntry(id: string): Promise<void> {
  const { error } = await supabase.from("mail_log").delete().eq("id", id);
  if (error) throw error;
}
