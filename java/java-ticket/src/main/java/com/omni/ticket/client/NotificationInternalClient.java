package com.omni.ticket.client;

import com.omni.common.mq.message.NotificationEventMessage;
import com.omni.common.result.Result;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;

@FeignClient(name = "java-notification", url = "${omni.notification-service.url:}")
public interface NotificationInternalClient {

    @PostMapping("/api/notification/internal/events")
    Result<Void> createInternalEvent(@RequestBody NotificationEventMessage message,
                                     @RequestHeader("X-Internal-Token") String internalToken);
}
