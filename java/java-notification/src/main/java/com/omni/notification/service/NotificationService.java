package com.omni.notification.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.omni.common.result.ResultCode;
import com.omni.exception.BusinessException;
import com.omni.notification.dto.InternalNotificationRequest;
import com.omni.notification.dto.NotificationSummaryResponse;
import com.omni.notification.entity.Notification;
import com.omni.notification.mapper.NotificationMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 通知服务（沙盒版 - 日志打印代替真实发送）
 */
@Service
public class NotificationService {

    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);

    private final NotificationMapper notificationMapper;

    public NotificationService(NotificationMapper notificationMapper) {
        this.notificationMapper = notificationMapper;
    }

    /**
     * 发送短信通知（沙盒版打印到日志）
     */
    public void sendSms(Long userId, Long orderId, String content) {
        Notification notification = new Notification();
        notification.setUserId(userId);
        notification.setOrderId(orderId);
        notification.setType("SMS");
        notification.setContent(content);
        applyOrderAction(notification);
        notification.setStatus(1); // 已发送

        notificationMapper.insert(notification);
        log.info("======= 模拟短信通知 =======");
        log.info("用户ID: {}, 订单ID: {}, 内容: {}", userId, orderId, content);
        log.info("============================");
    }

    /**
     * 发送邮件通知（沙盒版打印到日志）
     */
    public void sendEmail(Long userId, Long orderId, String content) {
        Notification notification = new Notification();
        notification.setUserId(userId);
        notification.setOrderId(orderId);
        notification.setType("EMAIL");
        notification.setContent(content);
        applyOrderAction(notification);
        notification.setStatus(1);

        notificationMapper.insert(notification);
        log.info("======= 模拟邮件通知 =======");
        log.info("用户ID: {}, 订单ID: {}, 内容: {}", userId, orderId, content);
        log.info("============================");
    }

    public Notification createInternalMessage(InternalNotificationRequest request) {
        if (request == null || request.getUserId() == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "通知参数不能为空");
        }
        if (!StringUtils.hasText(request.getContent())) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "通知内容不能为空");
        }
        Notification notification = new Notification();
        notification.setUserId(request.getUserId());
        notification.setOrderId(request.getOrderId());
        notification.setType(StringUtils.hasText(request.getType()) ? request.getType().trim() : "IN_APP");
        notification.setContent(request.getContent().trim());
        notification.setStatus(1);
        notification.setActionHref(trimToNull(request.getActionHref()));
        notification.setActionLabel(trimToNull(request.getActionLabel()));
        notification.setAggregateKey(trimToNull(request.getAggregateKey()));
        if (notification.getActionHref() == null && notification.getActionLabel() == null) {
            applyOrderAction(notification);
        }
        notificationMapper.insert(notification);
        return notification;
    }

    /**
     * 通知列表
     */
    public List<Notification> listNotifications(Long userId) {
        LambdaQueryWrapper<Notification> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Notification::getUserId, userId)
               .isNull(Notification::getDeletedTime)
               .orderByDesc(Notification::getCreateTime);
        return visibleNotifications(notificationMapper.selectList(wrapper));
    }

    public NotificationSummaryResponse getSummary(Long userId) {
        return buildSummary(listNotifications(userId));
    }

    @Transactional
    public NotificationSummaryResponse markAllRead(Long userId) {
        List<Notification> notifications = listNotifications(userId);
        LocalDateTime now = LocalDateTime.now();
        for (Notification notification : notifications) {
            if (notification.getReadTime() == null) {
                notification.setReadTime(now);
                notification.setUpdateTime(now);
                notificationMapper.updateById(notification);
            }
        }
        return buildSummary(notifications);
    }

    @Transactional
    public NotificationSummaryResponse markRead(Long userId, Long notificationId) {
        if (notificationId == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "通知ID不能为空");
        }
        Notification notification = notificationMapper.selectById(notificationId);
        if (notification != null
                && userId != null
                && userId.equals(notification.getUserId())
                && notification.getDeletedTime() == null
                && notification.getReadTime() == null) {
            LocalDateTime now = LocalDateTime.now();
            notification.setReadTime(now);
            notification.setUpdateTime(now);
            notificationMapper.updateById(notification);
        }
        return getSummary(userId);
    }

    @Transactional
    public NotificationSummaryResponse deleteRead(Long userId) {
        List<Notification> notifications = listNotifications(userId);
        LocalDateTime now = LocalDateTime.now();
        for (Notification notification : notifications) {
            if (notification.getReadTime() != null && notification.getDeletedTime() == null) {
                notification.setDeletedTime(now);
                notification.setUpdateTime(now);
                notificationMapper.updateById(notification);
            }
        }
        return buildSummary(visibleNotifications(notifications));
    }

    @Transactional
    public NotificationSummaryResponse deleteOne(Long userId, Long notificationId) {
        if (notificationId == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "通知ID不能为空");
        }
        Notification notification = notificationMapper.selectById(notificationId);
        if (notification != null
                && userId != null
                && userId.equals(notification.getUserId())
                && notification.getDeletedTime() == null) {
            LocalDateTime now = LocalDateTime.now();
            notification.setDeletedTime(now);
            notification.setUpdateTime(now);
            notificationMapper.updateById(notification);
        }
        return getSummary(userId);
    }

    private List<Notification> visibleNotifications(List<Notification> notifications) {
        if (notifications == null) {
            return Collections.emptyList();
        }
        return notifications.stream()
                .filter(notification -> notification.getDeletedTime() == null)
                .collect(Collectors.toList());
    }

    private NotificationSummaryResponse buildSummary(List<Notification> notifications) {
        List<Notification> visible = visibleNotifications(notifications);
        int unreadCount = 0;
        int readCount = 0;
        Map<String, Integer> typeCounts = new LinkedHashMap<>();
        for (Notification notification : visible) {
            if (notification.getReadTime() == null) {
                unreadCount++;
            } else {
                readCount++;
            }
            String type = StringUtils.hasText(notification.getType()) ? notification.getType() : "IN_APP";
            typeCounts.put(type, typeCounts.getOrDefault(type, 0) + 1);
        }
        return new NotificationSummaryResponse(unreadCount, visible.size(), readCount, typeCounts);
    }

    private void applyOrderAction(Notification notification) {
        if (notification.getOrderId() == null) {
            return;
        }
        notification.setActionHref("/orders/" + notification.getOrderId());
        notification.setActionLabel("查看相关订单");
        notification.setAggregateKey("ORDER:" + notification.getOrderId());
    }

    private String trimToNull(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
