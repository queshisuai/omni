import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')

function source(path: string) {
  return readFileSync(resolve(root, path), 'utf8')
}

test('logged-in user menu trigger does not navigate to orders on click', () => {
  const header = source('components/Header.tsx')
  const loggedInStart = header.indexOf('{loggedIn ? (')
  const loggedOutStart = header.indexOf(') : (', loggedInStart)
  assert.notEqual(loggedInStart, -1)
  assert.notEqual(loggedOutStart, -1)

  const loggedInTrigger = header.slice(loggedInStart, loggedOutStart)

  assert.doesNotMatch(loggedInTrigger, /router\.push\(["']\/orders["']\)/)
  assert.match(loggedInTrigger, /setShowUserDropdown/)
})
