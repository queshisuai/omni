import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { inflateSync } from 'node:zlib'

const appRoot = resolve(import.meta.dirname, '..', '..')
const legacyFaviconSha256 = '2b8ad2d33455a8f736fc3a8ebf8f0bdea8848ad4c0db48a2833bd0f9cd775932'

function parseIcoSizes(buffer: Buffer) {
  assert.equal(buffer.readUInt16LE(0), 0)
  assert.equal(buffer.readUInt16LE(2), 1)

  const count = buffer.readUInt16LE(4)
  return Array.from({ length: count }, (_, index) => {
    const offset = 6 + index * 16
    const width = buffer.readUInt8(offset) || 256
    const height = buffer.readUInt8(offset + 1) || 256
    return `${width}x${height}`
  }).sort((a, b) => Number(a.split('x')[0]) - Number(b.split('x')[0]))
}

function readLargestIcoPng(buffer: Buffer) {
  const count = buffer.readUInt16LE(4)
  const entries = Array.from({ length: count }, (_, index) => {
    const offset = 6 + index * 16
    const width = buffer.readUInt8(offset) || 256
    const height = buffer.readUInt8(offset + 1) || 256
    const size = buffer.readUInt32LE(offset + 8)
    const imageOffset = buffer.readUInt32LE(offset + 12)
    return { width, height, image: buffer.subarray(imageOffset, imageOffset + size) }
  })
  return entries.sort((a, b) => b.width * b.height - a.width * a.height)[0]
}

function readPngRgba(buffer: Buffer) {
  assert.deepEqual([...buffer.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10])

  let offset = 8
  let width = 0
  let height = 0
  let bitDepth = 0
  let colorType = 0
  const idat: Buffer[] = []

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset)
    const type = buffer.toString('ascii', offset + 4, offset + 8)
    const data = buffer.subarray(offset + 8, offset + 8 + length)

    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      bitDepth = data.readUInt8(8)
      colorType = data.readUInt8(9)
    } else if (type === 'IDAT') {
      idat.push(data)
    } else if (type === 'IEND') {
      break
    }

    offset += length + 12
  }

  assert.equal(bitDepth, 8)
  assert.equal(colorType, 6)

  const channels = 4
  const stride = width * channels
  const inflated = inflateSync(Buffer.concat(idat))
  const pixels = Buffer.alloc(width * height * channels)
  let sourceOffset = 0

  for (let y = 0; y < height; y += 1) {
    const filter = inflated[sourceOffset]
    sourceOffset += 1

    for (let x = 0; x < stride; x += 1) {
      const raw = inflated[sourceOffset + x]
      const left = x >= channels ? pixels[y * stride + x - channels] : 0
      const up = y > 0 ? pixels[(y - 1) * stride + x] : 0
      const upLeft = y > 0 && x >= channels ? pixels[(y - 1) * stride + x - channels] : 0
      let value = raw

      if (filter === 1) value = raw + left
      else if (filter === 2) value = raw + up
      else if (filter === 3) value = raw + Math.floor((left + up) / 2)
      else if (filter === 4) {
        const p = left + up - upLeft
        const pa = Math.abs(p - left)
        const pb = Math.abs(p - up)
        const pc = Math.abs(p - upLeft)
        value = raw + (pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft)
      } else {
        assert.equal(filter, 0)
      }

      pixels[y * stride + x] = value & 255
    }

    sourceOffset += stride
  }

  return { width, height, pixels }
}

function rgbaAt(image: ReturnType<typeof readPngRgba>, x: number, y: number) {
  const offset = (y * image.width + x) * 4
  return [...image.pixels.subarray(offset, offset + 4)]
}

function countColorEdges(image: ReturnType<typeof readPngRgba>) {
  let edges = 0
  for (let y = 48; y <= 208; y += 10) {
    let previous = rgbaAt(image, 32, y)
    for (let x = 33; x < 224; x += 1) {
      const current = rgbaAt(image, x, y)
      const distance =
        Math.abs(current[0] - previous[0]) +
        Math.abs(current[1] - previous[1]) +
        Math.abs(current[2] - previous[2])
      if (distance >= 60) edges += 1
      previous = current
    }
  }
  return edges
}

test('unused static QR placeholder is not kept in public assets', () => {
  assert.equal(existsSync(resolve(appRoot, 'public/1.png')), false)
})

test('unused legacy carousel placeholder is not kept in public assets', () => {
  assert.equal(existsSync(resolve(appRoot, 'public/carousel.png')), false)
})

test('unused legacy logo hero png is not kept in public assets', () => {
  assert.equal(existsSync(resolve(appRoot, 'public/logo.png')), false)
})

test('favicon is a project-logo ico asset rather than the legacy placeholder', () => {
  const favicon = readFileSync(resolve(appRoot, 'src/app/favicon.ico'))
  const sha256 = createHash('sha256').update(favicon).digest('hex')
  const sizes = parseIcoSizes(favicon)

  assert.notEqual(sha256, legacyFaviconSha256)
  assert.deepEqual(sizes, ['16x16', '32x32', '48x48', '64x64', '128x128', '256x256'])
})

test('favicon uses the selected detailed ring source without recoloring', () => {
  const favicon = readFileSync(resolve(appRoot, 'src/app/favicon.ico'))
  const largest = readLargestIcoPng(favicon)
  const image = readPngRgba(largest.image)

  assert.equal(largest.width, 256)
  assert.equal(largest.height, 256)
  assert.deepEqual(
    [
      rgbaAt(image, 128, 50),
      rgbaAt(image, 80, 80),
      rgbaAt(image, 176, 86),
      rgbaAt(image, 138, 100),
    ],
    [
      [88, 255, 255, 255],
      [102, 208, 255, 255],
      [255, 115, 233, 255],
      [206, 152, 116, 255],
    ],
  )
})

test('favicon keeps the project fine-line ring mark instead of a generic thick loop', () => {
  const favicon = readFileSync(resolve(appRoot, 'src/app/favicon.ico'))
  const largest = readLargestIcoPng(favicon)
  const image = readPngRgba(largest.image)

  assert.ok(countColorEdges(image) >= 900)
})
