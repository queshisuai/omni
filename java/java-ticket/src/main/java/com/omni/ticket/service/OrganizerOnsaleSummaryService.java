package com.omni.ticket.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.omni.common.result.ResultCode;
import com.omni.exception.BusinessException;
import com.omni.ticket.entity.Activity;
import com.omni.ticket.mapper.ActivityMapper;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
public class OrganizerOnsaleSummaryService {

    private final ActivityMapper activityMapper;
    private final UserAccessService userAccessService;

    public OrganizerOnsaleSummaryService(ActivityMapper activityMapper,
                                         UserAccessService userAccessService) {
        this.activityMapper = activityMapper;
        this.userAccessService = userAccessService;
    }

    public Map<Long, Long> batchSummary(Long operatorId, List<Long> organizerIds) {
        requirePermission(operatorId);
        List<Long> ids = normalizeIds(organizerIds);
        if (ids.isEmpty()) return Collections.emptyMap();

        QueryWrapper<Activity> wrapper = new QueryWrapper<Activity>()
                .select("organizer_id AS organizerId", "COUNT(*) AS count")
                .in("organizer_id", ids)
                .eq("publish_status", "published")
                .eq("status", 1)
                .groupBy("organizer_id");
        return activityMapper.selectMaps(wrapper).stream().collect(Collectors.toMap(
                row -> ((Number) row.get("organizerId")).longValue(),
                row -> ((Number) row.get("count")).longValue(),
                Long::sum,
                LinkedHashMap::new));
    }

    private List<Long> normalizeIds(List<Long> organizerIds) {
        if (organizerIds == null) return List.of();
        return organizerIds.stream()
                .filter(Objects::nonNull)
                .filter(id -> id > 0)
                .distinct()
                .limit(50)
                .collect(Collectors.toList());
    }

    private void requirePermission(Long operatorId) {
        if (operatorId == null || !userAccessService.hasPlatformPermission(
                operatorId, "organizer.review", "organizer.account.manage")) {
            throw new BusinessException(ResultCode.FORBIDDEN, "无权限");
        }
    }
}
