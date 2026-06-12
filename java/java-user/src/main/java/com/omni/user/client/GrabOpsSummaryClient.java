package com.omni.user.client;

import com.omni.common.result.Result;
import com.omni.user.dto.PlatformOpsSummaryResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;

@FeignClient(contextId = "grabOpsSummaryClient", name = "grab-service", url = "${omni.grab-service.url}")
public interface GrabOpsSummaryClient {

    @GetMapping("/api/grab/admin/ops-summary")
    Result<PlatformOpsSummaryResponse.GrabSummary> getGrabOpsSummary(
            @RequestHeader("Authorization") String authorization);
}
