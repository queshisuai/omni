const { getEvent } = require('../../utils/mock-data')
const { getActivityDetail } = require('../../utils/api')
const { normalizeDetailActivity, isNumericId } = require('../../utils/activity-adapter')

Page({
  data: {
    event: null,
    selectedTicketId: '',
    loading: true,
    errorMessage: ''
  },

  onLoad: function (query) {
    const id = query.id
    if (!isNumericId(id)) {
      this.loadDemoDetail(id)
      return
    }
    this.fetchDetail(id)
  },

  fetchDetail: function (id) {
    const self = this
    this.setData({
      loading: true,
      errorMessage: ''
    })
    getActivityDetail(id)
      .then(function (detail) {
        const event = normalizeDetailActivity(detail, Number(id) || 0)
        self.applyEvent(event)
      })
      .catch(function (error) {
        self.setData({
          loading: false,
          errorMessage: error.message || '活动详情请求失败'
        })
      })
  },

  loadDemoDetail: function (id) {
    const event = getEvent(id)
    event.source = 'demo'
    this.applyEvent(event)
  },

  useDemoDetail: function (event) {
    this.loadDemoDetail(event.currentTarget.dataset.id)
  },

  applyEvent: function (event) {
    this.setData({
      event: event,
      selectedTicketId: event.tickets[0].id,
      loading: false,
      errorMessage: ''
    })
  },

  selectTicket: function (event) {
    this.setData({
      selectedTicketId: event.currentTarget.dataset.id
    })
  },

  goOrder: function () {
    const activity = this.data.event
    const selectedTicketId = this.data.selectedTicketId
    const selectedTicket = activity.tickets.find(function (item) {
      return item.id === selectedTicketId
    }) || activity.tickets[0]
    wx.setStorageSync('omni_pending_order', {
      event: activity,
      ticket: selectedTicket
    })
    wx.navigateTo({
      url: '/pages/order/order'
    })
  }
})
