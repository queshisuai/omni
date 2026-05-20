package com.omni.ticket.controller;

import com.omni.common.result.Result;
import com.omni.ticket.dto.TicketSalesLockRequest;
import com.omni.ticket.dto.TicketSalesOrderRequest;
import com.omni.ticket.dto.TicketSalesQuoteRequest;
import com.omni.ticket.dto.TicketSalesQuoteResponse;
import com.omni.ticket.dto.TicketSalesSeatLockResponse;
import com.omni.ticket.service.TicketSalesInternalService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/ticket/internal/sales")
public class TicketSalesInternalController {
    private final TicketSalesInternalService service;
    private final String internalApiToken;

    public TicketSalesInternalController(TicketSalesInternalService service,
                                         @Value("${internal.api.token:${INTERNAL_API_TOKEN:}}") String internalApiToken) {
        this.service = service;
        this.internalApiToken = internalApiToken;
    }

    @PostMapping("/quote")
    public Result<TicketSalesQuoteResponse> quote(@RequestBody TicketSalesQuoteRequest request,
                                                   @RequestHeader(value = "X-Internal-Token", required = false) String token) {
        if (!isValidInternalToken(token)) {
            return Result.fail(403, "无权限");
        }
        return Result.success(service.quote(request));
    }

    @PostMapping("/lock-stock")
    public Result<Void> lockStock(@RequestBody TicketSalesLockRequest request,
                                  @RequestHeader(value = "X-Internal-Token", required = false) String token) {
        if (!isValidInternalToken(token)) {
            return Result.fail(403, "无权限");
        }
        service.lockStock(request);
        return Result.success();
    }

    @PostMapping("/lock-seats")
    public Result<TicketSalesSeatLockResponse> lockSeats(@RequestBody TicketSalesLockRequest request,
                                                          @RequestHeader(value = "X-Internal-Token", required = false) String token) {
        if (!isValidInternalToken(token)) {
            return Result.fail(403, "无权限");
        }
        return Result.success(service.lockSeats(request));
    }

    @PostMapping("/confirm-sold")
    public Result<Void> confirmSold(@RequestBody TicketSalesOrderRequest request,
                                    @RequestHeader(value = "X-Internal-Token", required = false) String token) {
        if (!isValidInternalToken(token)) {
            return Result.fail(403, "无权限");
        }
        service.confirmSold(request);
        return Result.success();
    }

    @PostMapping("/release")
    public Result<Void> release(@RequestBody TicketSalesOrderRequest request,
                                @RequestHeader(value = "X-Internal-Token", required = false) String token) {
        if (!isValidInternalToken(token)) {
            return Result.fail(403, "无权限");
        }
        service.release(request);
        return Result.success();
    }

    @PostMapping("/refund")
    public Result<Void> refund(@RequestBody TicketSalesOrderRequest request,
                               @RequestHeader(value = "X-Internal-Token", required = false) String token) {
        if (!isValidInternalToken(token)) {
            return Result.fail(403, "无权限");
        }
        service.refund(request);
        return Result.success();
    }

    private boolean isValidInternalToken(String token) {
        return StringUtils.hasText(internalApiToken) && internalApiToken.equals(token);
    }
}
