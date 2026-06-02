package com.omni.order.client;

import com.omni.common.dto.InternalAuthContextResponse;
import com.omni.common.result.Result;
import com.omni.order.dto.InternalUserRefResponse;
import com.omni.order.dto.ResolveAttendeesRequest;
import com.omni.order.dto.ResolvedAttendeeResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;

import java.util.List;

@FeignClient(name = "java-user")
public interface UserInternalClient {

    @GetMapping("/api/user/internal/{id}")
    Result<InternalUserRefResponse> getUserRef(@PathVariable("id") Long id,
                                               @RequestHeader("X-Internal-Token") String internalToken);

    @GetMapping("/api/user/internal/auth/context/{id}")
    Result<InternalAuthContextResponse> getAuthContext(@PathVariable("id") Long id,
                                                       @RequestHeader("X-Internal-Token") String internalToken);

    @PostMapping("/api/user/internal/attendees/resolve")
    Result<List<ResolvedAttendeeResponse>> resolveAttendees(@RequestBody ResolveAttendeesRequest request,
                                                            @RequestHeader("X-Internal-Token") String internalToken);
}
