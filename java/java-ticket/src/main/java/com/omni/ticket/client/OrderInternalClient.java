package com.omni.ticket.client;

import com.omni.common.result.Result;
import com.omni.ticket.dto.OrderInfoResponse;
import com.omni.ticket.dto.PaidOrdersBySessionsRequest;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;

import java.util.List;

@FeignClient(name = "java-order")
public interface OrderInternalClient {

    @PostMapping("/api/order/internal/paid-by-sessions")
    Result<List<OrderInfoResponse>> listPaidBySessions(@RequestBody PaidOrdersBySessionsRequest request,
                                                       @RequestHeader("X-Internal-Token") String internalToken);
}
