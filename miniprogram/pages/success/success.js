Page({
  data: {
    orderId: '',
    orderNo: '',
    paymentNo: ''
  },

  onLoad: function (query) {
    this.setData({
      orderId: query.orderId || '',
      orderNo: query.orderNo || '',
      paymentNo: query.paymentNo || ''
    })
  },

  goOrders: function () {
    wx.switchTab({
      url: '/pages/orders/orders'
    })
  },

  goHome: function () {
    wx.switchTab({
      url: '/pages/home/home'
    })
  }
})
