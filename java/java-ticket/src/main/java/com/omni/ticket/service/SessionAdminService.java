package com.omni.ticket.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.omni.exception.BusinessException;
import com.omni.ticket.dto.SessionAdminResponse;
import com.omni.ticket.entity.Activity;
import com.omni.ticket.entity.Session;
import com.omni.ticket.entity.SessionSeat;
import com.omni.ticket.entity.TicketType;
import com.omni.ticket.entity.Venue;
import com.omni.ticket.mapper.ActivityMapper;
import com.omni.ticket.mapper.SessionMapper;
import com.omni.ticket.mapper.SessionSeatMapper;
import com.omni.ticket.mapper.TicketTypeMapper;
import com.omni.ticket.mapper.VenueMapper;
import com.omni.ticket.service.UserAccessService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class SessionAdminService {

    private final ActivityMapper activityMapper;
    private final SessionMapper sessionMapper;
    private final VenueMapper venueMapper;
    private final UserAccessService userAccessService;
    private final TicketTypeMapper ticketTypeMapper;
    private final SessionSeatService sessionSeatService;
    private final SessionSeatLayoutService sessionSeatLayoutService;
    private final SessionSeatMapper sessionSeatMapper;

    public SessionAdminService(ActivityMapper activityMapper,
                                 SessionMapper sessionMapper,
                                 VenueMapper venueMapper,
                                 UserAccessService userAccessService) {
        this(activityMapper, sessionMapper, venueMapper, userAccessService, null, null, null, null);
    }

    public SessionAdminService(ActivityMapper activityMapper,
                               SessionMapper sessionMapper,
                               VenueMapper venueMapper,
                               UserAccessService userAccessService,
                               TicketTypeMapper ticketTypeMapper) {
        this(activityMapper, sessionMapper, venueMapper, userAccessService, ticketTypeMapper, null, null, null);
    }

    public SessionAdminService(ActivityMapper activityMapper,
                               SessionMapper sessionMapper,
                               VenueMapper venueMapper,
                               UserAccessService userAccessService,
                               TicketTypeMapper ticketTypeMapper,
                               SessionSeatService sessionSeatService,
                               SessionSeatLayoutService sessionSeatLayoutService) {
        this(activityMapper, sessionMapper, venueMapper, userAccessService, ticketTypeMapper,
                sessionSeatService, sessionSeatLayoutService, null);
    }

    @Autowired
    public SessionAdminService(ActivityMapper activityMapper,
                               SessionMapper sessionMapper,
                               VenueMapper venueMapper,
                               UserAccessService userAccessService,
                               TicketTypeMapper ticketTypeMapper,
                               SessionSeatService sessionSeatService,
                               SessionSeatLayoutService sessionSeatLayoutService,
                               SessionSeatMapper sessionSeatMapper) {
        this.activityMapper = activityMapper;
        this.sessionMapper = sessionMapper;
        this.venueMapper = venueMapper;
        this.userAccessService = userAccessService;
        this.ticketTypeMapper = ticketTypeMapper;
        this.sessionSeatService = sessionSeatService;
        this.sessionSeatLayoutService = sessionSeatLayoutService;
        this.sessionSeatMapper = sessionSeatMapper;
    }

    @Transactional
    public Session createSession(Map<String, Object> body) {
        Long userId = toPositiveLong(body.get("userId"), "用户ID不正确");
        Long activityId = toPositiveLong(body.get("activityId"), "活动ID不正确");
        Long venueId = toPositiveLong(body.get("venueId"), "场馆ID不正确");
        LocalDateTime startTime = parseTime(body.get("startTime"));
        LocalDateTime endTime = parseOptionalTime(body.get("endTime"));

        String role = requireRole(userId);
        Activity activity = requireManageableActivity(activityId, userId, role);
        Venue venue = venueMapper.selectById(venueId);
        if (venue == null || !Integer.valueOf(1).equals(venue.getStatus())) {
            throw new BusinessException(400, "场馆不存在或已停用");
        }
        validateTime(startTime, endTime);
        ensureNoVenueConflict(venueId, startTime, endTime, null);

        Session session = new Session();
        session.setActivityId(activity.getId());
        session.setVenueId(venueId);
        session.setStartTime(startTime);
        session.setEndTime(endTime);
        session.setStatus(1);
        sessionMapper.insert(session);
        boolean hasSeatCraftLayout = false;
        if (sessionSeatLayoutService != null) {
            Object activityLayoutId = body.get("activityLayoutId");
            if (activityLayoutId != null) {
                sessionSeatLayoutService.copyFromActivityLayout(userId, session.getId(), toPositiveLong(activityLayoutId, "活动座位图ID不正确"));
                hasSeatCraftLayout = true;
            }
        }
        if (hasSeatCraftLayout) {
            sessionSeatLayoutService.generateSessionSeats(session.getId());
        } else if (sessionSeatService != null) {
            sessionSeatService.generateForSession(session.getId());
        }
        return session;
    }

    public Session updateSession(Long id, Map<String, Object> body) {
        if (id == null || id <= 0) {
            throw new BusinessException(400, "场次ID不正确");
        }
        Long userId = toPositiveLong(body.get("userId"), "用户ID不正确");
        String role = requireRole(userId);
        Session session = sessionMapper.selectById(id);
        if (session == null) {
            throw new BusinessException(404, "场次不存在");
        }
        requireManageableActivity(session.getActivityId(), userId, role);

        Long venueId = body.containsKey("venueId") ? toPositiveLong(body.get("venueId"), "场馆ID不正确") : session.getVenueId();
        LocalDateTime startTime = body.containsKey("startTime") ? parseTime(body.get("startTime")) : session.getStartTime();
        LocalDateTime endTime = body.containsKey("endTime") ? parseOptionalTime(body.get("endTime")) : session.getEndTime();
        Venue venue = venueMapper.selectById(venueId);
        if (venue == null || !Integer.valueOf(1).equals(venue.getStatus())) {
            throw new BusinessException(400, "场馆不存在或已停用");
        }
        validateTime(startTime, endTime);
        ensureNoVenueConflict(venueId, startTime, endTime, id);

        session.setVenueId(venueId);
        session.setStartTime(startTime);
        session.setEndTime(endTime);
        if (body.containsKey("status")) {
            session.setStatus(Integer.valueOf(body.get("status").toString()));
        }
        sessionMapper.updateById(session);
        return session;
    }

    @Transactional
    public void deleteSession(Long userId, Long id) {
        if (userId == null || userId <= 0) {
            throw new BusinessException(400, "用户ID不正确");
        }
        if (id == null || id <= 0) {
            throw new BusinessException(400, "场次ID不正确");
        }
        String role = requireRole(userId);
        Session session = sessionMapper.selectById(id);
        if (session == null) {
            throw new BusinessException(404, "场次不存在");
        }
        requireManageableActivity(session.getActivityId(), userId, role);
        sessionSeatService.deleteBySessionId(id);
        if (sessionSeatLayoutService != null) {
            sessionSeatLayoutService.deleteBySessionId(id);
        }
        if (ticketTypeMapper != null) {
            ticketTypeMapper.delete(new LambdaQueryWrapper<TicketType>()
                    .eq(TicketType::getSessionId, id));
        }
        sessionMapper.deleteById(id);
    }

    public Page<SessionAdminResponse> listSessions(Long userId, Integer page, Integer size, Long activityId, Long venueId, Integer status) {
        if (userId == null || userId <= 0) {
            throw new BusinessException(400, "用户ID不正确");
        }
        if (activityId != null && activityId <= 0) {
            throw new BusinessException(400, "活动ID不正确");
        }
        if (venueId != null && venueId <= 0) {
            throw new BusinessException(400, "场馆ID不正确");
        }
        String role = requireRole(userId);
        LambdaQueryWrapper<Session> wrapper = new LambdaQueryWrapper<>();
        if (activityId != null) {
            wrapper.eq(Session::getActivityId, activityId);
        }
        if (venueId != null) {
            wrapper.eq(Session::getVenueId, venueId);
        }
        if (status != null) {
            wrapper.eq(Session::getStatus, status);
        }
        if ("organizer".equals(role)) {
            List<Activity> activities = activityMapper.selectList(new LambdaQueryWrapper<Activity>().eq(Activity::getOrganizerId, userId));
            List<Long> activityIds = activities.stream().map(Activity::getId).collect(Collectors.toList());
            if (activityIds.isEmpty()) {
                return new Page<>(page, size);
            }
            wrapper.in(Session::getActivityId, activityIds);
        }
        wrapper.orderByAsc(Session::getStartTime);
        Page<Session> sessionPage = sessionMapper.selectPage(new Page<>(page, size), wrapper);
        Page<SessionAdminResponse> responsePage = new Page<>(sessionPage.getCurrent(), sessionPage.getSize(), sessionPage.getTotal());
        responsePage.setRecords(toResponses(sessionPage.getRecords()));
        return responsePage;
    }

    private List<SessionAdminResponse> toResponses(List<Session> sessions) {
        if (sessions == null || sessions.isEmpty()) {
            return Collections.emptyList();
        }
        Set<Long> activityIds = sessions.stream().map(Session::getActivityId).filter(Objects::nonNull).collect(Collectors.toSet());
        Set<Long> venueIds = sessions.stream().map(Session::getVenueId).filter(Objects::nonNull).collect(Collectors.toSet());
        Set<Long> sessionIds = sessions.stream().map(Session::getId).filter(Objects::nonNull).collect(Collectors.toSet());
        Map<Long, Activity> activities = activityIds.isEmpty() ? Collections.emptyMap()
                : activityMapper.selectBatchIds(activityIds).stream().collect(Collectors.toMap(Activity::getId, a -> a));
        Map<Long, Venue> venues = venueIds.isEmpty() ? Collections.emptyMap()
                : venueMapper.selectBatchIds(venueIds).stream().collect(Collectors.toMap(Venue::getId, v -> v));
        Map<Long, List<TicketType>> ticketTypes = ticketTypeMapper == null || sessionIds.isEmpty() ? Collections.emptyMap()
                : ticketTypeMapper.selectList(new LambdaQueryWrapper<TicketType>().in(TicketType::getSessionId, sessionIds))
                .stream().collect(Collectors.groupingBy(TicketType::getSessionId));
        Map<Long, List<SessionSeat>> seatsByTicketType = sessionSeatMapper == null || sessionIds.isEmpty() ? Collections.emptyMap()
                : sessionSeatMapper.selectList(new LambdaQueryWrapper<SessionSeat>()
                .in(SessionSeat::getSessionId, sessionIds)
                .isNotNull(SessionSeat::getTicketTypeId))
                .stream()
                .filter(seat -> seat != null && seat.getTicketTypeId() != null)
                .collect(Collectors.groupingBy(SessionSeat::getTicketTypeId));

        return sessions.stream().map(session -> {
            SessionAdminResponse response = SessionAdminResponse.from(session);
            Activity activity = activities.get(session.getActivityId());
            Venue venue = venues.get(session.getVenueId());
            List<TicketType> types = ticketTypes.getOrDefault(session.getId(), Collections.emptyList());
            StockSummary stockSummary = summarizeStock(types, seatsByTicketType);
            response.setActivityName(activity == null ? null : activity.getName());
            response.setVenueName(venue == null ? null : venue.getName());
            response.setVenueCity(venue == null ? null : venue.getCity());
            response.setTicketTypeCount(types.size());
            response.setTotalStock(stockSummary.totalStock);
            response.setRemainStock(stockSummary.remainStock);
            response.setSoldStock(stockSummary.soldStock);
            response.setTicketTypes(types);
            return response;
        }).collect(Collectors.toList());
    }

    private StockSummary summarizeStock(List<TicketType> ticketTypes, Map<Long, List<SessionSeat>> seatsByTicketType) {
        int totalStock = 0;
        int remainStock = 0;
        int soldStock = 0;
        for (TicketType ticketType : ticketTypes == null ? Collections.<TicketType>emptyList() : ticketTypes) {
            List<SessionSeat> seats = ticketType.getId() == null ? Collections.emptyList()
                    : seatsByTicketType.getOrDefault(ticketType.getId(), Collections.emptyList());
            if (seats.isEmpty()) {
                int ticketTotal = safeInt(ticketType.getTotalStock());
                int ticketRemain = safeInt(ticketType.getRemainStock());
                totalStock += ticketTotal;
                remainStock += ticketRemain;
                soldStock += Math.max(0, ticketTotal - ticketRemain);
                continue;
            }
            totalStock += (int) seats.stream()
                    .filter(seat -> Integer.valueOf(1).equals(seat.getStatus())
                            || Integer.valueOf(2).equals(seat.getStatus())
                            || Integer.valueOf(3).equals(seat.getStatus())
                            || seat.getOrderId() != null)
                    .count();
            remainStock += (int) seats.stream()
                    .filter(seat -> Integer.valueOf(1).equals(seat.getStatus()))
                    .filter(seat -> seat.getOrderId() == null)
                    .filter(seat -> seat.getLockExpireTime() == null)
                    .count();
            soldStock += (int) seats.stream()
                    .filter(seat -> Integer.valueOf(2).equals(seat.getStatus())
                            || Integer.valueOf(3).equals(seat.getStatus())
                            || seat.getOrderId() != null)
                    .count();
        }
        return new StockSummary(totalStock, remainStock, soldStock);
    }

    private int safeInt(Integer value) {
        return value == null ? 0 : value;
    }

    private static class StockSummary {
        private final int totalStock;
        private final int remainStock;
        private final int soldStock;

        private StockSummary(int totalStock, int remainStock, int soldStock) {
            this.totalStock = totalStock;
            this.remainStock = remainStock;
            this.soldStock = soldStock;
        }
    }

    private void validateTime(LocalDateTime startTime, LocalDateTime endTime) {
        if (startTime == null) {
            throw new BusinessException(400, "开始时间不能为空");
        }
        if (endTime != null && !endTime.isAfter(startTime)) {
            throw new BusinessException(400, "结束时间必须晚于开始时间");
        }
    }

    private void ensureNoVenueConflict(Long venueId, LocalDateTime startTime, LocalDateTime endTime, Long excludeSessionId) {
        LocalDateTime actualEnd = endTime == null ? startTime.plusHours(3) : endTime;
        List<Session> sessions = sessionMapper.selectList(new LambdaQueryWrapper<Session>()
                .eq(Session::getVenueId, venueId)
                .eq(Session::getStatus, 1));
        for (Session session : sessions) {
            if (excludeSessionId != null && excludeSessionId.equals(session.getId())) {
                continue;
            }
            LocalDateTime existingStart = session.getStartTime();
            LocalDateTime existingEnd = session.getEndTime() == null ? existingStart.plusHours(3) : session.getEndTime();
            if (startTime.isBefore(existingEnd) && actualEnd.isAfter(existingStart)) {
                throw new BusinessException(400, "同一场馆该时间段已有场次");
            }
        }
    }

    private Activity requireManageableActivity(Long activityId, Long userId, String role) {
        Activity activity = activityMapper.selectById(activityId);
        if (activity == null) {
            throw new BusinessException(404, "活动不存在");
        }
        if ("organizer".equals(role) && !userId.equals(activity.getOrganizerId())) {
            throw new BusinessException(403, "只能管理自己主办的场次");
        }
        return activity;
    }

    private String requireRole(Long userId) {
        return userAccessService.requireAdminOrOrganizerRole(userId);
    }

    private Long toPositiveLong(Object value, String message) {
        if (value == null) {
            throw new BusinessException(400, message);
        }
        try {
            Long parsed = Long.valueOf(value.toString());
            if (parsed <= 0) {
                throw new BusinessException(400, message);
            }
            return parsed;
        } catch (NumberFormatException e) {
            throw new BusinessException(400, message);
        }
    }

    private LocalDateTime parseTime(Object value) {
        if (value == null || value.toString().trim().isEmpty()) {
            return null;
        }
        return LocalDateTime.parse(value.toString().replace(" ", "T"));
    }

    private LocalDateTime parseOptionalTime(Object value) {
        return parseTime(value);
    }
}
