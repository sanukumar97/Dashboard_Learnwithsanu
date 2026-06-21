import { supabase } from "../lib/supabase";

export type DashboardStatus = "New" | "Scheduled" | "Mail Sent" | "Completed" | "Overdue";

export interface DashboardEnrollment {
  id: string;
  name: string;
  email: string;
  phone: string;
  plan: string;
  planSlug: string;
  planPrice: number;
  utrNumber: string;
  targetColleges: string[];
  referralSource: string;
  referralOther: string;
  remarks: string;
  status: DashboardStatus;
  dbStatus: "submitted" | "cancelled";
  adminApprovedAt?: string;
  enrolledDate: string;
  planExpiryDate?: string;
  sessionDate?: string;
  sessionTime?: string;
  sessionCompleted: boolean;
  sessionsAttended: number;
  gmeetLink?: string;
  mailSent: boolean;
  mailSentDate?: string;
  templateUsed?: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  avatarColor: string;
}

interface EnrollmentRow {
  id: string;
  full_name: string | null;
  email: string;
  whatsapp: string | null;
  plan_id: string | null;
  plan_name_snapshot: string | null;
  plan_price_snapshot_paise: number | null;
  utr_number: string | null;
  target_colleges: string[];
  referral_source: string | null;
  referral_other: string | null;
  remarks: string | null;
  status: "in_progress" | "submitted" | "cancelled";
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
  session_date: string | null;
  session_time: string | null;
  session_completed: boolean;
  sessions_attended: number;
  mail_sent: boolean;
  mail_sent_date: string | null;
  template_used: string | null;
  notes: string | null;
  plan_expiry_date: string | null;
  gmeet_link: string | null;
  admin_approved_at: string | null;
  plans?: {
    slug: string;
    name: string;
    price_paise: number;
  } | null;
}

const AVATAR_COLORS = [
  "#1A2AF1", "#8B5CF6", "#22C55E", "#F59E0B", "#EF4444",
  "#06B6D4", "#EC4899", "#14B8A6", "#F97316", "#6366F1",
];

function avatarColor(id: string) {
  return AVATAR_COLORS[Math.abs(id.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0)) % AVATAR_COLORS.length];
}

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function statusFor(row: EnrollmentRow): DashboardStatus {
  if (row.session_completed) return "Completed";
  if (row.plan_expiry_date && row.plan_expiry_date < todayISO()) return "Overdue";
  if (row.mail_sent) return "Mail Sent";
  if (row.session_date && row.session_time) return "Scheduled";
  return "New";
}

function dateOnly(value: string | null) {
  if (!value) return undefined;
  return value.slice(0, 10);
}

export function mapEnrollment(row: EnrollmentRow): DashboardEnrollment {
  const plan = row.plans;
  const planName = row.plan_name_snapshot ?? plan?.name ?? "Unpaid / Unknown";
  const planPrice = row.plan_price_snapshot_paise ?? plan?.price_paise ?? 0;

  return {
    id: row.id,
    name: row.full_name?.trim() || "Unnamed Student",
    email: row.email,
    phone: row.whatsapp || "",
    plan: planName,
    planSlug: plan?.slug || "",
    planPrice: planPrice / 100,
    utrNumber: row.utr_number || "",
    targetColleges: row.target_colleges ?? [],
    referralSource: row.referral_source || "",
    referralOther: row.referral_other || "",
    remarks: row.remarks || "",
    status: statusFor(row),
    dbStatus: row.status as "submitted" | "cancelled",
    adminApprovedAt: dateOnly(row.admin_approved_at),
    enrolledDate: dateOnly(row.submitted_at ?? row.created_at) ?? dateOnly(row.created_at)!,
    planExpiryDate: dateOnly(row.plan_expiry_date),
    sessionDate: dateOnly(row.session_date),
    sessionTime: row.session_time ?? undefined,
    sessionCompleted: row.session_completed,
    sessionsAttended: row.sessions_attended ?? 0,
    gmeetLink: row.gmeet_link ?? undefined,
    mailSent: row.mail_sent,
    mailSentDate: dateOnly(row.mail_sent_date),
    templateUsed: row.template_used || undefined,
    notes: row.notes || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    avatarColor: avatarColor(row.id),
  };
}

export async function fetchEnrollmentsAdmin(): Promise<DashboardEnrollment[]> {
  const { data, error } = await supabase
    .from("enrollments")
    .select(`
      *,
      plans!left(slug, name, price_paise)
    `)
    .in("status", ["submitted", "cancelled"])
    .order("submitted_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapEnrollment);
}

export async function updateEnrollmentSession(
  id: string,
  patch: {
    sessionDate?: string;
    sessionTime?: string;
    notes?: string;
    sessionCompleted?: boolean;
    gmeetLink?: string;
  },
) {
  const update: Record<string, unknown> = {};
  if (patch.sessionDate     !== undefined) update.session_date      = patch.sessionDate;
  if (patch.sessionTime     !== undefined) update.session_time      = patch.sessionTime;
  if (patch.sessionCompleted !== undefined) update.session_completed = patch.sessionCompleted;
  if (patch.notes           !== undefined) update.notes             = patch.notes || null;
  if (patch.gmeetLink       !== undefined) update.gmeet_link        = patch.gmeetLink || null;
  const { error } = await supabase.from("enrollments").update(update).eq("id", id);
  if (error) throw error;
}

export async function updateEnrollmentMail(
  id: string,
  patch: {
    mailSent: boolean;
    templateUsed?: string;
    notes?: string;
  },
) {
  const { error } = await supabase.from("enrollments").update({
    mail_sent: patch.mailSent,
    mail_sent_date: patch.mailSent ? new Date().toISOString() : null,
    template_used: patch.templateUsed ?? null,
    notes: patch.notes ?? null,
  }).eq("id", id);
  if (error) throw error;
}

export async function updateEnrollmentNotes(id: string, notes: string) {
  const { error } = await supabase.from("enrollments").update({ notes }).eq("id", id);
  if (error) throw error;
}

export async function updateEnrollmentPlanExpiry(id: string, planExpiryDate: string | null) {
  const { error } = await supabase.from("enrollments").update({
    plan_expiry_date: planExpiryDate,
  }).eq("id", id);
  if (error) throw error;
}

export async function approveEnrollment(id: string) {
  const { error } = await supabase.from("enrollments").update({
    admin_approved_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) throw error;
}

export async function cancelEnrollment(id: string) {
  const { error } = await supabase.from("enrollments").update({
    status: "cancelled",
    updated_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) throw error;
}

export async function resetEnrollmentSession(id: string) {
  const { error } = await supabase.from("enrollments").update({
    session_date:      null,
    session_time:      null,
    session_completed: false,
  }).eq("id", id);
  if (error) throw error;
}

export async function incrementSessionsAttended(id: string) {
  const { error } = await supabase.rpc("increment_sessions_attended", { enrollment_id: id });
  if (error) throw error;
}

export async function restoreEnrollment(id: string) {
  const { error } = await supabase.from("enrollments").update({
    status: "submitted",
    admin_approved_at: null,
  }).eq("id", id);
  if (error) throw error;
}

export async function hardDeleteEnrollment(id: string) {
  const { error } = await supabase.from("enrollments").delete().eq("id", id);
  if (error) throw error;
}
