package com.omni.order.client;

import com.omni.common.result.Result;
import com.omni.order.dto.TicketSalesLockRequest;
import com.omni.order.dto.TicketSalesOrderRequest;
import com.omni.order.dto.TicketSalesQuoteRequest;
import com.omni.order.dto.TicketSalesQuoteResponse;
import com.omni.order.dto.TicketSalesReleaseResponse;
import com.omni.order.dto.TicketSalesSeatLockResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;

@FeignClient(name = "java-ticket")
public interface TicketSalesInternalClient {

    @PostMapping("/api/ticket/internal/sales/quote")
    Result<TicketSalesQuoteResponse> quote(@RequestBody TicketSalesQuoteRequest request,
                                           @RequestHeader("X-Internal-Token") String internalToken);

    @PostMapping("/api/ticket/internal/sales/lock-stock")
    Result<Void> lockStock(@RequestBody TicketSalesLockRequest request,
                           @RequestHeader("X-Internal-Token") String internalToken);

    @PostMapping("/api/ticket/internal/sales/lock-seats")
    Result<TicketSalesSeatLockResponse> lockSeats(@RequestBody TicketSalesLockRequest request,
                                                   @RequestHeader("X-Internal-Token") String internalToken);

    @PostMapping("/api/ticket/internal/sales/validate-team-seat-lock")
    Result<TicketSalesSeatLockResponse> validateTeamSeatLock(@RequestBody TicketSalesLockRequest request,
                                                             @RequestHeader("X-Internal-Token") String internalToken);

    @PostMapping("/api/ticket/internal/sales/confirm-sold")
    Result<Void> confirmSold(@RequestBody TicketSalesOrderRequest request,
                             @RequestHeader("X-Internal-Token") String internalToken);

    @PostMapping("/api/ticket/internal/sales/release")
    Result<TicketSalesReleaseResponse> release(@RequestBody TicketSalesOrderRequest request,
                                               @RequestHeader("X-Internal-Token") String internalToken);

    @PostMapping("/api/ticket/internal/sales/refund")
    Result<TicketSalesReleaseResponse> refund(@RequestBody TicketSalesOrderRequest request,
                                              @RequestHeader("X-Internal-Token") String internalToken);
}
