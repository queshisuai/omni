package com.omni.user.client;

import com.omni.common.result.Result;
import com.omni.user.dto.SupportContextResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;

import java.util.List;

@FeignClient(contextId = "notificationSupportContextInternalClient", name = "java-notification", url = "${omni.notification-service.url:}")
public interface NotificationSupportContextInternalClient {

    @GetMapping("/api/notification/internal/users/{userId}/notifications")
    Result<List<SupportContextResponse.SupportContextNotification>> listNotifications(
            @PathVariable("userId") Long userId,
            @RequestParam("limit") Integer limit,
            @RequestHeader("X-Internal-Token") String internalToken);
}
