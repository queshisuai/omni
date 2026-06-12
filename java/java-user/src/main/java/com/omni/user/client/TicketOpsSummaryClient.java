package com.omni.user.client;

import com.omni.common.result.Result;
import com.omni.user.dto.PlatformOpsSummaryResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;

@FeignClient(contextId = "ticketOpsSummaryClient", name = "java-ticket", url = "${omni.ticket-service.url:}")
public interface TicketOpsSummaryClient {

    @GetMapping("/api/ticket/admin/summary")
    Result<PlatformOpsSummaryResponse.TicketSummary> getAdminSummary(
            @RequestHeader("Authorization") String authorization);
}
