const events = [
  {
    id: 'concert-blue-night',
    title: '星河回响巡回演唱会',
    artist: 'Blue Echo',
    city: '上海',
    venue: '梅赛德斯奔驰文化中心',
    date: '6月18日',
    time: '19:30',
    tag: '热门',
    minPrice: 280,
    gradient: 'linear-gradient(145deg, #0f172a, #1d4ed8 54%, #7c3aed)',
    summary: '沉浸式舞台、全场环绕灯光与经典曲目返场，适合作为票务购票流程演示主活动。',
    tickets: [
      { id: 'a', name: '看台票', area: '三层看台', price: 280, stock: 86 },
      { id: 'b', name: '内场票', area: '一层内场', price: 580, stock: 42 },
      { id: 'c', name: 'VIP票', area: '前排中心', price: 880, stock: 18 }
    ]
  },
  {
    id: 'festival-pink-sky',
    title: '夏日音浪音乐节',
    artist: 'City Live',
    city: '杭州',
    venue: '奥体中心草坪',
    date: '7月06日',
    time: '16:00',
    tag: '音乐节',
    minPrice: 199,
    gradient: 'linear-gradient(145deg, #831843, #ec4899 52%, #f97316)',
    summary: '户外双舞台音乐节，包含下午场、夜场和限定周边展示。',
    tickets: [
      { id: 'a', name: '单日票', area: '普通观演区', price: 199, stock: 120 },
      { id: 'b', name: '双日通票', area: '普通观演区', price: 329, stock: 68 },
      { id: 'c', name: '前区票', area: '前排观演区', price: 499, stock: 26 }
    ]
  },
  {
    id: 'theater-gold-room',
    title: '沉浸式剧场夜航',
    artist: 'Stage One',
    city: '北京',
    venue: '蜂巢剧场',
    date: '7月20日',
    time: '20:00',
    tag: '剧场',
    minPrice: 168,
    gradient: 'linear-gradient(145deg, #111827, #b45309 54%, #f59e0b)',
    summary: '小剧场沉浸式演出，适合展示座位、票档与订单确认细节。',
    tickets: [
      { id: 'a', name: '标准票', area: '普通席', price: 168, stock: 64 },
      { id: 'b', name: '优选票', area: '中区席', price: 268, stock: 31 },
      { id: 'c', name: '尊享票', area: '前排席', price: 368, stock: 12 }
    ]
  }
]

function getEvent(id) {
  return events.find(function (item) {
    return item.id === id
  }) || events[0]
}

function getTicket(event, ticketId) {
  return event.tickets.find(function (item) {
    return item.id === ticketId
  }) || event.tickets[0]
}

module.exports = {
  events: events,
  getEvent: getEvent,
  getTicket: getTicket
}
