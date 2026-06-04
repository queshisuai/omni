package com.omni.payment.service;

import com.omni.common.result.Result;
import com.omni.common.result.ResultCode;
import com.omni.exception.BusinessException;
import com.omni.payment.client.OrderClient;
import com.omni.payment.dto.MockPayResponse;
import com.omni.payment.dto.OrderInfoResponse;
import com.omni.payment.entity.Payment;
import io.seata.spring.annotation.GlobalTransactional;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class MockPaymentService {

    private static final int ORDER_STATUS_PENDING = 1;
    private static final int ORDER_STATUS_PAID = 2;

    private final OrderClient orderClient;
    private final PaymentService paymentService;
    private final PaymentConfirmationService paymentConfirmationService;
    private final String internalApiToken;

    public MockPaymentService(OrderClient orderClient,
                              PaymentService paymentService,
                              PaymentConfirmationService paymentConfirmationService,
                              @Value("${internal.api.token:${INTERNAL_API_TOKEN:}}") String internalApiToken) {
        this.orderClient = orderClient;
        this.paymentService = paymentService;
        this.paymentConfirmationService = paymentConfirmationService;
        this.internalApiToken = internalApiToken;
    }

    @GlobalTransactional(name = "omni-mock-payment", rollbackFor = Exception.class)
    @Transactional(rollbackFor = Exception.class)
    public MockPayResponse pay(Long orderId, Long userId) {
        if (orderId == null || orderId <= 0) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "订单ID不正确");
        }
        if (userId == null || userId <= 0) {
            throw new BusinessException(ResultCode.UNAUTHORIZED, "请先登录");
        }

        OrderInfoResponse order = getOrder(orderId);
        if (order == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "订单不存在");
        }
        if (order.getUserId() == null || !order.getUserId().equals(userId)) {
            throw new BusinessException(ResultCode.FORBIDDEN, "不能支付他人的订单");
        }
        if (Integer.valueOf(ORDER_STATUS_PAID).equals(order.getStatus())) {
            return buildResponse(order, null, "订单已支付");
        }
        if (!Integer.valueOf(ORDER_STATUS_PENDING).equals(order.getStatus())) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "当前订单状态不允许支付");
        }

        Payment payment = paymentService.mockPay(order.getId(), order.getAmount());
        paymentConfirmationService.confirmMockPayment(payment);
        return buildResponse(order, payment.getPaymentNo(), "模拟支付成功");
    }

    private OrderInfoResponse getOrder(Long orderId) {
        String token = requireInternalApiToken();
        Result<OrderInfoResponse> result = orderClient.getOrder(orderId, token);
        if (result == null || result.getCode() != ResultCode.SUCCESS.getCode()) {
            throw new BusinessException(ResultCode.INTERNAL_ERROR, "订单服务暂不可用");
        }
        return result.getData();
    }

    private MockPayResponse buildResponse(OrderInfoResponse order, String paymentNo, String message) {
        MockPayResponse response = new MockPayResponse();
        response.setOrderId(order.getId());
        response.setOrderNo(order.getOrderNo());
        response.setPaymentNo(paymentNo);
        response.setOrderStatus(ORDER_STATUS_PAID);
        response.setMessage(message);
        return response;
    }

    private String requireInternalApiToken() {
        if (!StringUtils.hasText(internalApiToken)) {
            throw new BusinessException(ResultCode.INTERNAL_ERROR, "内部接口令牌未配置");
        }
        return internalApiToken;
    }
}
