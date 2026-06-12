package com.omni.user.client;

import com.omni.common.result.Result;
import com.omni.user.dto.SupportContextResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;

import java.util.List;

@FeignClient(contextId = "grabSupportContextInternalClient", name = "grab-service", url = "${omni.grab-service.url}")
public interface GrabSupportContextInternalClient {

    @GetMapping("/api/grab/internal/users/{userId}/requests")
    Result<List<SupportContextResponse.SupportContextGrabRequest>> listGrabRequests(
            @PathVariable("userId") Long userId,
            @RequestParam("limit") Integer limit,
            @RequestHeader("X-Internal-Token") String internalToken);

    @GetMapping("/api/waitlist/internal/users/{userId}/entries")
    Result<List<SupportContextResponse.SupportContextWaitlist>> listWaitlistEntries(
            @PathVariable("userId") Long userId,
            @RequestParam("limit") Integer limit,
            @RequestHeader("X-Internal-Token") String internalToken);
}
