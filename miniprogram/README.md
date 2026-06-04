# Omni 微信小程序演示说明

本目录是毕业设计演示用微信小程序，使用个人主体开发版即可运行，不接真实微信支付。

## 运行前准备

1. 启动后端服务：
   - `java-gateway`
   - `java-user`
   - `java-ticket`
   - `java-order`
   - `java-payment`
2. 确认网关地址可访问：
   - `http://localhost:8088`
3. 微信开发者工具导入本目录：
   - `D:\Documents\omni\miniprogram`
4. 开发者工具本地设置中开启：
   - 不校验合法域名
   - 不校验 HTTPS 证书
   - 不校验 TLS 版本

## 演示账号

小程序「我的」页提供一键登录，使用项目内置普通用户：

```text
账号：13900000001
密码：123456
角色：user
```

## 演示流程

```text
我的 -> 一键登录测试账号
首页 -> 选择活动
活动详情 -> 选择票档 -> 立即购票
确认订单 -> 提交订单
模拟支付 -> 确认模拟支付
支付成功 -> 查看订单
```

## 已接入接口

```text
POST /api/user/login
GET  /api/ticket/activities
GET  /api/ticket/activities/{id}
POST /api/order/create
POST /api/payment/mock/pay
GET  /api/order/my
```

## 支付说明

`POST /api/payment/mock/pay` 是毕业设计演示接口：

- 不调用微信支付。
- 不产生真实扣款。
- 会写入 payment 记录。
- 会通过 order internal API 将订单状态更新为 `2 已支付`。

## 常见问题

如果首页提示服务不可用，请确认后端服务已启动，并且小程序 `app.js` 中的 `apiBaseUrl` 指向正确网关地址。

如果提交订单提示请先登录，请先进入「我的」页点击一键登录测试账号。
