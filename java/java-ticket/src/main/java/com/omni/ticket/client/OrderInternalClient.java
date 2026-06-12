package com.omni.ticket.client;

import com.omni.common.result.Result;
import com.omni.ticket.dto.CheckInOverviewRequest;
import com.omni.ticket.dto.CheckInOverviewResponse;
import com.omni.ticket.dto.CheckInRecordQueryRequest;
import com.omni.ticket.dto.CheckInRecordResponse;
import com.omni.ticket.dto.OrderInfoResponse;
import com.omni.ticket.dto.PaidOrderCountRequest;
import com.omni.ticket.dto.PaidOrderCountResponse;
import com.omni.ticket.dto.PaidOrdersBySessionsRequest;
import com.omni.ticket.dto.SessionSeatUsageRequest;
import com.omni.ticket.dto.SessionSeatUsageResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;

import java.util.List;

@FeignClient(name = "java-order")
public interface OrderInternalClient {

    @GetMapping("/api/order/internal/{id}")
    Result<OrderInfoResponse> getOrderDetail(@PathVariable("id") Long id,
                                             @RequestHeader("X-Internal-Token") String internalToken);

    @PostMapping("/api/order/internal/paid-by-sessions")
    Result<List<OrderInfoResponse>> listPaidBySessions(@RequestBody PaidOrdersBySessionsRequest request,
                                                       @RequestHeader("X-Internal-Token") String internalToken);

    @PostMapping("/api/order/internal/paid-count-by-sessions")
    Result<PaidOrderCountResponse> countPaidBySessions(@RequestBody PaidOrderCountRequest request,
                                                        @RequestHeader("X-Internal-Token") String internalToken);

    @PostMapping("/api/order/internal/session-seats/usage")
    Result<SessionSeatUsageResponse> inspectSessionSeatUsage(@RequestBody SessionSeatUsageRequest request,
                                                             @RequestHeader("X-Internal-Token") String internalToken);

    @PostMapping("/api/order/internal/tickets/check-in/records")
    Result<List<CheckInRecordResponse>> listCheckInRecords(@RequestBody CheckInRecordQueryRequest request,
                                                           @RequestHeader("X-Internal-Token") String internalToken);

    @PostMapping("/api/order/internal/tickets/check-in/overview")
    Result<CheckInOverviewResponse> getCheckInOverview(@RequestBody CheckInOverviewRequest request,
                                                       @RequestHeader("X-Internal-Token") String internalToken);
}
