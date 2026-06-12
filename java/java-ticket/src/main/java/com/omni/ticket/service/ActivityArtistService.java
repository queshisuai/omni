package com.omni.ticket.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.omni.common.result.Result;
import com.omni.ticket.client.OrderInternalClient;
import com.omni.ticket.dto.ActivityArtistDto;
import com.omni.ticket.mq.NotificationMqProducer;
import com.omni.ticket.dto.OrderInfoResponse;
import com.omni.ticket.dto.PaidOrdersBySessionsRequest;
import com.omni.ticket.entity.ActivityArtist;
import com.omni.ticket.entity.Artist;
import com.omni.ticket.entity.Session;
import com.omni.ticket.mapper.ActivityArtistMapper;
import com.omni.ticket.mapper.ArtistMapper;
import com.omni.ticket.mapper.SessionMapper;
import com.omni.ticket.search.ActivitySearchIndexEventPublisher;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class ActivityArtistService {
    private static final String VISIBILITY_PUBLIC = "public";
    private static final String VISIBILITY_HIDDEN = "hidden";

    private final ActivityArtistMapper activityArtistMapper;
    private final ArtistMapper artistMapper;
    private final SessionMapper sessionMapper;
    private final OrderInternalClient orderInternalClient;
    private final NotificationMqProducer notificationProducer;
    private final String internalToken;
    private ActivitySearchIndexEventPublisher searchIndexEventPublisher;

    public ActivityArtistService(ActivityArtistMapper activityArtistMapper, ArtistMapper artistMapper) {
        this(activityArtistMapper, artistMapper, null, null, null, null);
    }

    @Autowired
    public ActivityArtistService(ActivityArtistMapper activityArtistMapper,
                                 ArtistMapper artistMapper,
                                 SessionMapper sessionMapper,
                                 OrderInternalClient orderInternalClient,
                                 NotificationMqProducer notificationProducer,
                                 @Value("${internal.api.token:${INTERNAL_API_TOKEN:}}") String internalToken) {
        this.activityArtistMapper = activityArtistMapper;
        this.artistMapper = artistMapper;
        this.sessionMapper = sessionMapper;
        this.orderInternalClient = orderInternalClient;
        this.notificationProducer = notificationProducer;
        this.internalToken = internalToken;
    }

    @Autowired(required = false)
    public void setSearchIndexEventPublisher(ActivitySearchIndexEventPublisher searchIndexEventPublisher) {
        this.searchIndexEventPublisher = searchIndexEventPublisher;
    }

    @Transactional
    public void saveLineup(Long activityId, List<ActivityArtistDto> artists) {
        if (activityId == null || activityId <= 0) throw new IllegalArgumentException("活动ID不正确");
        List<ActivityArtistDto> before = listAdminLineup(activityId);
        activityArtistMapper.delete(new LambdaQueryWrapper<ActivityArtist>().eq(ActivityArtist::getActivityId, activityId));
        List<ActivityArtistDto> normalized = normalize(artists);
        LocalDateTime now = LocalDateTime.now();
        for (ActivityArtistDto dto : normalized) {
            ActivityArtist row = new ActivityArtist();
            row.setActivityId(activityId);
            row.setArtistId(dto.getArtistId());
            row.setSort(dto.getSort());
            row.setPrimary(Boolean.TRUE.equals(dto.getPrimary()));
            row.setRoleType(defaultText(dto.getRoleType(), row.getPrimary() ? "primary" : "performer"));
            row.setRoleName(defaultText(dto.getRoleName(), row.getPrimary() ? "主艺人" : "参演艺人"));
            row.setVisibility(defaultText(dto.getVisibility(), VISIBILITY_PUBLIC));
            row.setStatus(1);
            row.setCreateTime(now);
            row.setUpdateTime(now);
            activityArtistMapper.insert(row);
        }
        notifyCastChange(activityId, before, normalized);
        publishSearchUpsert(activityId);
    }

    public List<ActivityArtistDto> listAdminLineup(Long activityId) {
        return listLineup(activityId, false);
    }

    public List<ActivityArtistDto> listPublicLineup(Long activityId) {
        return listLineup(activityId, true);
    }

    public String buildPublicSummary(Long activityId) {
        return listPublicLineup(activityId).stream()
                .map(ActivityArtistDto::getName)
                .filter(StringUtils::hasText)
                .collect(Collectors.joining("、"));
    }

    private List<ActivityArtistDto> normalize(List<ActivityArtistDto> artists) {
        if (artists == null || artists.isEmpty()) return List.of();
        Set<Long> seen = new HashSet<>();
        List<Long> ids = new ArrayList<>();
        int primaryCount = 0;
        for (ActivityArtistDto dto : artists) {
            if (dto == null || dto.getArtistId() == null || dto.getArtistId() <= 0) {
                throw new IllegalArgumentException("艺人信息不正确");
            }
            if (!seen.add(dto.getArtistId())) throw new IllegalArgumentException("同一活动不能重复选择同一艺人");
            ids.add(dto.getArtistId());
            if (Boolean.TRUE.equals(dto.getPrimary())) primaryCount++;
            String visibility = defaultText(dto.getVisibility(), VISIBILITY_PUBLIC);
            if (!VISIBILITY_PUBLIC.equals(visibility) && !VISIBILITY_HIDDEN.equals(visibility)) {
                throw new IllegalArgumentException("艺人展示状态不正确");
            }
        }
        if (primaryCount > 1) throw new IllegalArgumentException("主艺人只能设置一个");
        Map<Long, Artist> artistMap = artistMapper.selectBatchIds(ids).stream()
                .filter(artist -> artist.getStatus() == null || artist.getStatus() == 1)
                .collect(Collectors.toMap(Artist::getId, Function.identity()));
        if (artistMap.size() != ids.size()) throw new IllegalArgumentException("艺人不存在或已停用");

        List<ActivityArtistDto> copy = artists.stream()
                .map(this::copy)
                .sorted(Comparator.comparing((ActivityArtistDto dto) -> Boolean.TRUE.equals(dto.getPrimary()) ? 0 : 1)
                        .thenComparing(dto -> dto.getSort() == null ? Integer.MAX_VALUE : dto.getSort()))
                .collect(Collectors.toList());
        for (int i = 0; i < copy.size(); i++) copy.get(i).setSort(i + 1);
        return copy;
    }

    private List<ActivityArtistDto> listLineup(Long activityId, boolean publicOnly) {
        if (activityId == null || activityId <= 0) return List.of();
        List<ActivityArtist> rows = activityArtistMapper.selectList(new LambdaQueryWrapper<ActivityArtist>()
                .eq(ActivityArtist::getActivityId, activityId)
                .eq(ActivityArtist::getStatus, 1)
                .orderByAsc(ActivityArtist::getSort)
                .orderByAsc(ActivityArtist::getId));
        if (rows.isEmpty()) return List.of();
        List<Long> ids = rows.stream().map(ActivityArtist::getArtistId).distinct().collect(Collectors.toList());
        Map<Long, Artist> artistMap = artistMapper.selectBatchIds(ids).stream()
                .collect(Collectors.toMap(Artist::getId, Function.identity()));
        return rows.stream()
                .filter(row -> !publicOnly || VISIBILITY_PUBLIC.equals(row.getVisibility()))
                .map(row -> toDto(row, artistMap.get(row.getArtistId())))
                .collect(Collectors.toList());
    }

    private ActivityArtistDto toDto(ActivityArtist row, Artist artist) {
        ActivityArtistDto dto = new ActivityArtistDto();
        dto.setArtistId(row.getArtistId());
        dto.setPrimary(Boolean.TRUE.equals(row.getPrimary()));
        dto.setRoleType(row.getRoleType());
        dto.setRoleName(row.getRoleName());
        dto.setVisibility(row.getVisibility());
        dto.setSort(row.getSort());
        if (artist != null) {
            dto.setName(artist.getName());
            dto.setAlias(artist.getAlias());
            dto.setArtistType(artist.getArtistType());
            dto.setCountryOrRegion(artist.getCountryOrRegion());
            dto.setCategoryTags(artist.getCategoryTags());
            dto.setAvatar(artist.getAvatar());
        }
        return dto;
    }

    private ActivityArtistDto copy(ActivityArtistDto source) {
        ActivityArtistDto dto = new ActivityArtistDto();
        dto.setArtistId(source.getArtistId());
        dto.setPrimary(Boolean.TRUE.equals(source.getPrimary()));
        dto.setRoleType(source.getRoleType());
        dto.setRoleName(source.getRoleName());
        dto.setVisibility(defaultText(source.getVisibility(), VISIBILITY_PUBLIC));
        dto.setSort(source.getSort());
        return dto;
    }

    private String defaultText(String value, String defaultValue) {
        return StringUtils.hasText(value) ? value.trim() : defaultValue;
    }

    private void notifyCastChange(Long activityId, List<ActivityArtistDto> before, List<ActivityArtistDto> after) {
        if (sessionMapper == null || orderInternalClient == null || notificationProducer == null || !StringUtils.hasText(internalToken)) return;
        String beforeKey = before.stream().map(ActivityArtistDto::getArtistId).map(String::valueOf).collect(Collectors.joining(","));
        String afterKey = after.stream().map(ActivityArtistDto::getArtistId).map(String::valueOf).collect(Collectors.joining(","));
        if (beforeKey.equals(afterKey)) return;
        List<Session> sessions = sessionMapper.selectList(new LambdaQueryWrapper<Session>().eq(Session::getActivityId, activityId));
        List<Long> sessionIds = sessions.stream().map(Session::getId).collect(Collectors.toList());
        if (sessionIds.isEmpty()) return;
        Result<List<OrderInfoResponse>> result = orderInternalClient.listPaidBySessions(new PaidOrdersBySessionsRequest(sessionIds), internalToken);
        if (result == null || result.getData() == null) return;
        Set<Long> notifiedUsers = new HashSet<>();
        for (OrderInfoResponse order : result.getData()) {
            if (order == null || order.getUserId() == null || !notifiedUsers.add(order.getUserId())) continue;
            notificationProducer.sendNotification(order.getUserId(), order.getId(), "IN_APP", "你购买的活动阵容发生变更，可在订单页申请阵容变更退款。");
        }
    }

    private void publishSearchUpsert(Long activityId) {
        if (searchIndexEventPublisher != null && activityId != null) {
            searchIndexEventPublisher.publishUpsert(activityId);
        }
    }
}
