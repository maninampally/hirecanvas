export const FAST_SKIP_PATTERNS = {
  // Skip if subject contains these — definitely not a job lifecycle email.
  // IMPORTANT: every pattern here must be narrow enough that it cannot match
  // real job titles (e.g. "Marketing Analyst", "Sales Engineer").
  subjectReject: [
    /\b\d+ new jobs? (matching|for|near)\b/i,
    /\bjobs? (alert|digest|newsletter|roundup)\b/i,
    /\brecommended jobs?\b/i,
    /\bpeople (also )?(viewed|applied)\b/i,
    /^unsubscribe$/i,
    /\b(receipt|invoice) (from|for|#)\b/i,
    /\breceipt #\d+\b/i,
    /\border #\s*\d+\b/i,
    /\b(scheduled|received) your? payment\b/i,
    /\bpayment (confirmation|received|sent|failed)\b/i,
    /\byour (order|purchase|subscription) (confirmation|receipt)\b/i,
    /\bthank you for your order\b/i,
    /\bpassword reset\b/i,
    /\bverify your (email|account)\b/i,
    /\bconfirm your (signup|sign[- ]up|email|account|identity)\b/i,
    /\b(\d+% )?off\s+(today|now|plus|pro|elite)\b/i,
    /\bflash sale\b/i,
    /\b(limited time|last (hours?|chance) to|sale ends)\b/i,
    /\b(promo|discount) code\b/i,
    /\blinkedin (weekly|digest|news)\b/i,
    /\bglassdoor (digest|alert)\b/i,
    /\bindeed (digest|alert)\b/i,
    /\bzelle\u00AE? payment\b/i,
  ],

  // Skip if from these known noise senders.
  senderReject: [
    /noreply@linkedin\.com/i,
    /jobs-listings@linkedin\.com/i,
    /editors-noreply@linkedin\.com/i,
    /security-noreply@linkedin\.com/i,
    /newsletters-noreply@linkedin\.com/i,
    /jobs-noreply@linkedin\.com/i,
    /jobalerts@indeed\.com/i,
    /match\.indeed\.com/i,
    /noreply@glassdoor\.com/i,
    /noreply@ziprecruiter\.com/i,
    /@newsletter\./i,
    /@mailer\./i,
    /marketing@/i,
    /billing@mail\./i,
    /invoice\+statements@/i,
    /googleplay-noreply@/i,
    /ealerts\.bankofamerica\.com/i,
    /services\.discover\.com/i,
    /noreply@supabase\.com/i,
    /noreply@mail\.app\.supabase\.io/i,
    /no-reply@mail\.lovable-app\.email/i,
    /donotreply@godaddy\.com/i,
    /uscis\.dhs\.gov/i,
    /no.?reply@.*\.(shopify|stripe|paypal|amazon|apple)/i,
  ],

  // NEVER skip if subject contains these — always pass to classifier.
  // This list must cover ATS status emails whose subjects also contain trigger
  // words like "marketing" or "sales" in the role title.
  subjectAlwaysPass: [
    /\binterview\b/i,
    /\boffer letter\b/i,
    /\bjob offer\b/i,
    /\bcongratulations\b/i,
    /\bunfortunately\b/i,
    /\bnot moving forward\b/i,
    /\bnext steps\b/i,
    /\bapplication (received|confirmed|submitted|update)\b/i,
    /\bupdate on your (application|candidacy)\b/i,
    /\bstatus of your application\b/i,
    /\bthank you for (applying|your application)\b/i,
    /\bphone screen\b/i,
    /\btechnical (interview|assessment|screen)\b/i,
    /\bcoding (challenge|assessment)\b/i,
    /\btake[- ]?home\b/i,
    /\bwe.d like to (meet|speak|chat|schedule)\b/i,
    /\bapplication (to|for) [A-Z]/,
  ],
}

export type FastSkipInput = {
  subject: string
  from: string
  snippet?: string
}

export type FastSkipResult = {
  skip: boolean
  reason?: string
}

export function shouldFastSkip(email: FastSkipInput): FastSkipResult {
  const subject = email.subject || ''
  const from = email.from || ''

  // Always-pass first — these NEVER get skipped even if sender looks noisy
  for (const pattern of FAST_SKIP_PATTERNS.subjectAlwaysPass) {
    if (pattern.test(subject)) {
      return { skip: false }
    }
  }

  for (const pattern of FAST_SKIP_PATTERNS.senderReject) {
    if (pattern.test(from)) {
      return { skip: true, reason: `sender_reject: ${from}` }
    }
  }

  for (const pattern of FAST_SKIP_PATTERNS.subjectReject) {
    if (pattern.test(subject)) {
      return { skip: true, reason: `subject_reject: ${pattern.source}` }
    }
  }

  return { skip: false }
}
