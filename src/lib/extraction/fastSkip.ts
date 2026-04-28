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
    // Job-board digests / promotions (NOT ATS emails — those go through)
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
    // Banking / financial alerts
    /ealerts\.bankofamerica\.com/i,
    /services\.discover\.com/i,
    /@(?:chase|wellsfargo|citi|capitalone|amex|americanexpress)\.com/i,
    /@(?:paypal|venmo|zelle|cash\.app|stripe|squareup)\.com/i,
    /@email\.discover\.com/i,
    /@bankofamerica\.com/i,
    // E-commerce / shipping / food
    /no.?reply@.*\.(shopify|stripe|paypal|amazon|apple)/i,
    /(?:shipment|order|delivery)-?(?:update|tracking|confirmation)@/i,
    /@(?:amazon\.(?:com|co\.uk|in)|amzn\.com|amazonses\.com)/i,
    /@(?:doordash|ubereats|grubhub|swiggy|zomato|instacart|seamless)\.com/i,
    /@(?:uber|lyft|ola|airbnb|booking|expedia|kayak|priceline)\.com/i,
    /@(?:walmart|target|bestbuy|ebay|etsy|wayfair|costco)\.com/i,
    // Social media notifications
    /@(?:instagram|facebookmail|facebook)\.com/i,
    /no-?reply@(?:x|twitter)\.com/i,
    /@(?:tiktok|snapchat|pinterest|reddit|tumblr|threads)\.com/i,
    /@medium\.com/i,
    // Dev tool noise (Hire emails come from greenhouse/lever, not these)
    /^notifications@github\.com/i,
    /^noreply@github\.com/i,
    /@(?:gitlab|bitbucket)\.com/i,
    /@(?:notion|slack|asana|trello|jira|atlassian|monday|clickup|linear|figma)\.(?:com|so|app)/i,
    /@(?:zoom|webex|gotomeeting|calendly)\.us/i,
    /@(?:dropbox|box|onedrive|drive\.google)\.com/i,
    // Misc bulk noise
    /noreply@supabase\.com/i,
    /noreply@mail\.app\.supabase\.io/i,
    /no-reply@mail\.lovable-app\.email/i,
    /donotreply@godaddy\.com/i,
    /uscis\.dhs\.gov/i,
    /@(?:netflix|spotify|hulu|disney|primevideo|youtube)\.com/i,
    /@(?:duolingo|coursera|udemy|edx|khanacademy)\.(?:com|org)/i,
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

import { isAtsSender } from '@/lib/extraction/atsAllowlist'

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

  // ATS senders override every reject rule. Greenhouse / Lever / Workday
  // emails are real lifecycle signals even if their subject/sender pattern
  // overlaps with a noise filter.
  if (isAtsSender(from)) {
    return { skip: false }
  }

  // Always-pass subject phrases — interview/offer/rejection language wins
  // over a noisy sender domain.
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
