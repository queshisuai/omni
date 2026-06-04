const { mockPay } = require('../../utils/api')

Page({
  data: {
    event: null,
    ticket: null,
    quantity: 1,
    total: 0,
    paying: false,
    errorMessage: '',
    order: null
  },

  onLoad: function () {
    const pending = wx.getStorageSync('omni_pending_payment')
    if (!pending || !pending.event || !pending.ticket) {
      this.setData({
        errorMessage: '没有可支付的订单，请重新提交订单'
      })
      return
    }
    this.setData({
      event: pending.event,
      ticket: pending.ticket,
      quantity: pending.quantity || 1,
      total: pending.total || 0,
      order: pending.order || null
    })
  },

  mockPay: function () {
    const self = this
    if (this.data.paying) {
      return
    }
    if (!this.data.order || !this.data.order.id) {
      wx.showToast({
        title: '缺少后端订单，请重新提交订单',
        icon: 'none'
      })
      return
    }
    this.setData({ paying: true })
    mockPay(this.data.order.id)
      .then(function (result) {
        wx.removeStorageSync('omni_pending_payment')
        wx.removeStorageSync('omni_pending_order')
        wx.redirectTo({
          url: '/pages/success/success?orderId=' + result.orderId + '&orderNo=' + encodeURIComponent(result.orderNo || '') + '&paymentNo=' + encodeURIComponent(result.paymentNo || '')
        })
      })
      .catch(function (error) {
        wx.showToast({
          title: error.message || '模拟支付失败',
          icon: 'none'
        })
      })
      .finally(function () {
        self.setData({
          paying: false
        })
      })
  }
})
