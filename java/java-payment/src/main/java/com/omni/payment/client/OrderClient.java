package com.omni.payment.client;

import com.omni.common.result.Result;
import com.omni.payment.dto.MarkPartialRefundedRequest;
import com.omni.payment.dto.OrderInfoResponse;
import com.omni.payment.dto.OrderRefundOptionsResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;

@FeignClient(name = "java-order")
public interface OrderClient {

    @GetMapping("/api/order/internal/{id}")
    Result<OrderInfoResponse> getOrder(@PathVariable("id") Long id,
                                        @RequestHeader("X-Internal-Token") String internalToken);

    @GetMapping("/api/order/internal/{id}/refund-options")
    Result<OrderRefundOptionsResponse> getRefundOptions(@PathVariable("id") Long id,
                                                        @RequestHeader("X-Internal-Token") String internalToken);

    @PostMapping("/api/order/internal/{id}/paid")
    Result<OrderInfoResponse> markPaid(@PathVariable("id") Long id,
                                        @RequestHeader("X-Internal-Token") String internalToken);

    @PostMapping("/api/order/internal/{id}/refunded")
    Result<OrderInfoResponse> markRefunded(@PathVariable("id") Long id,
                                           @RequestHeader("X-Internal-Token") String internalToken);

    @PostMapping("/api/order/internal/{id}/partial-refunded")
    Result<OrderInfoResponse> markPartialRefunded(@PathVariable("id") Long id,
                                                  @RequestBody MarkPartialRefundedRequest request,
                                                  @RequestHeader("X-Internal-Token") String internalToken);
}
