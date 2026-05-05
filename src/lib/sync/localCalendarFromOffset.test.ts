import test from 'node:test'
import assert from 'node:assert/strict'
import { localCalendarYmdFromUtc, startOfLocalDayUtcIso } from './localCalendarFromOffset'

// Reference instants (no DST — fixed offset only).
test('UTC-5 (e.g. US Eastern): local calendar date from UTC instant', () => {
  const utc = new Date('2026-01-15T07:30:00.000Z')
  const offset = 300 // getTimezoneOffset-style: positive when local behind UTC
  assert.equal(localCalendarYmdFromUtc(utc, offset), '2026-01-15')
})

test('UTC+5:30: local calendar rolls to next local day', () => {
  const utc = new Date('2026-01-15T18:45:00.000Z')
  const offset = -330
  assert.equal(localCalendarYmdFromUtc(utc, offset), '2026-01-16')
})

test('startOfLocalDayUtcIso is inverse anchor for “today start” queries', () => {
  const ymd = '2026-03-10'
  const offset = 300
  const iso = startOfLocalDayUtcIso(ymd, offset)
  assert.equal(iso, new Date(Date.UTC(2026, 2, 10, 5, 0, 0)).toISOString())
})
