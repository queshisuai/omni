package com.omni.user.service;

import com.omni.exception.BusinessException;
import com.omni.common.result.Result;
import com.omni.user.client.GrabSupportContextInternalClient;
import com.omni.user.client.NotificationSupportContextInternalClient;
import com.omni.user.client.OrderSupportContextInternalClient;
import com.omni.user.client.PaymentSupportContextInternalClient;
import com.omni.user.dto.SupportContextResponse;
import com.omni.user.entity.SupportConversation;
import com.omni.user.entity.User;
import com.omni.user.mapper.SupportAccountMapper;
import com.omni.user.mapper.SupportConversationMapper;
import com.omni.user.mapper.UserMapper;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class SupportContextServiceTest {

    @Test
    void contextResponseDefaultsToEmptySections() {
        SupportContextResponse response = SupportContextResponse.empty(1001L, 2004L, "普通用户", "139****0001");

        assertEquals(1001L, response.getConversationId());
        assertEquals(2004L, response.getUser().getUserId());
        assertEquals("普通用户", response.getUser().getNickname());
        assertEquals("139****0001", response.getUser().getPhoneMask());
        assertTrue(response.getOrders().isEmpty());
        assertTrue(response.getRefunds().isEmpty());
        assertTrue(response.getTickets().isEmpty());
        assertTrue(response.getWaitlist().isEmpty());
        assertTrue(response.getGrabRequests().isEmpty());
        assertTrue(response.getNotifications().isEmpty());
        assertTrue(response.getErrors().isEmpty());
    }

    @Test
    void loadsContextByConversationInsteadOfRequestUserId() {
        SupportConversationMapper conversationMapper = mock(SupportConversationMapper.class);
        UserMapper userMapper = mock(UserMapper.class);
        SupportAccountMapper supportAccountMapper = mock(SupportAccountMapper.class);
        SupportContextService service = new SupportContextService(conversationMapper, userMapper, supportAccountMapper);
        when(userMapper.selectById(3001L)).thenReturn(user(3001L, "support", "客服A", "13800000003"));
        when(userMapper.selectById(2004L)).thenReturn(user(2004L, "user", "普通用户", "13900000001"));
        SupportConversation conversation = conversation(1001L, 2004L, "WAITING_AGENT", null);
        when(conversationMapper.selectById(1001L)).thenReturn(conversation);

        SupportContextResponse response = service.getContext(3001L, 1001L);

        assertEquals(1001L, response.getConversationId());
        assertEquals(2004L, response.getUser().getUserId());
        assertEquals("普通用户", response.getUser().getNickname());
        assertEquals("139****0001", response.getUser().getPhoneMask());
    }

    @Test
    void aggregatesOwnerServiceSections() {
        SupportConversationMapper conversationMapper = mock(SupportConversationMapper.class);
        UserMapper userMapper = mock(UserMapper.class);
        SupportAccountMapper supportAccountMapper = mock(SupportAccountMapper.class);
        OrderSupportContextInternalClient orderClient = mock(OrderSupportContextInternalClient.class);
        PaymentSupportContextInternalClient paymentClient = mock(PaymentSupportContextInternalClient.class);
        NotificationSupportContextInternalClient notificationClient = mock(NotificationSupportContextInternalClient.class);
        GrabSupportContextInternalClient grabClient = mock(GrabSupportContextInternalClient.class);
        SupportContextService service = new SupportContextService(conversationMapper, userMapper, supportAccountMapper,
                orderClient, paymentClient, notificationClient, grabClient, "internal-token");
        mockVisibleConversation(conversationMapper, userMapper);
        when(orderClient.listOrders(2004L, 5, "internal-token")).thenReturn(Result.success(List.of(order("DM1"))));
        when(orderClient.listTickets(2004L, 5, "internal-token")).thenReturn(Result.success(List.of(ticket(6001L))));
        when(paymentClient.listRefunds(2004L, 5, "internal-token")).thenReturn(Result.success(List.of(refund(8001L))));
        when(notificationClient.listNotifications(2004L, 5, "internal-token")).thenReturn(Result.success(List.of(notification(9001L))));
        when(grabClient.listGrabRequests(2004L, 5, "internal-token")).thenReturn(Result.success(List.of(grabRequest("GRAB1"))));
        when(grabClient.listWaitlistEntries(2004L, 5, "internal-token")).thenReturn(Result.success(List.of(waitlist(7001L))));

        SupportContextResponse response = service.getContext(3001L, 1001L);

        assertEquals("DM1", response.getOrders().get(0).getOrderNo());
        assertEquals(6001L, response.getTickets().get(0).getTicketId());
        assertEquals(8001L, response.getRefunds().get(0).getId());
        assertEquals(9001L, response.getNotifications().get(0).getId());
        assertEquals("GRAB1", response.getGrabRequests().get(0).getRequestId());
        assertEquals(7001L, response.getWaitlist().get(0).getId());
        assertTrue(response.getErrors().isEmpty());
    }

    @Test
    void keepsOtherSectionsWhenRefundContextFails() {
        SupportConversationMapper conversationMapper = mock(SupportConversationMapper.class);
        UserMapper userMapper = mock(UserMapper.class);
        SupportAccountMapper supportAccountMapper = mock(SupportAccountMapper.class);
        OrderSupportContextInternalClient orderClient = mock(OrderSupportContextInternalClient.class);
        PaymentSupportContextInternalClient paymentClient = mock(PaymentSupportContextInternalClient.class);
        NotificationSupportContextInternalClient notificationClient = mock(NotificationSupportContextInternalClient.class);
        GrabSupportContextInternalClient grabClient = mock(GrabSupportContextInternalClient.class);
        SupportContextService service = new SupportContextService(conversationMapper, userMapper, supportAccountMapper,
                orderClient, paymentClient, notificationClient, grabClient, "internal-token");
        mockVisibleConversation(conversationMapper, userMapper);
        when(orderClient.listOrders(2004L, 5, "internal-token")).thenReturn(Result.success(List.of(order("DM1"))));
        when(orderClient.listTickets(2004L, 5, "internal-token")).thenReturn(Result.success(List.of(ticket(6001L))));
        when(paymentClient.listRefunds(2004L, 5, "internal-token")).thenThrow(new RuntimeException("payment down"));
        when(notificationClient.listNotifications(2004L, 5, "internal-token")).thenReturn(Result.success(List.of(notification(9001L))));
        when(grabClient.listGrabRequests(2004L, 5, "internal-token")).thenReturn(Result.success(List.of(grabRequest("GRAB1"))));
        when(grabClient.listWaitlistEntries(2004L, 5, "internal-token")).thenReturn(Result.success(List.of(waitlist(7001L))));

        SupportContextResponse response = service.getContext(3001L, 1001L);

        assertEquals(1, response.getOrders().size());
        assertEquals(1, response.getTickets().size());
        assertTrue(response.getRefunds().isEmpty());
        assertEquals(1, response.getNotifications().size());
        assertEquals(1, response.getGrabRequests().size());
        assertEquals(1, response.getWaitlist().size());
        assertEquals("refunds", response.getErrors().get(0).getSection());
        assertEquals("退款上下文暂不可用", response.getErrors().get(0).getMessage());
    }

    @Test
    void rejectsNonSupportUser() {
        SupportConversationMapper conversationMapper = mock(SupportConversationMapper.class);
        UserMapper userMapper = mock(UserMapper.class);
        SupportContextService service = new SupportContextService(conversationMapper, userMapper, null);
        when(userMapper.selectById(2004L)).thenReturn(user(2004L, "user", "普通用户", "13900000001"));

        BusinessException error = assertThrows(BusinessException.class, () -> service.getContext(2004L, 1001L));

        assertEquals("仅客服或平台管理员可以处理会话", error.getMessage());
    }

    @Test
    void supportAgentCannotReadConversationAssignedToOtherAgent() {
        SupportConversationMapper conversationMapper = mock(SupportConversationMapper.class);
        UserMapper userMapper = mock(UserMapper.class);
        SupportContextService service = new SupportContextService(conversationMapper, userMapper, null);
        when(userMapper.selectById(3001L)).thenReturn(user(3001L, "support", "客服A", "13800000003"));
        SupportConversation conversation = conversation(1001L, 2004L, "ASSIGNED", 3002L);
        when(conversationMapper.selectById(1001L)).thenReturn(conversation);

        BusinessException error = assertThrows(BusinessException.class, () -> service.getContext(3001L, 1001L));

        assertEquals("无权查看该客服会话", error.getMessage());
    }

    private static User user(Long id, String role, String nickname, String phone) {
        User user = new User();
        user.setId(id);
        user.setRole(role);
        user.setNickname(nickname);
        user.setPhone(phone);
        user.setStatus(1);
        return user;
    }

    private static void mockVisibleConversation(SupportConversationMapper conversationMapper, UserMapper userMapper) {
        when(userMapper.selectById(3001L)).thenReturn(user(3001L, "support", "客服A", "13800000003"));
        when(userMapper.selectById(2004L)).thenReturn(user(2004L, "user", "普通用户", "13900000001"));
        SupportConversation conversation = conversation(1001L, 2004L, "WAITING_AGENT", null);
        when(conversationMapper.selectById(1001L)).thenReturn(conversation);
    }

    private static SupportContextResponse.SupportContextOrder order(String orderNo) {
        SupportContextResponse.SupportContextOrder order = new SupportContextResponse.SupportContextOrder();
        order.setId(5001L);
        order.setOrderNo(orderNo);
        return order;
    }

    private static SupportContextResponse.SupportContextTicket ticket(Long ticketId) {
        SupportContextResponse.SupportContextTicket ticket = new SupportContextResponse.SupportContextTicket();
        ticket.setTicketId(ticketId);
        return ticket;
    }

    private static SupportContextResponse.SupportContextRefund refund(Long id) {
        SupportContextResponse.SupportContextRefund refund = new SupportContextResponse.SupportContextRefund();
        refund.setId(id);
        return refund;
    }

    private static SupportContextResponse.SupportContextNotification notification(Long id) {
        SupportContextResponse.SupportContextNotification notification = new SupportContextResponse.SupportContextNotification();
        notification.setId(id);
        return notification;
    }

    private static SupportContextResponse.SupportContextGrabRequest grabRequest(String requestId) {
        SupportContextResponse.SupportContextGrabRequest request = new SupportContextResponse.SupportContextGrabRequest();
        request.setRequestId(requestId);
        return request;
    }

    private static SupportContextResponse.SupportContextWaitlist waitlist(Long id) {
        SupportContextResponse.SupportContextWaitlist waitlist = new SupportContextResponse.SupportContextWaitlist();
        waitlist.setId(id);
        return waitlist;
    }

    private static SupportConversation conversation(Long id, Long userId, String status, Long assignedAgentId) {
        SupportConversation conversation = new SupportConversation();
        conversation.setId(id);
        conversation.setUserId(userId);
        conversation.setStatus(status);
        conversation.setAssignedAgentId(assignedAgentId);
        conversation.setSubject("订单咨询");
        return conversation;
    }
}
