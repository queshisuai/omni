package com.omni.user.client;

import com.omni.common.result.Result;
import com.omni.user.dto.NotificationMessageRequest;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;

@FeignClient(name = "java-notification")
public interface NotificationInternalClient {
    @PostMapping("/api/notification/internal/messages")
    Result<Object> createMessage(@RequestBody NotificationMessageRequest request,
                                 @RequestHeader("X-Internal-Token") String internalToken);
}
