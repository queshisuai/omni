const app = getApp()
const { login } = require('../../utils/api')

Page({
  data: {
    user: app.globalData.user,
    apiBaseUrl: app.globalData.apiBaseUrl,
    tokenStatus: '未登录',
    loggingIn: false
  },

  onShow: function () {
    this.refreshLoginState()
  },

  refreshLoginState: function () {
    const storedUser = wx.getStorageSync('omni_user')
    const token = wx.getStorageSync('omni_token')
    if (storedUser && token) {
      app.globalData.user = storedUser
      this.setData({
        user: storedUser,
        tokenStatus: '已登录'
      })
      return
    }
    this.setData({
      user: app.globalData.user,
      tokenStatus: '未登录'
    })
  },

  quickLogin: function () {
    if (this.data.loggingIn) {
      return
    }
    const self = this
    this.setData({ loggingIn: true })
    login({
      loginType: 'password',
      account: '13900000001',
      password: '123456'
    })
      .then(function (result) {
        wx.setStorageSync('omni_token', result.token)
        wx.setStorageSync('omni_user', {
          userId: result.userId,
          phone: result.phone,
          nickname: result.nickname,
          avatar: result.avatar,
          role: result.role
        })
        app.globalData.user = wx.getStorageSync('omni_user')
        self.setData({
          user: app.globalData.user,
          tokenStatus: '已登录'
        })
        wx.showToast({
          title: '登录成功',
          icon: 'success'
        })
      })
      .catch(function (error) {
        wx.showToast({
          title: error.message || '登录失败',
          icon: 'none'
        })
      })
      .finally(function () {
        self.setData({ loggingIn: false })
      })
  },

  clearLogin: function () {
    wx.removeStorageSync('omni_token')
    wx.removeStorageSync('omni_user')
    this.refreshLoginState()
    wx.showToast({
      title: '已退出登录',
      icon: 'none'
    })
  }
})
