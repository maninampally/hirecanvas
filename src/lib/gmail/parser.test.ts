import test from 'node:test'
import assert from 'node:assert/strict'
import { inferFromSubject, inferEmailDirection, extractEmailAddress, parseJobSignal } from './parser'

// inferFromSubject

test('inferFromSubject: offer letter pattern', () => {
  const r = inferFromSubject('Congratulations! Your job offer from Stripe', 'careers@stripe.com')
  assert.equal(r.status, 'Offer')
  assert.ok(r.confidence >= 0.9)
})

test('inferFromSubject: rejection pattern', () => {
  const r = inferFromSubject('Unfortunately we are not moving forward with your application', 'no-reply@acme.com')
  assert.equal(r.status, 'Rejected')
  assert.ok(r.confidence >= 0.9)
})

test('inferFromSubject: interview invitation', () => {
  const r = inferFromSubject('Interview invitation for Software Engineer role', 'recruiting@google.com')
  assert.equal(r.status, 'Interview')
  assert.ok(r.confidence >= 0.85)
})

test('inferFromSubject: coding challenge', () => {
  const r = inferFromSubject('Your HackerRank coding challenge from Meta', 'noreply@hackerrank.com')
  assert.equal(r.status, 'Screening')
  assert.ok(r.confidence >= 0.85)
})

test('inferFromSubject: application received', () => {
  const r = inferFromSubject('Thank you for applying to Backend Engineer at Stripe', 'careers@stripe.com')
  assert.equal(r.status, 'Applied')
  assert.ok(r.confidence >= 0.80)
})

test('inferFromSubject: no match returns null status and zero confidence', () => {
  const r = inferFromSubject('Your weekly newsletter', 'newsletter@linkedin.com')
  assert.equal(r.status, null)
  assert.equal(r.confidence, 0)
})

test('inferFromSubject: extracts company from subject when present', () => {
  const r = inferFromSubject('Thank you for applying at Stripe — we received your application', 'careers@stripe.com')
  assert.equal(r.status, 'Applied')
  assert.ok(r.company !== null)
})

test('inferFromSubject: falls back to domain extraction when no "at Company" in subject', () => {
  const r = inferFromSubject('Thank you for applying — we received your application', 'careers@stripe.com')
  assert.equal(r.status, 'Applied')
  assert.equal(r.company, 'Stripe')
})

// extractEmailAddress

test('extractEmailAddress: bare email', () => {
  assert.equal(extractEmailAddress('user@example.com'), 'user@example.com')
})

test('extractEmailAddress: name + bracket format', () => {
  assert.equal(extractEmailAddress('John Doe <john@example.com>'), 'john@example.com')
})

test('extractEmailAddress: null input', () => {
  assert.equal(extractEmailAddress(null), null)
})

test('extractEmailAddress: string without @', () => {
  assert.equal(extractEmailAddress('notanemail'), null)
})

// inferEmailDirection

test('inferEmailDirection: same address = outbound', () => {
  const d = inferEmailDirection({ from: 'user@gmail.com', userEmail: 'user@gmail.com' })
  assert.equal(d, 'outbound')
})

test('inferEmailDirection: different address = inbound', () => {
  const d = inferEmailDirection({ from: 'recruiter@stripe.com', userEmail: 'user@gmail.com' })
  assert.equal(d, 'inbound')
})

test('inferEmailDirection: missing from = unknown', () => {
  const d = inferEmailDirection({ from: undefined, userEmail: 'user@gmail.com' })
  assert.equal(d, 'unknown')
})

test('inferEmailDirection: bracket format from', () => {
  const d = inferEmailDirection({ from: 'Recruiter Name <recruiter@stripe.com>', userEmail: 'user@gmail.com' })
  assert.equal(d, 'inbound')
})

// parseJobSignal

test('parseJobSignal: returns parsed signal with company and status', () => {
  const r = parseJobSignal({ subject: 'Your application to Google — next steps', from: 'careers@google.com' })
  assert.ok(r.inferredStatus !== null || r.company !== null)
})

test('parseJobSignal: empty inputs return nulls', () => {
  const r = parseJobSignal({ subject: '', from: '' })
  assert.equal(r.company, null)
  assert.equal(r.inferredStatus, null)
})
