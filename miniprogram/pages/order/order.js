const { createOrder } = require('../../utils/api')

Page({
  data: {
    event: null,
    ticket: null,
    quantity: 1,
    total: 0,
    errorMessage: '',
    submitting: false
  },

  onLoad: function () {
    const pending = wx.getStorageSync('omni_pending_order')
    if (!pending || !pending.event || !pending.ticket) {
      this.setData({
        errorMessage: '没有可确认的订单，请先选择活动和票档'
      })
      return
    }
    const event = pending.event
    const ticket = pending.ticket
    this.setData({
      event: event,
      ticket: ticket,
      total: ticket.price
    })
  },

  decrease: function () {
    if (this.data.quantity <= 1) {
      return
    }
    this.updateQuantity(this.data.quantity - 1)
  },

  increase: function () {
    if (this.data.quantity >= 4) {
      wx.showToast({
        title: '单次最多 4 张',
        icon: 'none'
      })
      return
    }
    this.updateQuantity(this.data.quantity + 1)
  },

  updateQuantity: function (quantity) {
    this.setData({
      quantity: quantity,
      total: quantity * this.data.ticket.price
    })
  },

  goPay: function () {
    const self = this
    const event = this.data.event
    const ticket = this.data.ticket
    const token = wx.getStorageSync('omni_token')
    if (!token) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      })
      wx.switchTab({
        url: '/pages/profile/profile'
      })
      return
    }

    this.setData({ submitting: true })
    createOrder({
      sessionId: Number(ticket.sessionId),
      ticketTypeId: Number(ticket.id),
      quantity: this.data.quantity,
      unitPrice: ticket.price,
      authorizedMaxUnitPrice: ticket.price,
      attendeeIds: []
    })
      .then(function (order) {
        wx.setStorageSync('omni_pending_payment', {
          event: event,
          ticket: ticket,
          quantity: self.data.quantity,
          total: Number(order.amount || self.data.total),
          order: order
        })
        wx.navigateTo({
          url: '/pages/pay/pay'
        })
      })
      .catch(function (error) {
        wx.showToast({
          title: error.message || '创建订单失败',
          icon: 'none'
        })
      })
      .finally(function () {
        self.setData({ submitting: false })
      })
  }
})
