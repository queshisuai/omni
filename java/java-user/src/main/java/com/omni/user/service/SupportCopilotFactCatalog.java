package com.omni.user.service;

import com.omni.user.dto.CsCopilotSourceEvidenceResponse;
import com.omni.user.dto.SupportContextResponse;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/**
 * Copilot 唯一事实白名单。这里不暴露 SupportContext 的完整结构。
 */
public final class SupportCopilotFactCatalog {

    private SupportCopilotFactCatalog() {
    }

    public static List<String> keys(SupportContextResponse context) {
        return new ArrayList<>(facts(context).keySet());
    }

    public static Map<String, String> snapshot(SupportContextResponse context) {
        return Collections.unmodifiableMap(facts(context));
    }

    public static List<CsCopilotSourceEvidenceResponse> hydrateEvidence(
            List<String> factKeys, SupportContextResponse context) {
        Map<String, String> facts = facts(context);
        List<CsCopilotSourceEvidenceResponse> result = new ArrayList<>();
        for (String factKey : factKeys == null ? Collections.<String>emptyList() : factKeys) {
            if (!facts.containsKey(factKey)) {
                throw new IllegalArgumentException("引用了不存在的事实");
            }
            CsCopilotSourceEvidenceResponse item = new CsCopilotSourceEvidenceResponse();
            item.setFactKey(factKey);
            item.setText(facts.get(factKey));
            result.add(item);
        }
        return result;
    }

    private static Map<String, String> facts(SupportContextResponse context) {
        Map<String, String> facts = new TreeMap<>();
        if (context == null) return facts;
        if (context.getOrders() != null && !context.getOrders().isEmpty()) {
            SupportContextResponse.SupportContextOrder order = context.getOrders().get(0);
            put(facts, "order.amount", order.getAmount(), value ->
                    "订单金额为 " + value);
            put(facts, "order.orderNo", order.getOrderNo(), value ->
                    "订单号为 " + value);
            put(facts, "order.status", order.getStatus(), value ->
                    "订单状态为 " + value);
        }
        if (context.getRefunds() != null && !context.getRefunds().isEmpty()) {
            SupportContextResponse.SupportContextRefund refund = context.getRefunds().get(0);
            put(facts, "refund.status", refund.getStatus(), value ->
                    "退款状态为 " + value);
            put(facts, "refund.orderNo", refund.getOrderNo(), value ->
                    "退款关联订单号为 " + value);
        }
        if (context.getTickets() != null && !context.getTickets().isEmpty()) {
            SupportContextResponse.SupportContextTicket ticket = context.getTickets().get(0);
            put(facts, "ticket.ticketId", ticket.getTicketId(), value ->
                    "票券 ID 为 " + value);
            put(facts, "ticket.status", ticket.getStatus(), value ->
                    "票券状态为 " + value);
            put(facts, "ticket.checkedIn", ticket.getCheckedIn(), value ->
                    "票券验票状态为 " + (Boolean.parseBoolean(value) ? "已验票" : "未验票"));
        }
        if (context.getGrabRequests() != null && !context.getGrabRequests().isEmpty()) {
            SupportContextResponse.SupportContextGrabRequest grab = context.getGrabRequests().get(0);
            put(facts, "grab.status", grab.getStatus(), value ->
                    "抢票状态为 " + value);
            put(facts, "grab.queueRank", grab.getQueueRank(), value ->
                    "抢票队列排名为 " + value);
        }
        if (context.getWaitlist() != null && !context.getWaitlist().isEmpty()) {
            SupportContextResponse.SupportContextWaitlist waitlist = context.getWaitlist().get(0);
            put(facts, "waitlist.status", waitlist.getStatus(), value ->
                    "候补状态为 " + value);
            put(facts, "waitlist.rank", waitlist.getRank(), value ->
                    "候补排名为 " + value);
        }
        if (context.getNotifications() != null && !context.getNotifications().isEmpty()) {
            SupportContextResponse.SupportContextNotification notification = context.getNotifications().get(0);
            put(facts, "notification.type", notification.getType(), value ->
                    "最近通知类型为 " + value);
            put(facts, "notification.read", notification.getRead(), value ->
                    "最近通知已读状态为 " + (Boolean.parseBoolean(value) ? "已读" : "未读"));
        }
        return facts;
    }

    private static <T> void put(Map<String, String> target, String key, T value,
                                java.util.function.Function<String, String> textFactory) {
        if (value == null) return;
        String text = value instanceof BigDecimal
                ? ((BigDecimal) value).stripTrailingZeros().toPlainString()
                : String.valueOf(value);
        if (!text.isBlank()) target.put(key, textFactory.apply(text));
    }
}
