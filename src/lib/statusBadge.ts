/**
 * Centralized status → badge variant map — OBS-009
 * Use this everywhere status badges are rendered to keep colors consistent.
 */
import type { BadgeProps } from '@/components/ui/badge'

type BadgeVariant = NonNullable<BadgeProps['variant']>

const STATUS_VARIANT_MAP: Record<string, BadgeVariant> = {
  // Job pipeline statuses
  Wishlist:   'teal',
  Applied:    'blue',
  Screening:  'amber',
  Interview:  'amber',
  Offer:      'emerald',
  Accepted:   'emerald',
  Rejected:   'rose',
  Closed:     'slate',
  Ghosted:    'slate',

  // Sync / review statuses
  auto_accepted: 'emerald',
  needs_review:  'amber',
  auto_rejected: 'rose',
}

/**
 * Returns the badge variant for a given job/application status.
 * Falls back to 'teal' if the status is not recognized.
 */
export function getStatusVariant(status: string | null | undefined): BadgeVariant {
  if (!status) return 'slate'
  return STATUS_VARIANT_MAP[status] ?? 'teal'
}
