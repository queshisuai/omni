package com.omni.common.mq.message;

import java.io.Serializable;

/**
 * 候补订单已支付消息 — 替代 WaitlistInternalClient.orderPaid() Feign 调用
 */
public class WaitlistOrderPaidMessage implements Serializable {
    private static final long serialVersionUID = 1L;

    private Long orderId;

    public WaitlistOrderPaidMessage() {}

    public WaitlistOrderPaidMessage(Long orderId) {
        this.orderId = orderId;
    }

    public Long getOrderId() { return orderId; }
    public void setOrderId(Long orderId) { this.orderId = orderId; }
}
