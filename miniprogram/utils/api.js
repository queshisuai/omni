const DEFAULT_TIMEOUT = 5000

function getBaseUrl() {
  const app = getApp()
  return (app && app.globalData && app.globalData.apiBaseUrl) || 'http://localhost:8088'
}

function buildQuery(params) {
  if (!params) {
    return ''
  }
  return Object.keys(params)
    .filter(function (key) {
      return params[key] !== undefined && params[key] !== null && params[key] !== ''
    })
    .map(function (key) {
      return encodeURIComponent(key) + '=' + encodeURIComponent(String(params[key]))
    })
    .join('&')
}

function request(path, options) {
  const config = options || {}
  const token = wx.getStorageSync('omni_token')
  const headers = Object.assign({
    'Content-Type': 'application/json'
  }, config.header || {})

  if (token) {
    headers.Authorization = 'Bearer ' + token
  }

  return new Promise(function (resolve, reject) {
    wx.request({
      url: getBaseUrl() + path,
      method: config.method || 'GET',
      data: config.data,
      header: headers,
      timeout: config.timeout || DEFAULT_TIMEOUT,
      success: function (response) {
        const result = response.data
        if (!result || result.code !== 200) {
          reject(new Error((result && result.message) || '请求失败，请稍后重试'))
          return
        }
        resolve(result.data)
      },
      fail: function () {
        reject(new Error('服务暂不可用，请确认后端已启动'))
      }
    })
  })
}

function login(params) {
  return request('/api/user/login', {
    method: 'POST',
    data: params
  })
}

function listActivities(params) {
  const query = buildQuery(params || { page: 1, size: 20 })
  return request('/api/ticket/activities' + (query ? '?' + query : ''))
}

function getActivityDetail(id) {
  return request('/api/ticket/activities/' + encodeURIComponent(String(id)))
}

function createOrder(payload) {
  return request('/api/order/create', {
    method: 'POST',
    data: payload
  })
}

function listMyOrders() {
  return request('/api/order/my')
}

function mockPay(orderId) {
  return request('/api/payment/mock/pay', {
    method: 'POST',
    data: {
      orderId: orderId
    }
  })
}

module.exports = {
  request: request,
  login: login,
  listActivities: listActivities,
  getActivityDetail: getActivityDetail,
  createOrder: createOrder,
  listMyOrders: listMyOrders,
  mockPay: mockPay
}
