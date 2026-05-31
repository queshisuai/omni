package com.omni.order.client;

import com.omni.common.result.Result;
import com.omni.order.dto.WaitlistReleaseRequest;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;

@FeignClient(name = "waitlist-service", url = "${waitlist.service.url:http://localhost:3001}")
public interface WaitlistInternalClient {
    @PostMapping("/api/waitlist/internal/released")
    Result<Object> released(@RequestBody WaitlistReleaseRequest request,
                            @RequestHeader("X-Internal-Token") String internalToken);

    @PostMapping("/api/waitlist/internal/orders/{orderId}/paid")
    Result<Object> orderPaid(@PathVariable("orderId") Long orderId,
                             @RequestHeader("X-Internal-Token") String internalToken);
}
