// Known Applicant Tracking System sender domains. Emails from these
// addresses bypass aggressive noise filters (large body size, Gmail
// promotional categories, generic subject reject) because they are
// almost always real lifecycle emails.
//
// Order matters only for readability — every pattern is matched against
// the full From header value, case-insensitive.
export const ATS_SENDER_PATTERN =
  /(@|\.)?(greenhouse\.io|grnh\.se|lever\.co|hire\.lever\.co|ashbyhq\.com|myworkdayjobs\.com|workday(?:mail)?\.com|smartrecruiters\.com|smartrecruiters\.io|icims\.com|taleo\.net|jobvite\.com|hire\.jobvite\.com|bamboohr\.com|workable\.com|workablemail\.com|breezy\.hr|recruitee\.com|teamtailor\.com|hire\.withgoogle\.com|paylocity\.com|adp\.com|successfactors\.com|brassring\.com|kenexa\.com|recruiterbox\.com|notifications\.greenhouse\.io|no-reply@us\.greenhouse\.io|jazzhr\.com|applytojob\.com|talentreef\.com|gem\.com|paradox\.ai|joinhandshake\.com|trinethire\.com|hire\.trinet\.com|polymer\.co)\b/i

export function isAtsSender(fromAddress: string | null | undefined): boolean {
  if (!fromAddress) return false
  return ATS_SENDER_PATTERN.test(fromAddress)
}
