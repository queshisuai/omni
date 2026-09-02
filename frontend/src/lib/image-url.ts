export const IMAGE_FALLBACK_SRC = '/background.png'

const INTERNAL_IMAGE_EXT_RE = /\.(avif|gif|jpe?g|png|svg|webp)(?:[?#].*)?$/i

function normalizeImageSrc(value: string | null | undefined) {
  return typeof value === 'string' ? value.trim() : ''
}

export function isRenderableImageSrc(value: string | null | undefined) {
  const src = normalizeImageSrc(value)
  if (!src) return false

  if (src.startsWith('/')) {
    if (src.startsWith('//')) return false
    return src.startsWith('/uploads/') || INTERNAL_IMAGE_EXT_RE.test(src)
  }

  try {
    const url = new URL(src)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function resolveImageSrc(value: string | null | undefined, fallbackSrc = IMAGE_FALLBACK_SRC) {
  const fallback = isRenderableImageSrc(fallbackSrc) ? normalizeImageSrc(fallbackSrc) : IMAGE_FALLBACK_SRC
  if (!isRenderableImageSrc(value)) return fallback
  return normalizeImageSrc(value)
}
