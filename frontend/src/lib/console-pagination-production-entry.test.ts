import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'node:test'

const srcRoot = resolve(import.meta.dirname, '..')

function readSource(relativePath: string) {
  return readFileSync(resolve(srcRoot, relativePath), 'utf8')
}

const consolePaginationPages = [
  'app/console/activities/page.tsx',
  'app/console/sessions/page.tsx',
  'app/console/artists/page.tsx',
  'app/console/tours/page.tsx',
  'app/console/audit-logs/page.tsx',
  'app/console/check-in/page.tsx',
  'app/console/exception-tasks/page.tsx',
  'app/console/organizer-ops/page.tsx',
  'app/console/orders/page.tsx',
  'app/console/reconciliation/page.tsx',
  'app/console/refunds/page.tsx',
  'app/console/risk-cases/page.tsx',
  'app/console/risk-events/page.tsx',
  'app/console/risk-resolutions/page.tsx',
  'app/console/station-config-reviews/page.tsx',
  'app/console/venue/page.tsx',
  'app/console/venue/applications/page.tsx',
]

test('pagination component exposes GlobalPagination as the standard console entry', () => {
  const component = readSource('components/Pagination.tsx')

  assert.match(component, /export function GlobalPagination\(/)
  assert.match(component, /export const Pagination = GlobalPagination/)
})

test('pagination component hides the trailing quick jumper controls', () => {
  const component = readSource('components/Pagination.tsx')

  assert.doesNotMatch(component, /跳至/)
  assert.doesNotMatch(component, /aria-label="跳转页码"/)
  assert.doesNotMatch(component, /name="page"/)
  assert.doesNotMatch(component, /submitJump/)
  assert.doesNotMatch(component, /FormEvent/)
})

test('console list pages render GlobalPagination instead of local or legacy pagination names', () => {
  for (const page of consolePaginationPages) {
    const source = readSource(page)

    assert.match(source, /GlobalPagination/, `${page} should use GlobalPagination`)
    assert.match(source, /<GlobalPagination\b/, `${page} should render GlobalPagination`)
  }
})

test('activity, session, and artist management pages do not keep local previous-next pagination blocks', () => {
  const manualPaginationPages = [
    'app/console/activities/page.tsx',
    'app/console/sessions/page.tsx',
    'app/console/artists/page.tsx',
  ]

  for (const page of manualPaginationPages) {
    const source = readSource(page)

    assert.doesNotMatch(source, /onClick=\{\(\) => [a-zA-Z]+\(page - 1\)\}/, `${page} should not keep local previous button logic`)
    assert.doesNotMatch(source, /onClick=\{\(\) => [a-zA-Z]+\(page \+ 1\)\}/, `${page} should not keep local next button logic`)
    assert.doesNotMatch(source, /当前第 \{page\} \/ \{pages\} 页/, `${page} should delegate page summary to GlobalPagination`)
  }
})

test('draft management page paginates draft rows with GlobalPagination', () => {
  const source = readSource('app/console/tours/page.tsx')

  assert.match(source, /DEFAULT_PAGE_SIZE/)
  assert.match(source, /pageRows/)
  assert.match(source, /rows\.slice\(\(page - 1\) \* DEFAULT_PAGE_SIZE, page \* DEFAULT_PAGE_SIZE\)/)
  assert.match(source, /<GlobalPagination page=\{page\} total=\{rows\.length\}/)
})
