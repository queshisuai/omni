const { events: demoEvents } = require('../../utils/mock-data')
const { listActivities } = require('../../utils/api')
const { normalizeListActivity } = require('../../utils/activity-adapter')

Page({
  data: {
    events: [],
    allEvents: [],
    featured: null,
    tabs: ['全部', '演唱会', '音乐节', '剧场'],
    activeTab: '全部',
    loading: true,
    errorMessage: ''
  },

  onLoad: function () {
    this.fetchActivities()
  },

  fetchActivities: function () {
    const self = this
    this.setData({
      loading: true,
      errorMessage: ''
    })
    listActivities({ page: 1, size: 20 })
      .then(function (page) {
        const records = (page && page.records) || []
        const mapped = records.map(function (item, index) {
          return normalizeListActivity(item, index)
        })
        if (!mapped.length) {
          throw new Error('暂无可展示活动')
        }
        self.applyEvents(mapped)
      })
      .catch(function (error) {
        self.setData({
          loading: false,
          errorMessage: error.message || '活动接口请求失败'
        })
      })
  },

  applyEvents: function (events) {
    this.setData({
      events: events,
      allEvents: events,
      featured: events[0] || null,
      activeTab: '全部',
      loading: false,
      errorMessage: ''
    })
  },

  useDemoData: function () {
    this.applyEvents(demoEvents)
  },

  chooseTab: function (event) {
    const tab = event.currentTarget.dataset.tab
    const nextEvents = tab === '全部'
      ? this.data.allEvents
      : this.data.allEvents.filter(function (item) {
        return item.tag === tab || item.title.indexOf(tab) >= 0
      })
    this.setData({
      activeTab: tab,
      events: nextEvents,
      featured: nextEvents[0] || this.data.allEvents[0] || null
    })
  },

  goDetail: function (event) {
    const id = event.currentTarget.dataset.id
    wx.navigateTo({
      url: '/pages/detail/detail?id=' + id
    })
  }
})
