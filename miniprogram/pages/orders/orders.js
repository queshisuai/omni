const { listMyOrders } = require('../../utils/api')
const { normalizeOrderItem } = require('../../utils/order-adapter')

Page({
  data: {
    orders: [],
    loading: false,
    errorMessage: ''
  },

  onShow: function () {
    this.loadOrders()
  },

  loadOrders: function () {
    const self = this
    const token = wx.getStorageSync('omni_token')
    if (!token) {
      this.setData({
        orders: [],
        loading: false,
        errorMessage: '请先登录后查看真实订单'
      })
      return
    }

    this.setData({
      loading: true,
      errorMessage: ''
    })
    listMyOrders()
      .then(function (orders) {
        self.setData({
          orders: (orders || []).map(normalizeOrderItem),
          loading: false,
          errorMessage: ''
        })
      })
      .catch(function (error) {
        self.setData({
          orders: [],
          loading: false,
          errorMessage: error.message || '订单列表请求失败'
        })
      })
  },

  refreshOrders: function () {
    this.loadOrders()
  },

  goHome: function () {
    wx.switchTab({
      url: '/pages/home/home'
    })
  },

  goProfile: function () {
    wx.switchTab({
      url: '/pages/profile/profile'
    })
  }
})
