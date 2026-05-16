package com.omni.notification.controller;

import com.omni.common.result.Result;
import com.omni.notification.entity.Notification;
import com.omni.notification.service.NotificationService;
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

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
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
