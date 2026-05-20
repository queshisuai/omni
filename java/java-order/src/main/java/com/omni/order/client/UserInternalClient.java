package com.omni.order.client;

import com.omni.common.result.Result;
import com.omni.order.dto.InternalUserRefResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;

@FeignClient(name = "java-user")
public interface UserInternalClient {

    @GetMapping("/api/user/internal/{id}")
    Result<InternalUserRefResponse> getUserRef(@PathVariable("id") Long id,
                                               @RequestHeader("X-Internal-Token") String internalToken);
}
