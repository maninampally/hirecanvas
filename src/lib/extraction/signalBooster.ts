/**
 * Signal booster: Detects ATS senders and boosts confidence using heuristic signals.
 * No AI calls — regex and string matching only.
 */

export const ATS_DOMAINS = new Set([
  'greenhouse.io',
  'lever.co',
  'workday.com',
  'myworkdayjobs.com',
  'taleo.net',
  'icims.com',
  'smartrecruiters.com',
  'jobvite.com',
  'ashbyhq.com',
  'rippling.com',
  'bamboohr.com',
  'successfactors.com',
  'recruitee.com',
  'dover.com',
  'jazz.co',
  'applytojob.com',
  'recruitcrm.io',
  'breezy.hr',
  'pinpointhq.com',
  'comeet.com',
  'hire.trakstar.com',
  'careers.google.com',
  'hiring.amazon.com',
])

export function isAtsDomain(domain: string): boolean {
  return ATS_DOMAINS.has(domain.toLowerCase())
}

export const STRONG_JOB_SIGNALS = [
  /offer/i,
  /interview/i,
  /application.*(?:confirmed|received|sent)/i,
  /rejection|rejected/i,
  /congratulations/i,
  /advance/i,
  /shortlist/i,
  /selection/i,
  /phone.*screen/i,
  /technical.*assessment/i,
]

export function countJobSignals(text: string): number {
  return STRONG_JOB_SIGNALS.filter((pattern) => pattern.test(text)).length
}
