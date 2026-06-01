package com.omni.ticket.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.omni.common.result.ResultCode;
import com.omni.exception.BusinessException;
import com.omni.ticket.dto.SubscriptionCalendarResponse;
import com.omni.ticket.dto.SubscriptionRequest;
import com.omni.ticket.dto.SubscriptionResponse;
import com.omni.ticket.entity.Activity;
import com.omni.ticket.entity.Artist;
import com.omni.ticket.entity.PerformanceSubscription;
import com.omni.ticket.entity.Session;
import com.omni.ticket.entity.TicketType;
import com.omni.ticket.entity.Tour;
import com.omni.ticket.entity.Venue;
import com.omni.ticket.mapper.ActivityMapper;
import com.omni.ticket.mapper.ArtistMapper;
import com.omni.ticket.mapper.PerformanceSubscriptionMapper;
import com.omni.ticket.mapper.SessionMapper;
import com.omni.ticket.mapper.TicketTypeMapper;
import com.omni.ticket.mapper.TourMapper;
import com.omni.ticket.mapper.VenueMapper;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class PerformanceSubscriptionService {

    public static final String ACTIVITY_WANT = "ACTIVITY_WANT";
    public static final String SALE_REMINDER = "SALE_REMINDER";
    public static final String WAITLIST_REMINDER = "WAITLIST_REMINDER";
    public static final String TOUR_CITY_REMINDER = "TOUR_CITY_REMINDER";
    public static final String ARTIST_FOLLOW = "ARTIST_FOLLOW";
    public static final String CITY_FOLLOW = "CITY_FOLLOW";

    private static final int STATUS_ACTIVE = 1;
    private static final int STATUS_CANCELLED = 0;
    private static final int DEFAULT_REMIND_BEFORE_MINUTES = 30;
    private static final DateTimeFormatter ICS_TIME = DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss");

    private final PerformanceSubscriptionMapper subscriptionMapper;
    private final ActivityMapper activityMapper;
    private final ArtistMapper artistMapper;
    private final SessionMapper sessionMapper;
    private final VenueMapper venueMapper;
    private final TicketTypeMapper ticketTypeMapper;
    private final TourMapper tourMapper;

    public PerformanceSubscriptionService(PerformanceSubscriptionMapper subscriptionMapper,
                                          ActivityMapper activityMapper,
                                          ArtistMapper artistMapper,
                                          SessionMapper sessionMapper,
                                          VenueMapper venueMapper,
                                          TicketTypeMapper ticketTypeMapper,
                                          TourMapper tourMapper) {
        this.subscriptionMapper = subscriptionMapper;
        this.activityMapper = activityMapper;
        this.artistMapper = artistMapper;
        this.sessionMapper = sessionMapper;
        this.venueMapper = venueMapper;
        this.ticketTypeMapper = ticketTypeMapper;
        this.tourMapper = tourMapper;
    }

    public SubscriptionResponse createSubscription(Long userId, SubscriptionRequest request) {
        if (userId == null || request == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "订阅参数不正确");
        }
        PerformanceSubscription subscription = resolveSubscription(userId, request);
        PerformanceSubscription existing = subscriptionMapper.selectOne(activeDuplicateWrapper(subscription));
        if (existing != null) {
            return toResponse(existing, EnrichmentContext.empty());
        }
        LocalDateTime now = LocalDateTime.now();
        subscription.setStatus(STATUS_ACTIVE);
        subscription.setCreateTime(now);
        subscription.setUpdateTime(now);
        if (subscription.getRemindBeforeMinutes() == null || subscription.getRemindBeforeMinutes() <= 0) {
            subscription.setRemindBeforeMinutes(DEFAULT_REMIND_BEFORE_MINUTES);
        }
        subscriptionMapper.insert(subscription);
        return toResponse(subscription, EnrichmentContext.empty());
    }

    public List<SubscriptionResponse> listSubscriptions(Long userId) {
        if (userId == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "用户ID不正确");
        }
        List<PerformanceSubscription> subscriptions = subscriptionMapper.selectList(new LambdaQueryWrapper<PerformanceSubscription>()
                .eq(PerformanceSubscription::getUserId, userId)
                .eq(PerformanceSubscription::getStatus, STATUS_ACTIVE)
                .orderByDesc(PerformanceSubscription::getCreateTime));
        if (subscriptions == null || subscriptions.isEmpty()) {
            return Collections.emptyList();
        }
        EnrichmentContext context = buildContext(subscriptions);
        return subscriptions.stream().map(subscription -> toResponse(subscription, context)).collect(Collectors.toList());
    }

    public void cancelSubscription(Long userId, Long subscriptionId) {
        if (userId == null || subscriptionId == null || subscriptionId <= 0) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "订阅ID不正确");
        }
        int updated = subscriptionMapper.update(null, new LambdaUpdateWrapper<PerformanceSubscription>()
                .eq(PerformanceSubscription::getId, subscriptionId)
                .eq(PerformanceSubscription::getUserId, userId)
                .eq(PerformanceSubscription::getStatus, STATUS_ACTIVE)
                .set(PerformanceSubscription::getStatus, STATUS_CANCELLED)
                .set(PerformanceSubscription::getUpdateTime, LocalDateTime.now()));
        if (updated <= 0) {
            throw new BusinessException(ResultCode.NOT_FOUND, "订阅不存在");
        }
    }

    public SubscriptionCalendarResponse createCalendar(Long userId) {
        List<PerformanceSubscription> subscriptions = subscriptionMapper.selectList(new LambdaQueryWrapper<PerformanceSubscription>()
                .eq(PerformanceSubscription::getUserId, userId)
                .eq(PerformanceSubscription::getStatus, STATUS_ACTIVE)
                .in(PerformanceSubscription::getTargetType, List.of(ACTIVITY_WANT, SALE_REMINDER, WAITLIST_REMINDER)));
        EnrichmentContext context = buildContext(subscriptions == null ? Collections.emptyList() : subscriptions);
        StringBuilder builder = new StringBuilder();
        builder.append("BEGIN:VCALENDAR\r\n");
        builder.append("VERSION:2.0\r\n");
        builder.append("PRODID:-//Omni//Performance Calendar//ZH-CN\r\n");
        builder.append("CALSCALE:GREGORIAN\r\n");
        for (PerformanceSubscription subscription : subscriptions == null ? Collections.<PerformanceSubscription>emptyList() : subscriptions) {
            Session session = context.firstSessionByActivity.get(subscription.getActivityId());
            if (session == null || session.getStartTime() == null) {
                continue;
            }
            Activity activity = context.activityById.get(subscription.getActivityId());
            Venue venue = context.venueById.get(session.getVenueId());
            String title = activity != null && StringUtils.hasText(activity.getName()) ? activity.getName() : subscription.getTargetName();
            builder.append("BEGIN:VEVENT\r\n");
            builder.append("UID:omni-subscription-").append(subscription.getId()).append("@omni\r\n");
            builder.append("SUMMARY:").append(escapeIcs(title)).append("\r\n");
            builder.append("DTSTART;TZID=Asia/Shanghai:").append(ICS_TIME.format(session.getStartTime())).append("\r\n");
            LocalDateTime endTime = session.getEndTime() == null ? session.getStartTime().plusHours(2) : session.getEndTime();
            builder.append("DTEND;TZID=Asia/Shanghai:").append(ICS_TIME.format(endTime)).append("\r\n");
            if (venue != null && StringUtils.hasText(venue.getName())) {
                builder.append("LOCATION:").append(escapeIcs(venue.getName())).append("\r\n");
            }
            builder.append("DESCRIPTION:").append(escapeIcs("来自万象票务的想看/提醒日历")).append("\r\n");
            builder.append("END:VEVENT\r\n");
        }
        builder.append("END:VCALENDAR\r\n");
        SubscriptionCalendarResponse response = new SubscriptionCalendarResponse();
        response.setFileName("omni-calendar-" + userId + ".ics");
        response.setContent(builder.toString());
        return response;
    }

    private PerformanceSubscription resolveSubscription(Long userId, SubscriptionRequest request) {
        String type = normalizeTargetType(request.getTargetType());
        PerformanceSubscription subscription = new PerformanceSubscription();
        subscription.setUserId(userId);
        subscription.setTargetType(type);
        subscription.setRemindBeforeMinutes(request.getRemindBeforeMinutes());
        switch (type) {
            case ACTIVITY_WANT:
            case SALE_REMINDER:
            case WAITLIST_REMINDER:
                fillActivityTarget(subscription, firstPositive(request.getActivityId(), request.getTargetId()));
                break;
            case ARTIST_FOLLOW:
                fillArtistTarget(subscription, firstPositive(request.getArtistId(), request.getTargetId()));
                break;
            case CITY_FOLLOW:
                fillCityTarget(subscription, firstText(request.getCity(), request.getTargetValue()));
                break;
            case TOUR_CITY_REMINDER:
                fillTourCityTarget(subscription, request);
                break;
            default:
                throw new BusinessException(ResultCode.BAD_REQUEST, "订阅类型不支持");
        }
        return subscription;
    }

    private void fillActivityTarget(PerformanceSubscription subscription, Long activityId) {
        if (activityId == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "活动ID不正确");
        }
        Activity activity = activityMapper.selectById(activityId);
        if (activity == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "活动不存在");
        }
        subscription.setTargetId(activityId);
        subscription.setActivityId(activityId);
        subscription.setArtistId(activity.getArtistId());
        subscription.setTargetName(activity.getName());
    }

    private void fillArtistTarget(PerformanceSubscription subscription, Long artistId) {
        if (artistId == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "艺人ID不正确");
        }
        Artist artist = artistMapper.selectById(artistId);
        if (artist == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "艺人不存在");
        }
        subscription.setTargetId(artistId);
        subscription.setArtistId(artistId);
        subscription.setTargetName(artist.getName());
    }

    private void fillCityTarget(PerformanceSubscription subscription, String city) {
        if (!StringUtils.hasText(city)) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "城市不能为空");
        }
        String normalizedCity = city.trim();
        subscription.setTargetValue(normalizedCity);
        subscription.setTargetName(normalizedCity);
        subscription.setCity(normalizedCity);
    }

    private void fillTourCityTarget(PerformanceSubscription subscription, SubscriptionRequest request) {
        Long tourId = firstPositive(request.getTargetId(), request.getActivityId());
        if (tourId == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "巡演ID不正确");
        }
        fillCityTarget(subscription, firstText(request.getCity(), request.getTargetValue()));
        subscription.setTargetId(tourId);
        Tour tour = tourMapper == null ? null : tourMapper.selectById(tourId);
        if (tour != null && StringUtils.hasText(tour.getTitle())) {
            subscription.setTargetName(tour.getTitle() + " " + subscription.getCity());
        }
    }

    private LambdaQueryWrapper<PerformanceSubscription> activeDuplicateWrapper(PerformanceSubscription subscription) {
        LambdaQueryWrapper<PerformanceSubscription> wrapper = new LambdaQueryWrapper<PerformanceSubscription>()
                .eq(PerformanceSubscription::getUserId, subscription.getUserId())
                .eq(PerformanceSubscription::getTargetType, subscription.getTargetType())
                .eq(PerformanceSubscription::getStatus, STATUS_ACTIVE);
        if (subscription.getTargetId() == null) {
            wrapper.isNull(PerformanceSubscription::getTargetId);
        } else {
            wrapper.eq(PerformanceSubscription::getTargetId, subscription.getTargetId());
        }
        if (StringUtils.hasText(subscription.getTargetValue())) {
            wrapper.eq(PerformanceSubscription::getTargetValue, subscription.getTargetValue());
        } else {
            wrapper.and(w -> w.isNull(PerformanceSubscription::getTargetValue)
                    .or()
                    .eq(PerformanceSubscription::getTargetValue, ""));
        }
        return wrapper;
    }

    private EnrichmentContext buildContext(List<PerformanceSubscription> subscriptions) {
        Set<Long> activityIds = subscriptions.stream().map(PerformanceSubscription::getActivityId).filter(Objects::nonNull).collect(Collectors.toCollection(LinkedHashSet::new));
        Set<Long> artistIds = subscriptions.stream().map(PerformanceSubscription::getArtistId).filter(Objects::nonNull).collect(Collectors.toCollection(LinkedHashSet::new));
        Map<Long, Activity> activities = toMap(activityIds.isEmpty() ? Collections.emptyList() : activityMapper.selectBatchIds(new ArrayList<>(activityIds)), Activity::getId);
        activities.values().stream().map(Activity::getArtistId).filter(Objects::nonNull).forEach(artistIds::add);
        Map<Long, Artist> artists = toMap(artistIds.isEmpty() ? Collections.emptyList() : artistMapper.selectBatchIds(new ArrayList<>(artistIds)), Artist::getId);

        List<Session> sessions = activityIds.isEmpty() ? Collections.emptyList() : sessionMapper.selectList(new LambdaQueryWrapper<Session>()
                .in(Session::getActivityId, activityIds)
                .eq(Session::getStatus, 1)
                .orderByAsc(Session::getStartTime));
        if (sessions == null) sessions = Collections.emptyList();
        Map<Long, Session> firstSessionByActivity = new LinkedHashMap<>();
        for (Session session : sessions) {
            firstSessionByActivity.putIfAbsent(session.getActivityId(), session);
        }
        Set<Long> venueIds = sessions.stream().map(Session::getVenueId).filter(Objects::nonNull).collect(Collectors.toCollection(LinkedHashSet::new));
        Map<Long, Venue> venues = toMap(venueIds.isEmpty() ? Collections.emptyList() : venueMapper.selectBatchIds(new ArrayList<>(venueIds)), Venue::getId);
        Set<Long> sessionIds = sessions.stream().map(Session::getId).filter(Objects::nonNull).collect(Collectors.toCollection(LinkedHashSet::new));
        List<TicketType> ticketTypes = sessionIds.isEmpty() ? Collections.emptyList() : ticketTypeMapper.selectList(new LambdaQueryWrapper<TicketType>()
                .in(TicketType::getSessionId, sessionIds)
                .eq(TicketType::getStatus, 1));
        if (ticketTypes == null) ticketTypes = Collections.emptyList();
        Map<Long, List<TicketType>> ticketTypesBySession = ticketTypes.stream().collect(Collectors.groupingBy(TicketType::getSessionId));
        return new EnrichmentContext(activities, artists, firstSessionByActivity, venues, ticketTypesBySession);
    }

    private SubscriptionResponse toResponse(PerformanceSubscription subscription, EnrichmentContext context) {
        SubscriptionResponse response = new SubscriptionResponse();
        response.setId(subscription.getId());
        response.setUserId(subscription.getUserId());
        response.setTargetType(subscription.getTargetType());
        response.setTargetId(subscription.getTargetId());
        response.setTargetValue(subscription.getTargetValue());
        response.setTargetName(subscription.getTargetName());
        response.setActivityId(subscription.getActivityId());
        response.setArtistId(subscription.getArtistId());
        response.setCity(subscription.getCity());
        response.setRemindBeforeMinutes(subscription.getRemindBeforeMinutes());
        response.setStatus(subscription.getStatus());
        response.setCreateTime(subscription.getCreateTime());
        Activity activity = context.activityById.get(subscription.getActivityId());
        if (activity != null) {
            response.setActivityName(activity.getName());
            response.setActivityPoster(activity.getPoster());
            response.setArtistId(activity.getArtistId());
        } else {
            response.setActivityName(subscription.getTargetName());
        }
        Artist artist = context.artistById.get(response.getArtistId());
        if (artist != null) {
            response.setArtistName(artist.getName());
            if (!StringUtils.hasText(response.getTargetName()) && ARTIST_FOLLOW.equals(subscription.getTargetType())) {
                response.setTargetName(artist.getName());
            }
        }
        Session session = context.firstSessionByActivity.get(subscription.getActivityId());
        if (session != null) {
            response.setSessionId(session.getId());
            response.setStartTime(session.getStartTime());
            Venue venue = context.venueById.get(session.getVenueId());
            if (venue != null) {
                response.setVenueName(venue.getName());
                if (!StringUtils.hasText(response.getCity())) {
                    response.setCity(venue.getCity());
                }
            }
            response.setSaleStatusText(saleStatusText(session, context.ticketTypesBySession.getOrDefault(session.getId(), Collections.emptyList())));
        } else if (CITY_FOLLOW.equals(subscription.getTargetType())) {
            response.setSaleStatusText("等待同城上新");
        } else if (ARTIST_FOLLOW.equals(subscription.getTargetType())) {
            response.setSaleStatusText("等待艺人新演出");
        } else {
            response.setSaleStatusText("待公布");
        }
        response.setReadyChecklist(buildReadyChecklist(activity, response));
        return response;
    }

    private String saleStatusText(Session session, List<TicketType> ticketTypes) {
        if (session.getStartTime() != null && session.getStartTime().isBefore(LocalDateTime.now())) {
            return "已开演";
        }
        BigDecimal minPrice = ticketTypes.stream()
                .map(TicketType::getPrice)
                .filter(Objects::nonNull)
                .min(Comparator.naturalOrder())
                .orElse(null);
        return minPrice == null ? "待开票" : "可抢票";
    }

    private List<String> buildReadyChecklist(Activity activity, SubscriptionResponse response) {
        List<String> checklist = new ArrayList<>();
        if (activity != null && Boolean.TRUE.equals(activity.getRealNameRequired())) {
            checklist.add("提前维护实名观演人");
        }
        checklist.add("确认收货手机号和登录状态");
        if (response.getStartTime() != null) {
            checklist.add("开演前检查票夹和入场码");
        } else {
            checklist.add("等待开售提醒和排期更新");
        }
        return checklist;
    }

    private String normalizeTargetType(String targetType) {
        if (!StringUtils.hasText(targetType)) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "订阅类型不能为空");
        }
        return targetType.trim().toUpperCase(Locale.ROOT);
    }

    private Long firstPositive(Long first, Long second) {
        if (first != null && first > 0) return first;
        if (second != null && second > 0) return second;
        return null;
    }

    private String firstText(String first, String second) {
        if (StringUtils.hasText(first)) return first;
        if (StringUtils.hasText(second)) return second;
        return null;
    }

    private <T> Map<Long, T> toMap(Collection<T> values, Function<T, Long> idGetter) {
        if (values == null || values.isEmpty()) {
            return Collections.emptyMap();
        }
        return values.stream()
                .filter(Objects::nonNull)
                .filter(value -> idGetter.apply(value) != null)
                .collect(Collectors.toMap(idGetter, Function.identity(), (a, b) -> a, LinkedHashMap::new));
    }

    private String escapeIcs(String value) {
        if (value == null) return "";
        return value.replace("\\", "\\\\")
                .replace(",", "\\,")
                .replace(";", "\\;")
                .replace("\r", "")
                .replace("\n", "\\n");
    }

    private static class EnrichmentContext {
        private final Map<Long, Activity> activityById;
        private final Map<Long, Artist> artistById;
        private final Map<Long, Session> firstSessionByActivity;
        private final Map<Long, Venue> venueById;
        private final Map<Long, List<TicketType>> ticketTypesBySession;

        private EnrichmentContext(Map<Long, Activity> activityById,
                                  Map<Long, Artist> artistById,
                                  Map<Long, Session> firstSessionByActivity,
                                  Map<Long, Venue> venueById,
                                  Map<Long, List<TicketType>> ticketTypesBySession) {
            this.activityById = activityById;
            this.artistById = artistById;
            this.firstSessionByActivity = firstSessionByActivity;
            this.venueById = venueById;
            this.ticketTypesBySession = ticketTypesBySession;
        }

        private static EnrichmentContext empty() {
            return new EnrichmentContext(Collections.emptyMap(), Collections.emptyMap(), Collections.emptyMap(),
                    Collections.emptyMap(), Collections.emptyMap());
        }
    }
}
