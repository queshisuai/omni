const gradients = [
  'linear-gradient(145deg, #0f172a, #1d4ed8 54%, #7c3aed)',
  'linear-gradient(145deg, #831843, #ec4899 52%, #f97316)',
  'linear-gradient(145deg, #111827, #b45309 54%, #f59e0b)',
  'linear-gradient(145deg, #064e3b, #059669 54%, #22c55e)'
]

function formatDateTime(value) {
  if (!value) {
    return { date: '待定', time: '' }
  }
  const normalized = String(value).replace('T', ' ')
  const parts = normalized.split(' ')
  const dateParts = (parts[0] || '').split('-')
  const time = (parts[1] || '').slice(0, 5)
  if (dateParts.length >= 3) {
    return {
      date: Number(dateParts[1]) + '月' + Number(dateParts[2]) + '日',
      time: time
    }
  }
  return { date: parts[0] || '待定', time: time }
}

function artistNameFrom(vo) {
  if (vo && vo.artists && vo.artists.length) {
    return vo.artists.map(function (artist) {
      return artist.name || artist.artistName
    }).filter(Boolean).join(' / ')
  }
  return (vo && vo.artistName) || '万象现场'
}

function priceNumber(value) {
  const price = Number(value)
  return Number.isFinite(price) ? price : 0
}

function normalizeListActivity(vo, index) {
  const time = formatDateTime(vo.startTime)
  return {
    id: String(vo.id),
    source: 'api',
    title: vo.name || '未命名活动',
    artist: artistNameFrom(vo),
    city: vo.venueCity || '待定',
    venue: vo.venueCity || '待定',
    date: time.date,
    time: time.time,
    tag: vo.categoryName || '活动',
    minPrice: priceNumber(vo.minPrice),
    gradient: gradients[index % gradients.length],
    summary: '真实接口活动数据，来自 Omni ticket 服务。',
    tickets: [],
    raw: vo
  }
}

function normalizeDetailActivity(detail, index) {
  const activity = detail.activity || {}
  const firstSession = detail.sessions && detail.sessions.length ? detail.sessions[0] : {}
  const session = firstSession.session || {}
  const venue = firstSession.venue || {}
  const ticketTypes = firstSession.ticketTypes || []
  const time = formatDateTime(session.startTime || activity.startTime)
  const tickets = ticketTypes.map(function (ticket) {
    return {
      id: String(ticket.id),
      sessionId: String(ticket.sessionId || session.id || ''),
      name: ticket.name || '标准票',
      area: ticket.seatBlockId ? '座位区 ' + ticket.seatBlockId : '普通观演区',
      price: priceNumber(ticket.price),
      stock: ticket.remainStock === undefined || ticket.remainStock === null ? 0 : ticket.remainStock,
      raw: ticket
    }
  })

  return {
    id: String(activity.id),
    source: 'api',
    title: activity.name || '未命名活动',
    artist: artistNameFrom({
      artists: detail.artists,
      artistName: detail.artist && detail.artist.name
    }),
    city: venue.city || '待定',
    venue: venue.name || '待定场馆',
    date: time.date,
    time: time.time,
    tag: detail.category && detail.category.name ? detail.category.name : '活动',
    minPrice: tickets.length ? Math.min.apply(null, tickets.map(function (ticket) { return ticket.price })) : 0,
    gradient: gradients[index % gradients.length],
    summary: activity.description || '真实接口活动详情，包含场次与票档信息。',
    tickets: tickets.length ? tickets : [{
      id: '0',
      sessionId: String(session.id || ''),
      name: '暂未配置票档',
      area: '待配置',
      price: 0,
      stock: 0
    }],
    raw: detail
  }
}

function isNumericId(id) {
  return /^\d+$/.test(String(id || ''))
}

module.exports = {
  normalizeListActivity: normalizeListActivity,
  normalizeDetailActivity: normalizeDetailActivity,
  isNumericId: isNumericId
}
