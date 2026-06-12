import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), 'utf8')
}

test('payment and notification core services do not present production modules as sandbox mocks', () => {
  const paymentPom = source('../../../java/java-payment/pom.xml')
  const paymentApplication = source('../../../java/java-payment/src/main/resources/application.yml')
  const paymentController = source('../../../java/java-payment/src/main/java/com/omni/payment/controller/PaymentController.java')
  const paymentService = source('../../../java/java-payment/src/main/java/com/omni/payment/service/PaymentService.java')
  const paymentConfirmationService = source('../../../java/java-payment/src/main/java/com/omni/payment/service/PaymentConfirmationService.java')
  const mockPaymentService = source('../../../java/java-payment/src/main/java/com/omni/payment/service/MockPaymentService.java')
  const notificationService = source('../../../java/java-notification/src/main/java/com/omni/notification/service/NotificationService.java')

  assert.doesNotMatch(paymentPom, /支付服务\s*-\s*模拟支付/)
  assert.doesNotMatch(paymentApplication, /openapi-sandbox\.dl\.alipaydev\.com/)
  assert.doesNotMatch(paymentApplication, /ALIPAY_APP_ID:[^}]+/)
  assert.doesNotMatch(paymentApplication, /ALIPAY_MERCHANT_PRIVATE_KEY:[^}]+/)
  assert.doesNotMatch(paymentApplication, /ALIPAY_PUBLIC_KEY:[^}]+/)
  assert.doesNotMatch(paymentApplication, /ALIPAY_RETURN_URL:http:\/\/localhost/)

  assert.doesNotMatch(paymentController, /未启用模拟支付/)

  assert.doesNotMatch(paymentService, /public\s+Payment\s+mockPay\s*\(/)
  assert.doesNotMatch(paymentService, /支付服务（沙盒版 - 模拟支付）/)
  assert.doesNotMatch(paymentService, /沙盒模拟支付，自动成功/)
  assert.doesNotMatch(paymentService, /模拟支付成功:/)

  assert.doesNotMatch(paymentConfirmationService, /confirmMockPayment/)

  assert.doesNotMatch(mockPaymentService, /\.mockPay\s*\(/)
  assert.doesNotMatch(mockPaymentService, /模拟支付成功/)

  assert.doesNotMatch(notificationService, /通知服务（沙盒版 - 日志打印代替真实发送）/)
  assert.doesNotMatch(notificationService, /发送短信通知（沙盒版打印到日志）/)
  assert.doesNotMatch(notificationService, /发送邮件通知（沙盒版打印到日志）/)
  assert.doesNotMatch(notificationService, /模拟短信通知/)
  assert.doesNotMatch(notificationService, /模拟邮件通知/)
})
