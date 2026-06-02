package com.omni.notification.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.omni.notification.dto.InternalNotificationRequest;
import com.omni.notification.dto.NotificationSummaryResponse;
import com.omni.notification.entity.Notification;
import com.omni.notification.mapper.NotificationMapper;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class NotificationServiceTest {

    private final NotificationMapper notificationMapper = mock(NotificationMapper.class);
    private final NotificationService service = new NotificationService(notificationMapper);

    @Test
    void createInternalMessagePersistsActionAndAggregateMetadata() {
        InternalNotificationRequest request = new InternalNotificationRequest();
        request.setUserId(10L);
        request.setType("SUPPORT_REPLY");
        request.setContent("人工客服回复了你的咨询，请查看客服会话。");
        request.setActionHref("/help");
        request.setActionLabel("查看客服会话");
        request.setAggregateKey("SUPPORT_REPLY:99");

        service.createInternalMessage(request);

        ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);
        verify(notificationMapper).insert(captor.capture());
        Notification saved = captor.getValue();
        assertEquals("/help", saved.getActionHref());
        assertEquals("查看客服会话", saved.getActionLabel());
        assertEquals("SUPPORT_REPLY:99", saved.getAggregateKey());
        assertNull(saved.getReadTime());
        assertNull(saved.getDeletedTime());
    }

    @Test
    void createInternalMessageDefaultsOrderActionWhenMetadataMissing() {
        InternalNotificationRequest request = new InternalNotificationRequest();
        request.setUserId(10L);
        request.setOrderId(9001L);
        request.setType("WAITLIST_OFFERED");
        request.setContent("候补订单待支付");

        service.createInternalMessage(request);

        ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);
        verify(notificationMapper).insert(captor.capture());
        Notification saved = captor.getValue();
        assertEquals("/orders/9001", saved.getActionHref());
        assertEquals("查看相关订单", saved.getActionLabel());
        assertEquals("ORDER:9001", saved.getAggregateKey());
    }

    @Test
    void createInternalMessageReturnsExistingVisibleAggregateMessageWithoutInsert() {
        InternalNotificationRequest request = new InternalNotificationRequest();
        request.setUserId(10L);
        request.setType("SUPPORT_REPLY");
        request.setContent("人工客服回复了你的咨询，请查看客服会话。");
        request.setAggregateKey("SUPPORT_REPLY:99");
        Notification existing = notification(99L, 10L, null, null);
        existing.setAggregateKey("SUPPORT_REPLY:99");
        when(notificationMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(existing);

        Notification result = service.createInternalMessage(request);

        assertSame(existing, result);
        verify(notificationMapper, never()).insert(any());
    }

    @Test
    void createInternalMessageReturnsExistingOrderAggregateMessageWithoutInsert() {
        InternalNotificationRequest request = new InternalNotificationRequest();
        request.setUserId(10L);
        request.setOrderId(9001L);
        request.setType("WAITLIST_OFFERED");
        request.setContent("候补订单待支付");
        Notification existing = notification(100L, 10L, null, null);
        existing.setOrderId(9001L);
        existing.setAggregateKey("ORDER:9001");
        when(notificationMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(existing);

        Notification result = service.createInternalMessage(request);

        assertSame(existing, result);
        verify(notificationMapper, never()).insert(any());
    }

    @Test
    void listNotificationsOnlyReturnsVisibleUserNotifications() {
        Notification visible = notification(1L, 10L, null, null);
        Notification deleted = notification(2L, 10L, null, LocalDateTime.now());
        when(notificationMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(visible, deleted));

        List<Notification> result = service.listNotifications(10L);

        assertEquals(List.of(visible), result);
    }

    @Test
    void markAllReadMarksOnlyUnreadVisibleNotificationsAndReturnsSummary() {
        Notification unread = notification(1L, 10L, null, null);
        Notification alreadyRead = notification(2L, 10L, LocalDateTime.now().minusMinutes(5), null);
        when(notificationMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(unread, alreadyRead));

        NotificationSummaryResponse summary = service.markAllRead(10L);

        ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);
        verify(notificationMapper).updateById(captor.capture());
        Notification updated = captor.getValue();
        assertEquals(1L, updated.getId());
        assertNotNull(updated.getReadTime());
        assertEquals(0, summary.getUnreadCount());
        assertEquals(2, summary.getVisibleCount());
        assertEquals(2, summary.getReadCount());
    }

    @Test
    void deleteReadHidesOnlyReadVisibleNotificationsAndReturnsSummary() {
        Notification read = notification(1L, 10L, LocalDateTime.now().minusMinutes(5), null);
        Notification unread = notification(2L, 10L, null, null);
        when(notificationMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(read, unread));

        NotificationSummaryResponse summary = service.deleteRead(10L);

        ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);
        verify(notificationMapper).updateById(captor.capture());
        Notification updated = captor.getValue();
        assertEquals(1L, updated.getId());
        assertNotNull(updated.getDeletedTime());
        assertEquals(1, summary.getUnreadCount());
        assertEquals(1, summary.getVisibleCount());
        assertEquals(0, summary.getReadCount());
    }

    @Test
    void markOneReadIgnoresOtherUsersNotifications() {
        Notification otherUserNotification = notification(1L, 99L, null, null);
        when(notificationMapper.selectById(1L)).thenReturn(otherUserNotification);

        NotificationSummaryResponse summary = service.markRead(10L, 1L);

        assertEquals(0, summary.getVisibleCount());
    }

    private static Notification notification(Long id, Long userId, LocalDateTime readTime, LocalDateTime deletedTime) {
        Notification notification = new Notification();
        notification.setId(id);
        notification.setUserId(userId);
        notification.setType("SUPPORT_REPLY");
        notification.setContent("客服消息");
        notification.setStatus(1);
        notification.setCreateTime(LocalDateTime.now());
        notification.setReadTime(readTime);
        notification.setDeletedTime(deletedTime);
        return notification;
    }
}
