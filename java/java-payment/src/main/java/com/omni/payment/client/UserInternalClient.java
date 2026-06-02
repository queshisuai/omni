package com.omni.payment.client;

import com.omni.common.dto.InternalAuthContextResponse;
import com.omni.common.result.Result;
import com.omni.payment.dto.InternalUserRefResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;

@FeignClient(name = "java-user")
public interface UserInternalClient {

    @GetMapping("/api/user/internal/{id}")
    Result<InternalUserRefResponse> getUserRef(@PathVariable("id") Long id,
                                               @RequestHeader("X-Internal-Token") String internalToken);

    @GetMapping("/api/user/internal/auth/context/{id}")
    Result<InternalAuthContextResponse> getAuthContext(@PathVariable("id") Long id,
                                                       @RequestHeader("X-Internal-Token") String internalToken);
}
