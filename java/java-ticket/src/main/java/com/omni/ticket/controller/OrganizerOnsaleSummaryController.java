package com.omni.ticket.controller;

import com.omni.common.result.Result;
import com.omni.common.result.ResultCode;
import com.omni.common.util.JwtUtil;
import com.omni.ticket.dto.OrganizerOnsaleSummaryRequest;
import com.omni.ticket.dto.OrganizerOnsaleSummaryResponse;
import com.omni.ticket.service.OrganizerOnsaleSummaryService;
import io.jsonwebtoken.Claims;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/ticket/admin/organizers")
public class OrganizerOnsaleSummaryController {

    private static final String BEARER_PREFIX = "Bearer ";
    private final OrganizerOnsaleSummaryService summaryService;

    public OrganizerOnsaleSummaryController(OrganizerOnsaleSummaryService summaryService) {
        this.summaryService = summaryService;
    }

    @PostMapping("/batch-onsale-summary")
    public Result<List<OrganizerOnsaleSummaryResponse>> batchSummary(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestBody(required = false) OrganizerOnsaleSummaryRequest request) {
        Long operatorId = parseOperatorId(authorization);
        if (operatorId == null) {
            return Result.fail(ResultCode.UNAUTHORIZED);
        }

        List<Long> ids = normalizeIds(request == null ? null : request.getOrganizerIds());
        Map<Long, Long> counts = summaryService.batchSummary(operatorId, ids);
        List<OrganizerOnsaleSummaryResponse> responses = new ArrayList<>();
        for (Long id : ids) {
            OrganizerOnsaleSummaryResponse response = new OrganizerOnsaleSummaryResponse();
            response.setOrganizerId(id);
            response.setOnsaleActivityCount(counts.getOrDefault(id, 0L));
            response.setAvailable(true);
            responses.add(response);
        }
        return Result.success(responses);
    }

    private List<Long> normalizeIds(List<Long> organizerIds) {
        if (organizerIds == null || organizerIds.isEmpty()) {
            return List.of();
        }
        Set<Long> normalized = new LinkedHashSet<>();
        for (Long id : organizerIds) {
            if (id != null && id > 0 && normalized.size() < 50) {
                normalized.add(id);
            }
        }
        return new ArrayList<>(normalized);
    }

    private Long parseOperatorId(String authorization) {
        if (!StringUtils.hasText(authorization) || !authorization.startsWith(BEARER_PREFIX)) {
            return null;
        }
        try {
            Claims claims = JwtUtil.parseToken(authorization.substring(BEARER_PREFIX.length()));
            return Long.valueOf(claims.getSubject());
        } catch (RuntimeException e) {
            return null;
        }
    }
}
