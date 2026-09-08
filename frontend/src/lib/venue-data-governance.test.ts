import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

test('venue cleanup migration remaps references and removes virtual ids', () => {
  const migration = readFileSync(new URL('../../../sql/production-split/ticket/20260611_venue_id_cleanup.sql', import.meta.url), 'utf8')
  const seed = readFileSync(new URL('../../../sql/seeds/prod-split-real-demo/01-ticket.sql', import.meta.url), 'utf8')

  assert.match(migration, /CREATE TEMP TABLE omni_venue_id_map/)
  assert.match(migration, /nextval\('venue_id_seq'\)/)
  assert.match(migration, /UPDATE session[\s\S]*venue_id/)
  assert.match(migration, /UPDATE session_seat[\s\S]*venue_id/)
  assert.match(migration, /UPDATE venue_application[\s\S]*venue_id/)
  assert.match(migration, /DELETE FROM venue[\s\S]*old_id/)
  assert.match(migration, /id < 930000/)
  assert.match(migration, /setval\(\s*'venue_id_seq'/)
  const venueInsert = seed.match(/INSERT INTO venue \([\s\S]*?ON CONFLICT DO NOTHING;/)?.[0] ?? ''
  const venueAreaInsert = seed.match(/INSERT INTO venue_area[\s\S]*?ON CONFLICT \(id\)[\s\S]*?;/)?.[0] ?? ''
  assert.doesNotMatch(venueInsert, /93000[0-9]/)
  assert.doesNotMatch(venueAreaInsert, /93000[0-9]/)
  assert.match(seed, /CREATE TEMP TABLE omni_seed_venue_map/)
  assert.match(seed, /INSERT INTO venue \(name, city, address, capacity, status\)/)
  assert.match(seed, /SELECT venue_id FROM omni_seed_venue_map/)
  assert.match(seed, /WHERE va\.id BETWEEN 940001 AND 940036/)
})
