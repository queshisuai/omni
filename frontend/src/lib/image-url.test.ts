import test from 'node:test'
import assert from 'node:assert/strict'
import { IMAGE_FALLBACK_SRC, resolveImageSrc } from './image-url.ts'

test('keeps uploaded relative image urls renderable', () => {
  assert.equal(
    resolveImageSrc('/uploads/user/avatar/2026/05/a.jpg'),
    '/uploads/user/avatar/2026/05/a.jpg',
  )
})

test('keeps absolute http image urls renderable', () => {
  assert.equal(
    resolveImageSrc('https://cdn.example.com/posters/a.webp'),
    'https://cdn.example.com/posters/a.webp',
  )
})

test('uses shared fallback for missing image urls', () => {
  assert.equal(resolveImageSrc(''), IMAGE_FALLBACK_SRC)
  assert.equal(resolveImageSrc(null), IMAGE_FALLBACK_SRC)
})

test('rejects unsafe image url schemes', () => {
  assert.equal(resolveImageSrc('javascript:alert(1)'), IMAGE_FALLBACK_SRC)
})
