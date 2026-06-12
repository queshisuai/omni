package com.omni.user.client;

import com.omni.common.result.Result;
import com.omni.user.dto.SupportContextResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;

import java.util.List;

@FeignClient(contextId = "orderSupportContextInternalClient", name = "java-order", url = "${omni.order-service.url:}")
public interface OrderSupportContextInternalClient {

    @GetMapping("/api/order/internal/users/{userId}/orders")
    Result<List<SupportContextResponse.SupportContextOrder>> listOrders(
            @PathVariable("userId") Long userId,
            @RequestParam("limit") Integer limit,
            @RequestHeader("X-Internal-Token") String internalToken);

    @GetMapping("/api/order/internal/users/{userId}/tickets")
    Result<List<SupportContextResponse.SupportContextTicket>> listTickets(
            @PathVariable("userId") Long userId,
            @RequestParam("limit") Integer limit,
            @RequestHeader("X-Internal-Token") String internalToken);
}
