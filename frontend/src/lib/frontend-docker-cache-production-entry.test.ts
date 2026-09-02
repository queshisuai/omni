import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const composePath = resolve(import.meta.dirname, '../../..', 'docker-compose.yml')

test('frontend docker service does not reuse stale Next.js build cache', (t) => {
  if (!existsSync(composePath)) {
    t.skip('docker-compose.yml is outside the frontend container mount')
    return
  }

  const compose = readFileSync(composePath, 'utf8')
  const frontendStart = compose.indexOf('  frontend:')
  assert.notEqual(frontendStart, -1)
  const volumesStart = compose.indexOf('\nvolumes:', frontendStart)
  const frontendBlock = compose.slice(frontendStart, volumesStart === -1 ? compose.length : volumesStart)

  assert.match(frontendBlock, /image:\s*node:24-alpine/)
  assert.match(frontendBlock, /\.\/frontend:\/app/)
  assert.match(frontendBlock, /pnpm dev --hostname 0\.0\.0\.0/)
  assert.doesNotMatch(frontendBlock, /frontend-next-cache:\/app\/\.next/)
  assert.doesNotMatch(compose, /^\s*frontend-next-cache:\s*$/m)
  assert.match(frontendBlock, /\/app\/\.next/)
})
