/**
 * Application-wide constants.
 * Keep all magic strings and enum-like values here.
 */

// ─── Job Statuses ────────────────────────────────────────────────────────────

export const JOB_STATUSES = [
  'Wishlist',
  'Applied',
  'Screening',
  'Interview',
  'Offer',
  'Rejected',
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

/** Semantic colors for each job status (Tailwind class fragments). */
export const JOB_STATUS_COLORS: Record<JobStatus, string> = {
  Wishlist: 'bg-slate-100 text-slate-700',
  Applied: 'bg-blue-100 text-blue-700',
  Screening: 'bg-amber-100 text-amber-700',
  Interview: 'bg-violet-100 text-violet-700',
  Offer: 'bg-emerald-100 text-emerald-700',
  Rejected: 'bg-rose-100 text-rose-700',
};

// ─── User Tiers ──────────────────────────────────────────────────────────────

export const USER_TIERS = ['free', 'pro', 'elite', 'admin'] as const;

export type UserTier = (typeof USER_TIERS)[number];

export const TIER_LABELS: Record<UserTier, string> = {
  free: 'Free',
  pro: 'Pro',
  elite: 'Elite',
  admin: 'Admin',
};

// ─── Contact Relationships ───────────────────────────────────────────────────

export const RELATIONSHIP_TYPES = [
  'Recruiter',
  'Hiring Manager',
  'Employee',
  'Other',
] as const;

export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];

export const RELATIONSHIP_COLORS: Record<RelationshipType, string> = {
  Recruiter: 'bg-teal-100 text-teal-700',
  'Hiring Manager': 'bg-blue-100 text-blue-700',
  Employee: 'bg-purple-100 text-purple-700',
  Other: 'bg-slate-100 text-slate-700',
};

// ─── Outreach ────────────────────────────────────────────────────────────────

export const OUTREACH_METHODS = [
  'LinkedIn',
  'Email',
  'Phone',
  'WhatsApp',
] as const;

export type OutreachMethod = (typeof OUTREACH_METHODS)[number];

export const OUTREACH_STATUSES = [
  'draft',
  'sent',
  'replied',
  'no_response',
] as const;

export type OutreachStatus = (typeof OUTREACH_STATUSES)[number];

// ─── Reminders ───────────────────────────────────────────────────────────────

export const REMINDER_TYPES = [
  'Follow Up',
  'Apply Deadline',
  'Interview Prep',
  'Other',
] as const;

export type ReminderType = (typeof REMINDER_TYPES)[number];

// ─── Templates ───────────────────────────────────────────────────────────────

export const TEMPLATE_TYPES = [
  'Email',
  'LinkedIn',
  'WhatsApp',
  'Cover Letter',
] as const;

export type TemplateType = (typeof TEMPLATE_TYPES)[number];

// ─── Sync Statuses ───────────────────────────────────────────────────────────

export const SYNC_STATUSES = [
  'idle',
  'in_progress',
  'completed',
  'failed',
] as const;

export type SyncStatus = (typeof SYNC_STATUSES)[number];

// ─── App Metadata ────────────────────────────────────────────────────────────

export const APP_NAME = 'HireCanvas';
export const APP_DOMAIN = 'hirecanvas.in';
export const APP_DESCRIPTION =
  'A job search command center that auto-syncs job emails, extracts data with AI, and tracks your entire pipeline.';
