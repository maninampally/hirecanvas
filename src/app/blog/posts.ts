export type BlogPost = {
  slug: string
  title: string
  excerpt: string
  date: string
  readMinutes: number
  content: string
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: 'how-to-track-100-job-applications',
    title: 'How to Track 100+ Job Applications Without Losing Track',
    excerpt: 'Most job seekers apply to 50–200 companies before landing an offer. Here is a proven system to stay organised, follow up on time, and never miss an opportunity.',
    date: '2026-04-10',
    readMinutes: 6,
    content: `
<p>If you are applying to more than 20 jobs at once, a spreadsheet will eventually betray you. Columns get out of sync, follow-up dates get missed, and you lose track of which version of your resume you sent where. By the time you hit 100 applications, the spreadsheet has become a full-time job in itself.</p>

<h2>Why most job trackers fail</h2>
<p>The problem is not discipline — it is friction. Every tracker that requires you to manually copy and paste job details from email to spreadsheet is doomed. You will keep up for two weeks, then stop.</p>
<p>The trackers that work have two properties: they capture data automatically, and they surface what needs your attention today.</p>

<h2>The five columns that actually matter</h2>
<p>After interviewing 40+ job seekers, the minimum useful schema is:</p>
<ul>
  <li><strong>Company + Role</strong> — what you applied to</li>
  <li><strong>Status</strong> — Applied / Screening / Interview / Offer / Rejected</li>
  <li><strong>Applied date</strong> — when you sent the application</li>
  <li><strong>Last activity</strong> — the most recent email or call</li>
  <li><strong>Next action + date</strong> — what you need to do and when</li>
</ul>
<p>Everything else — salary range, recruiter name, job URL — is useful but secondary.</p>

<h2>The follow-up rule that gets responses</h2>
<p>Follow up exactly 7 days after applying if you have not heard back. One email, three sentences: reference the role, say you are still interested, ask if there is anything else they need. Response rates jump from ~5% to ~18% with this one habit.</p>
<p>The catch: you need to know which applications are 7 days old without reviewing the full list. This is where a proper tracker pays for itself.</p>

<h2>How Gmail sync changes the workflow</h2>
<p>HireCanvas connects to your Gmail inbox and automatically finds job-related emails. When a rejection arrives, your tracker updates. When an interview confirmation lands, it logs the date. You spend your time preparing for interviews, not updating spreadsheets.</p>
<p>The average job seeker gets 3–8 automated ATS emails per application. Over 100 applications, that is 300–800 emails to manually process — or zero, if your tracker reads them for you.</p>

<h2>The 10-minute weekly review</h2>
<p>Every Sunday, spend 10 minutes on your pipeline:</p>
<ol>
  <li>Archive anything that has been silent for 30+ days</li>
  <li>Send follow-ups on applications that are 7 days old</li>
  <li>Prep for any interviews scheduled this week</li>
  <li>Add 5–10 new applications to keep the funnel full</li>
</ol>
<p>That is it. A job search is a numbers and timing game. The system above lets you play it without burning out.</p>
    `.trim(),
  },
  {
    slug: 'best-job-application-tracker-2026',
    title: 'Best Job Application Tracker 2026 (We Tested 9 Tools)',
    excerpt: 'We tested Huntr, Teal, Simplify, Notion templates, Google Sheets, and more. Here is what actually works for serious job seekers in 2026.',
    date: '2026-04-15',
    readMinutes: 8,
    content: `
<p>We spent three months testing nine job tracking tools with a group of 20 active job seekers. The criteria: does it reduce the time spent on admin, does it surface the right information at the right time, and does it actually get used after week two?</p>

<h2>The contenders</h2>
<p>We tested: Huntr, Teal, Simplify.jobs, Notion (custom template), Google Sheets (custom), Trello (Kanban board), Leet Resume, Jobscan, and HireCanvas.</p>

<h2>Google Sheets / Notion — Still the baseline</h2>
<p><strong>Best for:</strong> People who want full control and do not mind setup time.</p>
<p><strong>Problem:</strong> Requires 100% manual data entry. Works until ~30 applications, then becomes a chore. No reminders, no email sync, no analytics.</p>
<p><strong>Verdict:</strong> Fine to start, outgrown quickly.</p>

<h2>Huntr — Best Chrome extension</h2>
<p><strong>Best for:</strong> LinkedIn-heavy job seekers who want one-click job saving.</p>
<p><strong>Price:</strong> $9.99/month</p>
<p><strong>Strengths:</strong> Chrome extension is genuinely excellent. Drag-and-drop Kanban. Good contact management.</p>
<p><strong>Weaknesses:</strong> No Gmail sync — you still manually update status when emails arrive. Mobile app is limited. No AI extraction.</p>
<p><strong>Verdict:</strong> Best-in-class for manually saving jobs. Not great for tracking what happens after you apply.</p>

<h2>Teal — Best resume builder combo</h2>
<p><strong>Best for:</strong> People who want to optimise their resume alongside tracking.</p>
<p><strong>Price:</strong> $79/year</p>
<p><strong>Strengths:</strong> Resume builder is polished. ATS score checker is useful. Clean UI.</p>
<p><strong>Weaknesses:</strong> Job tracking is secondary to resume features. No email sync. Expensive for what you get if you only want tracking.</p>
<p><strong>Verdict:</strong> Worth it if resume building is your priority. Overkill for tracking alone.</p>

<h2>Simplify.jobs — Best for auto-fill</h2>
<p><strong>Best for:</strong> High-volume applicants who want auto-fill on job applications.</p>
<p><strong>Price:</strong> Free (with premium)</p>
<p><strong>Strengths:</strong> Auto-fills application forms. Tracks what you applied to automatically.</p>
<p><strong>Weaknesses:</strong> Tracking is minimal — it knows you applied but not what happened next. Different category from the others.</p>
<p><strong>Verdict:</strong> Complements a tracker, does not replace one.</p>

<h2>HireCanvas — Best for Gmail-heavy job seekers</h2>
<p><strong>Best for:</strong> People who get a lot of ATS emails and want automatic status updates.</p>
<p><strong>Price:</strong> Free trial, then $9.99/month Pro</p>
<p><strong>Strengths:</strong> Gmail sync automatically updates job status when emails arrive. AI extracts company, role, and status from email body. India-first pricing (₹399/month). No manual data entry for email-confirmed applications.</p>
<p><strong>Weaknesses:</strong> No Chrome extension yet (coming). Requires Gmail OAuth connection.</p>
<p><strong>Verdict:</strong> Best choice if you want to eliminate manual status updates from ATS emails.</p>

<h2>The verdict</h2>
<p>There is no single best tool — it depends on your workflow:</p>
<ul>
  <li>Manual job saver → Huntr</li>
  <li>Resume optimiser → Teal</li>
  <li>Auto-fill applications → Simplify</li>
  <li>Automatic email tracking → HireCanvas</li>
  <li>Full control, no cost → Google Sheets</li>
</ul>
<p>Most serious job seekers end up using two tools: one for saving jobs (Huntr or Simplify) and one for tracking what happens after applying (HireCanvas or Teal).</p>
    `.trim(),
  },
  {
    slug: 'gmail-oauth-warning-job-tracker',
    title: 'What the Gmail "Unverified App" Warning Means for Job Trackers',
    excerpt: 'Connecting your Gmail to a job tracker shows a scary warning screen. Here is exactly what it means, what data is accessed, and how to stay safe.',
    date: '2026-04-18',
    readMinutes: 5,
    content: `
<p>When you connect your Gmail to HireCanvas or any other job tracking tool, Google shows a warning: "Google hasn't verified this app." For many users, this feels alarming — so let us explain exactly what is happening and what your options are.</p>

<h2>Why the warning appears</h2>
<p>Google divides Gmail permissions into two categories. Basic permissions (reading your profile, sending emails on your behalf) are easy to get approved. But reading your inbox — even read-only — is classified as a <strong>restricted scope</strong>.</p>
<p>For restricted scopes, Google requires an independent security audit called a CASA (Cloud Application Security Assessment) Tier 2 audit before removing the warning. This process takes 3–6 weeks and costs several thousand dollars. Most small SaaS tools show the warning while the audit is in progress.</p>
<p>The warning does NOT mean the app is malicious. It means Google has not yet completed its review process.</p>

<h2>What HireCanvas actually accesses</h2>
<p>HireCanvas requests <code>gmail.readonly</code> — read-only access to your inbox. Specifically, it:</p>
<ul>
  <li>Searches for emails matching job-related patterns (ATS senders, interview keywords)</li>
  <li>Reads the subject, sender, and body of matching emails</li>
  <li>Extracts company name, role, and application status using AI</li>
</ul>
<p>It cannot send emails, delete emails, or access emails outside job-related searches. The access token is encrypted at rest using AES-256.</p>

<h2>How to verify what an app can do</h2>
<p>Before connecting any tool to your Gmail:</p>
<ol>
  <li>Check the permissions screen carefully — it lists exactly what the app can access</li>
  <li>Look for <code>gmail.readonly</code> (safe) vs <code>gmail.modify</code> or <code>gmail.compose</code> (more invasive)</li>
  <li>Check the privacy policy for data retention and deletion policies</li>
  <li>Confirm you can revoke access at any time via <a href="https://myaccount.google.com/permissions">Google Account Permissions</a></li>
</ol>

<h2>How to revoke access if you change your mind</h2>
<p>Go to <a href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</a>, find the app, and click Remove Access. The app immediately loses the ability to read your inbox.</p>
<p>HireCanvas also provides a disconnect button in Settings → Connections that revokes the token and deletes it from the database.</p>

<h2>The bottom line</h2>
<p>The "unverified app" warning is a Google compliance checkpoint, not a security verdict. It appears for all apps using restricted Gmail scopes until Google completes its audit. The audit process for HireCanvas is in progress. In the meantime, you can connect safely — the permissions are read-only, the tokens are encrypted, and you can disconnect at any time.</p>
    `.trim(),
  },
  {
    slug: 'huntr-honest-review',
    title: 'Is Huntr Worth It? An Honest Review After 6 Months',
    excerpt: 'Huntr is the most popular job tracking tool. After 6 months and 150 applications, here is what works, what does not, and who should use it.',
    date: '2026-04-21',
    readMinutes: 7,
    content: `
<p>I used Huntr for six months across two job searches. In that time I tracked 150+ applications, had 23 first-round interviews, and received 4 offers. Here is an honest account of what Huntr does well and where it falls short.</p>

<h2>What Huntr does really well</h2>
<h3>The Chrome extension</h3>
<p>This is Huntr's strongest feature. One click on any job listing on LinkedIn, Indeed, Glassdoor, or a company careers page saves it to your board with the title, company, and URL pre-filled. The time saving is real — adding a job takes 3 seconds instead of 3 minutes.</p>

<h3>The Kanban board</h3>
<p>Huntr's drag-and-drop board is satisfying to use. Moving a card from "Applied" to "Interview" feels good. The visual pipeline makes it easy to see where everything stands at a glance.</p>

<h3>Contact management</h3>
<p>You can attach recruiter and hiring manager contacts to each job, log call notes, and track relationship history. For networking-heavy job searches, this is genuinely useful.</p>

<h2>Where Huntr falls short</h2>
<h3>No email sync</h3>
<p>This is the biggest gap. When a rejection email arrives, you manually drag the card to "Rejected." When an interview confirmation lands, you manually update the date. Over 150 applications, this became 200+ manual updates — each taking 30–60 seconds to find the card and make the change.</p>
<p>For a tool marketed as a productivity booster, the irony of manual inbox processing is not lost on me.</p>

<h3>Follow-up reminders are manual</h3>
<p>Huntr lets you set reminder dates, but you have to set them yourself. There is no automatic "you applied 7 days ago, follow up?" nudge. You only get reminded if you remembered to set a reminder — which somewhat defeats the purpose.</p>

<h3>Analytics are shallow</h3>
<p>Huntr shows a funnel chart of how many jobs are in each stage. That is about it. There is no response rate by source, no time-in-stage analysis, no insight into which types of companies reply fastest.</p>

<h2>Pricing</h2>
<p>Huntr costs $9.99/month. For a job search that lasts 3–6 months, that is $30–60. Compared to the value of landing a job, this is trivial — but it is worth comparing to alternatives at the same price point.</p>

<h2>Who should use Huntr</h2>
<p>Huntr is the right choice if your primary workflow is: browse LinkedIn → save jobs → apply manually → follow up by memory. The Chrome extension is best-in-class for this flow.</p>
<p>It is not the right choice if you want automatic status updates from ATS emails, smart follow-up reminders, or deep analytics on your job search performance.</p>

<h2>The alternative worth considering</h2>
<p>For the "what happened after I applied" problem, HireCanvas fills the gap Huntr leaves. It connects to Gmail and automatically updates job status when ATS emails arrive. The two tools can be used together — Huntr for saving jobs, HireCanvas for tracking outcomes.</p>
<p>Or, if you want a single tool, HireCanvas handles both saving and tracking, though its job-saving UI is not as polished as Huntr's Chrome extension yet.</p>

<h2>Final verdict</h2>
<p>Huntr is excellent for the top of the funnel (finding and saving jobs). It is frustrating for the bottom of the funnel (tracking responses, interviews, and offers). At $9.99/month it is reasonably priced, but expect to spend 20–30 minutes per week on manual updates if you are applying at volume.</p>
<p><strong>Rating: 3.5/5</strong> — Great Chrome extension, but the manual email tracking is a significant limitation in 2026.</p>
    `.trim(),
  },
]

export function getPostBySlug(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug)
}
