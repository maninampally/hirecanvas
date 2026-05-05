-- OBS-021: Seed sample interview questions so the Interview Prep page is not empty by default
-- Run once: psql $DATABASE_URL < supabase/seeds/interview_questions_seed.sql

INSERT INTO public.interview_questions (category, difficulty, question, sample_answer) VALUES

-- Behavioral
('Behavioral', 'Easy',
 'Tell me about yourself.',
 'I am a [Role] with [X] years of experience in [Industry]. I have worked on [Key Projects] and have a strong background in [Skills]. I am passionate about [Interest] and looking to bring my expertise to a company where I can continue to grow.'),

('Behavioral', 'Easy',
 'Why do you want to work here?',
 'I admire your company''s mission to [Mission] and the impact you are having in [Industry]. I believe my background in [Skill] aligns well with the challenges your team is solving, and I am excited by the opportunity to contribute and grow here.'),

('Behavioral', 'Medium',
 'Describe a time you had a conflict with a teammate. How did you handle it?',
 'I use the STAR method: Situation (we disagreed on technical approach), Task (needed consensus to move forward), Action (I scheduled a 1:1, listened carefully, and we found a middle ground), Result (we shipped on time and improved team communication).'),

('Behavioral', 'Medium',
 'Tell me about a time you failed. What did you learn?',
 'I once underestimated the complexity of a migration task and missed a sprint deadline. I learned to break large tasks into smaller milestones, communicate blockers early, and build in buffer time for unknowns.'),

('Behavioral', 'Hard',
 'Describe a situation where you had to influence someone without direct authority.',
 'I presented data-backed proposals to stakeholders, framed the benefits in terms of their goals, and built incremental trust by delivering on smaller asks first. This helped me earn buy-in for a platform migration without any formal authority.'),

-- Technical
('Technical', 'Easy',
 'What is the difference between SQL and NoSQL databases?',
 'SQL databases use structured schemas and ACID transactions (PostgreSQL, MySQL). NoSQL databases (MongoDB, Cassandra, DynamoDB) offer flexible schemas and horizontal scalability at the cost of strict consistency in some models. Choice depends on data structure and scalability needs.'),

('Technical', 'Medium',
 'Explain the concept of REST vs GraphQL.',
 'REST uses fixed endpoints per resource and is simple to cache. GraphQL uses a single endpoint where clients specify the exact data they need, reducing over-fetching and under-fetching. GraphQL is better for complex, nested data; REST is better for simple CRUD APIs.'),

('Technical', 'Medium',
 'How does indexing work in a database, and when would you use it?',
 'An index is a data structure (commonly B-tree) that speeds up queries by avoiding full table scans. Use indexes on frequently queried columns (WHERE, JOIN, ORDER BY). Avoid over-indexing as it slows writes. Composite indexes should match query patterns.'),

('Technical', 'Hard',
 'How would you design a URL shortener like bit.ly?',
 'Key components: 1) A hash function (base62 encoding of an auto-incrementing ID) to generate short codes. 2) A KV store (Redis) for O(1) lookups. 3) A relational DB for analytics/metadata. 4) CDN/cache for popular URLs. 5) Rate limiting to prevent abuse.'),

-- Situational
('Situational', 'Easy',
 'How do you prioritize tasks when you have multiple deadlines?',
 'I use the Eisenhower Matrix to classify tasks by urgency and importance. I communicate with stakeholders to align on priorities, tackle high-impact items first, and delegate or defer lower-priority work where possible.'),

('Situational', 'Medium',
 'Your manager gives you an unrealistic deadline. What do you do?',
 'I would first understand the business reason behind the deadline, then present a realistic timeline with trade-offs clearly laid out. I would propose a phased delivery: core functionality first, with enhancements to follow, so we can still deliver value on time.'),

('Situational', 'Hard',
 'You discover a critical bug in production. Walk me through your response.',
 'Immediately assess the blast radius and impact. Alert the team via incident channel. Apply a hotfix or rollback if available. Communicate status to stakeholders every 15-30 minutes. Post-incident: write a blameless post-mortem, identify root cause, and add regression tests.'),

-- Career
('Career', 'Easy',
 'Where do you see yourself in 5 years?',
 'I see myself growing into a [Senior/Lead Role], having shipped products that made a meaningful impact on users. I want to develop my skills in [Area] and ideally mentor junior team members while continuing to grow technically and as a collaborator.'),

('Career', 'Medium',
 'Why are you leaving your current job?',
 'I have learned a lot in my current role and I am proud of [Achievement]. I am now looking for an opportunity where I can [Growth Goal — e.g., work at larger scale, take on more ownership, work on a product I am passionate about].'),

('Career', 'Easy',
 'What are your greatest strengths?',
 'I am a strong communicator who can translate complex technical concepts to non-technical stakeholders. I am also highly detail-oriented and thrive in fast-paced environments where I need to context-switch and deliver under pressure.')

ON CONFLICT DO NOTHING;
