package com.omni.notification.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.omni.common.result.ResultCode;
import com.omni.exception.BusinessException;
import com.omni.notification.dto.InternalNotificationRequest;
import com.omni.notification.entity.Notification;
import com.omni.notification.mapper.NotificationMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.List;

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
        notificationMapper.insert(notification);
        return notification;
    }

    /**
     * 通知列表
     */
    public List<Notification> listNotifications(Long userId) {
        LambdaQueryWrapper<Notification> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Notification::getUserId, userId)
               .orderByDesc(Notification::getCreateTime);
        return notificationMapper.selectList(wrapper);
    }
}
