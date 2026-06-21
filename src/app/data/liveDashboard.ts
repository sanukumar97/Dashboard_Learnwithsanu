import type {
  DashboardEnrollment,
  DashboardStatus,
} from "../../services/enrollmentService";

export type Status = DashboardStatus;

export interface Student {
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
  enrolledDate: string;
  planExpiryDate: string;
  status: Status;
  dbStatus: "submitted" | "cancelled";
  adminApprovedAt?: string;
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

export interface EmailTemplate {
  id: string;
  name: string;
  description: string;
  body: string;
}

export const MONTHLY_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const emailTemplates: EmailTemplate[] = [
  {
    id: "welcome",
    name: "Welcome Mail",
    description: "Sent after enrollment verification",
    body: "Hi {{name}},\n\nWelcome to the {{plan}} plan. We have received your enrollment and will reach out with next steps shortly.\n\nRegards,\nAdmin Team",
  },
  {
    id: "session-confirmation",
    name: "Session Confirmation",
    description: "Used after scheduling a session",
    body: "Hi {{name}},\n\nYour session is scheduled for {{session_date}} at {{session_time}}.\n\nRegards,\nAdmin Team",
  },
  {
    id: "follow-up",
    name: "Follow-up Mail",
    description: "Used after session completion",
    body: "Hi {{name}},\n\nThank you for attending your session. We will share the follow-up notes soon.\n\nRegards,\nAdmin Team",
  },
];

export function toStudent(enrollment: DashboardEnrollment): Student {
  return {
    id: enrollment.id,
    name: enrollment.name,
    email: enrollment.email,
    phone: enrollment.phone,
    plan: enrollment.plan,
    planSlug: enrollment.planSlug,
    planPrice: enrollment.planPrice,
    utrNumber: enrollment.utrNumber,
    targetColleges: enrollment.targetColleges,
    referralSource: enrollment.referralSource,
    referralOther: enrollment.referralOther,
    remarks: enrollment.remarks,
    enrolledDate: enrollment.enrolledDate,
    planExpiryDate: enrollment.planExpiryDate ?? "",
    status: enrollment.status,
    dbStatus: enrollment.dbStatus,
    adminApprovedAt: enrollment.adminApprovedAt,
    sessionDate: enrollment.sessionDate,
    sessionTime: enrollment.sessionTime,
    sessionCompleted: enrollment.sessionCompleted,
    sessionsAttended: enrollment.sessionsAttended,
    gmeetLink: enrollment.gmeetLink,
    mailSent: enrollment.mailSent,
    mailSentDate: enrollment.mailSentDate,
    templateUsed: enrollment.templateUsed,
    notes: enrollment.notes,
    createdAt: enrollment.createdAt,
    updatedAt: enrollment.updatedAt,
    avatarColor: enrollment.avatarColor,
  };
}

export function daysRemaining(student: Student): number {
  return Math.ceil(
    (new Date(student.planExpiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
}

export function isPlanExpired(student: Student): boolean {
  return daysRemaining(student) < 0;
}

export function monthLabelFromDate(value: string) {
  return MONTHLY_LABELS[new Date(value).getMonth()] ?? "";
}

export function yearFromDate(value: string) {
  return new Date(value).getFullYear();
}
