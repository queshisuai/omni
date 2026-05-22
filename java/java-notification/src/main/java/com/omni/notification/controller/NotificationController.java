package com.omni.notification.controller;

import com.omni.common.result.Result;
import com.omni.notification.dto.InternalNotificationRequest;
import com.omni.notification.entity.Notification;
import com.omni.notification.service.NotificationService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 通知接口
 */
@RestController
@RequestMapping("/api/notification")
public class NotificationController {

    private final NotificationService notificationService;
    private final String internalApiToken;

    public NotificationController(NotificationService notificationService,
                                  @Value("${internal.api.token:${INTERNAL_API_TOKEN:}}") String internalApiToken) {
        this.notificationService = notificationService;
        this.internalApiToken = internalApiToken;
    }

    @PostMapping("/internal/messages")
    public Result<Notification> createInternalMessage(@RequestHeader(value = "X-Internal-Token", required = false) String token,
                                                      @RequestBody(required = false) InternalNotificationRequest request) {
        if (!StringUtils.hasText(internalApiToken) || !internalApiToken.equals(token)) {
            return Result.fail(403, "无权限");
        }
        return Result.success(notificationService.createInternalMessage(request));
    }

    /**
     * 发送短信通知
     */
    @PostMapping("/send-sms")
    public Result<Void> sendSms(@RequestBody Map<String, Object> body) {
        Long userId = Long.valueOf(body.get("userId").toString());
        Long orderId = body.get("orderId") != null ? Long.valueOf(body.get("orderId").toString()) : null;
        String content = body.get("content").toString();
        notificationService.sendSms(userId, orderId, content);
        return Result.success();
    }

    /**
     * 发送邮件通知
     */
    @PostMapping("/send-email")
    public Result<Void> sendEmail(@RequestBody Map<String, Object> body) {
        Long userId = Long.valueOf(body.get("userId").toString());
        Long orderId = body.get("orderId") != null ? Long.valueOf(body.get("orderId").toString()) : null;
        String content = body.get("content").toString();
        notificationService.sendEmail(userId, orderId, content);
        return Result.success();
    }

    /**
     * 用户通知列表
     */
    @GetMapping("/list")
    public Result<List<Notification>> listNotifications(@RequestParam Long userId) {
        List<Notification> notifications = notificationService.listNotifications(userId);
        return Result.success(notifications);
    }
}
