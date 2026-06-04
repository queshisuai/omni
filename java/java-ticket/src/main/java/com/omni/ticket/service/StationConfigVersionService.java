package com.omni.ticket.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.omni.common.result.Result;
import com.omni.common.result.ResultCode;
import com.omni.exception.BusinessException;
import com.omni.ticket.client.OrderInternalClient;
import com.omni.ticket.dto.InternalUserRefResponse;
import com.omni.ticket.dto.PaidOrderCountRequest;
import com.omni.ticket.dto.PaidOrderCountResponse;
import com.omni.ticket.dto.StationConfigVersionDetailResponse;
import com.omni.ticket.dto.StationConfigVersionRequest;
import com.omni.ticket.dto.StationConfigVersionResponse;
import com.omni.ticket.dto.StationConfigVersionReviewRequest;
import com.omni.ticket.entity.Activity;
import com.omni.ticket.entity.Session;
import com.omni.ticket.entity.Station;
import com.omni.ticket.entity.StationConfigVersion;
import com.omni.ticket.entity.Tour;
import com.omni.ticket.entity.Venue;
import com.omni.ticket.entity.VenueApplication;
import com.omni.ticket.mapper.ActivityMapper;
import com.omni.ticket.mapper.SessionMapper;
import com.omni.ticket.mapper.StationConfigVersionMapper;
import com.omni.ticket.mapper.StationMapper;
import com.omni.ticket.mapper.TourMapper;
import com.omni.ticket.mapper.VenueMapper;
import com.omni.ticket.mapper.VenueApplicationMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.Collections;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class StationConfigVersionService {
    private static final String STATUS_DRAFT = "draft";
    private static final String STATUS_SUBMITTED = "submitted";
    private static final String STATUS_APPLIED = "applied";
    private static final String STATUS_REJECTED = "rejected";
    private static final String STATUS_WITHDRAWN = "withdrawn";
    private static final String CHANGE_SET_VENUE = "set_venue";
    private static final String CHANGE_CHANGE_VENUE = "change_venue";
    private static final String CHANGE_DELETE_STATION = "delete_station";
    private static final String CHANGE_SET_SCHEDULE = "set_schedule";
    private static final String CHANGE_CHANGE_SCHEDULE = "change_schedule";
    private static final Set<String> ALLOWED_CHANGE_TYPES = Set.of(
            "create",
            "update_city",
            CHANGE_SET_VENUE,
            CHANGE_CHANGE_VENUE,
            CHANGE_SET_SCHEDULE,
            CHANGE_CHANGE_SCHEDULE,
            CHANGE_DELETE_STATION);

    private final StationConfigVersionMapper versionMapper;
    private final StationMapper stationMapper;
    private final VenueApplicationMapper venueApplicationMapper;
    private final UserAccessService userAccessService;
    private final TourMapper tourMapper;
    private final ActivityMapper activityMapper;
    private final SessionMapper sessionMapper;
    private final VenueMapper venueMapper;
    private final OrderInternalClient orderInternalClient;
    private final String internalApiToken;

    @Autowired
    public StationConfigVersionService(StationConfigVersionMapper versionMapper,
                                        StationMapper stationMapper,
                                         VenueApplicationMapper venueApplicationMapper,
                                         UserAccessService userAccessService,
                                         TourMapper tourMapper,
                                         ActivityMapper activityMapper,
                                         SessionMapper sessionMapper,
                                         VenueMapper venueMapper,
                                         OrderInternalClient orderInternalClient,
                                         @Value("${internal.api.token:${INTERNAL_API_TOKEN:}}") String internalApiToken) {
        this.versionMapper = versionMapper;
        this.stationMapper = stationMapper;
        this.venueApplicationMapper = venueApplicationMapper;
        this.userAccessService = userAccessService;
        this.tourMapper = tourMapper;
        this.activityMapper = activityMapper;
        this.sessionMapper = sessionMapper;
        this.venueMapper = venueMapper;
        this.orderInternalClient = orderInternalClient;
        this.internalApiToken = internalApiToken;
    }

    @Transactional
    public StationConfigVersionResponse createDraft(Long operatorId, Long stationId, StationConfigVersionRequest request) {
        requireRequest(request);
        requireOperator(operatorId);
        Station station = requireManageableStation(stationId, operatorId);
        LocalDateTime now = LocalDateTime.now();
        StationConfigVersion version = new StationConfigVersion();
        version.setStationId(station.getId());
        version.setActivityId(station.getActivityId());
        version.setTourId(station.getTourId());
        version.setVersionNo(nextVersionNo(station.getId()));
        version.setStatus(STATUS_DRAFT);
        version.setCreatedBy(operatorId);
        version.setCreatedAt(now);
        copyRequest(version, request);
        version.setUpdatedAt(now);
        versionMapper.insert(version);
        return StationConfigVersionResponse.from(version);
    }

    @Transactional
    public StationConfigVersionResponse updateDraft(Long operatorId, Long versionId, StationConfigVersionRequest request) {
        requireRequest(request);
        requireOperator(operatorId);
        StationConfigVersion version = requireVersion(versionId);
        requireStatus(version, STATUS_DRAFT, "仅草稿可修改");
        Station station = requireManageableStation(version.getStationId(), operatorId);
        version.setActivityId(station.getActivityId());
        version.setTourId(station.getTourId());
        copyRequest(version, request);
        version.setUpdatedAt(LocalDateTime.now());
        versionMapper.updateById(version);
        return StationConfigVersionResponse.from(version);
    }

    @Transactional
    public void deleteDraft(Long versionId, Long userId) {
        StationConfigVersion version = requireVersion(versionId);
        requireManageableStation(version.getStationId(), userId);
        requireStatus(version, STATUS_DRAFT, "仅草稿可删除");
        versionMapper.deleteById(versionId);
    }

    @Transactional
    public StationConfigVersionResponse submit(Long versionId, Long userId) {
        StationConfigVersion version = requireVersion(versionId);
        requireManageableStation(version.getStationId(), userId);
        requireStatus(version, STATUS_DRAFT, "仅草稿可提交");
        validateSubmit(version);
        version.setStatus(STATUS_SUBMITTED);
        version.setUpdatedAt(LocalDateTime.now());
        versionMapper.updateById(version);
        return StationConfigVersionResponse.from(version);
    }

    @Transactional
    public StationConfigVersionResponse withdraw(Long versionId, Long userId) {
        StationConfigVersion version = requireVersion(versionId);
        requireManageableStation(version.getStationId(), userId);
        requireStatus(version, STATUS_SUBMITTED, "仅已提交版本可撤回");
        version.setStatus(STATUS_WITHDRAWN);
        version.setUpdatedAt(LocalDateTime.now());
        versionMapper.updateById(version);
        return StationConfigVersionResponse.from(version);
    }

    @Transactional
    public StationConfigVersionResponse approve(Long versionId, StationConfigVersionReviewRequest request) {
        requireReviewRequest(request);
        userAccessService.requireAdmin(request.getReviewerId());
        userAccessService.requirePermission(request.getReviewerId(), "station.review");
        StationConfigVersion version = requireVersion(versionId);
        requireStatus(version, STATUS_SUBMITTED, "仅已提交版本可审核通过");
        validateBeforeApprove(version);
        Station station = requireStation(version.getStationId());
        applyToStation(station, version);
        LocalDateTime now = LocalDateTime.now();
        version.setStatus(STATUS_APPLIED);
        version.setReviewerId(request.getReviewerId());
        version.setReviewNote(request.getReviewNote());
        version.setReviewTime(now);
        version.setAppliedAt(now);
        version.setUpdatedAt(now);
        versionMapper.updateById(version);
        return StationConfigVersionResponse.from(version);
    }

    @Transactional
    public StationConfigVersionResponse approve(Long adminUserId, Long versionId, StationConfigVersionReviewRequest request) {
        if (request == null) {
            request = new StationConfigVersionReviewRequest();
        }
        request.setReviewerId(adminUserId);
        return approve(versionId, request);
    }

    @Transactional
    public StationConfigVersionResponse reject(Long versionId, StationConfigVersionReviewRequest request) {
        requireReviewRequest(request);
        userAccessService.requireAdmin(request.getReviewerId());
        userAccessService.requirePermission(request.getReviewerId(), "station.review");
        StationConfigVersion version = requireVersion(versionId);
        requireStatus(version, STATUS_SUBMITTED, "仅已提交版本可驳回");
        LocalDateTime now = LocalDateTime.now();
        version.setStatus(STATUS_REJECTED);
        version.setReviewerId(request.getReviewerId());
        version.setReviewNote(request.getReviewNote());
        version.setReviewTime(now);
        version.setUpdatedAt(now);
        versionMapper.updateById(version);
        return StationConfigVersionResponse.from(version);
    }

    @Transactional
    public StationConfigVersionResponse reject(Long adminUserId, Long versionId, StationConfigVersionReviewRequest request) {
        if (request == null) {
            request = new StationConfigVersionReviewRequest();
        }
        request.setReviewerId(adminUserId);
        return reject(versionId, request);
    }

    public StationConfigVersionDetailResponse getStationDetail(Long stationId, Long userId) {
        Station station = requireManageableStation(stationId, userId);
        List<StationConfigVersionResponse> versions = listByStation(station.getId()).stream()
                .map(StationConfigVersionResponse::from)
                .collect(Collectors.toList());
        StationConfigVersionDetailResponse response = new StationConfigVersionDetailResponse();
        response.setStation(station);
        response.setVersions(versions);
        return response;
    }

    public StationConfigVersionDetailResponse getActivityStationDetail(Long userId, Long activityId) {
        if (activityId == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "活动ID不能为空");
        }
        Station station = stationMapper.selectOne(new LambdaQueryWrapper<Station>()
                .eq(Station::getActivityId, activityId)
                .orderByDesc(Station::getId)
                .last("LIMIT 1"));
        if (station == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "活动站点不存在");
        }
        return getStationDetail(station.getId(), userId);
    }

    public List<StationConfigVersionResponse> listReviews(Long adminUserId, String status) {
        userAccessService.requireAdmin(adminUserId);
        LambdaQueryWrapper<StationConfigVersion> wrapper = new LambdaQueryWrapper<StationConfigVersion>()
                .orderByDesc(StationConfigVersion::getUpdatedAt)
                .orderByDesc(StationConfigVersion::getId);
        if (StringUtils.hasText(status)) {
            wrapper.eq(StationConfigVersion::getStatus, status.trim());
        }
        List<StationConfigVersion> versions = versionMapper.selectList(wrapper);
        if (versions == null) {
            return Collections.emptyList();
        }
        return versions.stream().filter(Objects::nonNull)
                .map(StationConfigVersionResponse::from)
                .collect(Collectors.toList());
    }

    private void applyToStation(Station station, StationConfigVersion version) {
        if (CHANGE_DELETE_STATION.equals(version.getChangeType())) {
            station.setStatus(0);
            station.setPublishStatus("cancelled");
        }
        if (StringUtils.hasText(version.getCity())) {
            station.setCity(version.getCity().trim());
        }
        if (StringUtils.hasText(version.getStationName())) {
            station.setStationName(version.getStationName().trim());
        }
        Long appliedVenueId = version.getVenueId();
        if (isScheduleChange(version) && appliedVenueId == null && version.getVenueApplicationId() == null && station.getVenueApplicationId() != null) {
            appliedVenueId = requireStationVenueApplication(station).getVenueId();
        }
        if (version.getVenueApplicationId() != null) {
            VenueApplication application = venueApplicationMapper.selectById(version.getVenueApplicationId());
            if (application == null || !Integer.valueOf(1).equals(application.getStatus())) {
                throw new BusinessException(ResultCode.BAD_REQUEST, "场馆审核资料未通过");
            }
            Long organizerId = requireStationOrganizerId(station);
            if (!Objects.equals(application.getApplicantId(), organizerId)) {
                throw new BusinessException(ResultCode.FORBIDDEN, "场馆审核资料不属于该站点主办方");
            }
            validateSingleActivityVenueCity(station, application.getVenueId());
            station.setVenueApplicationId(application.getId());
            station.setPublishStatus("venue_confirmed");
            appliedVenueId = application.getVenueId();
        } else if (version.getVenueId() != null) {
            if (station.getActivityId() == null || station.getTourId() != null) {
                throw new BusinessException(ResultCode.BAD_REQUEST, "巡演站点场馆变更必须提供场馆审核资料");
            }
            requireActiveVenue(version.getVenueId());
            station.setPublishStatus("venue_confirmed");
        }
        applySessionSchedule(version, appliedVenueId);
        station.setUpdateTime(LocalDateTime.now());
        stationMapper.updateById(station);
    }

    private void applySessionSchedule(StationConfigVersion version, Long venueId) {
        if (version.getActivityId() == null
                || venueId == null
                || version.getStartTime() == null
                || Boolean.TRUE.equals(version.getScheduleTba())) {
            return;
        }
        requireActiveVenue(venueId);
        LocalDateTime now = LocalDateTime.now();
        Session session = sessionMapper.selectOne(new LambdaQueryWrapper<Session>()
                .eq(Session::getActivityId, version.getActivityId())
                .eq(Session::getStatus, 1)
                .orderByAsc(Session::getId)
                .last("LIMIT 1"));
        if (session == null) {
            session = new Session();
            session.setActivityId(version.getActivityId());
            session.setCreateTime(now);
            session.setStatus(1);
            session.setVenueId(venueId);
            session.setStartTime(version.getStartTime());
            session.setEndTime(version.getEndTime());
            session.setUpdateTime(now);
            sessionMapper.insert(session);
            return;
        }
        session.setVenueId(venueId);
        session.setStartTime(version.getStartTime());
        session.setEndTime(version.getEndTime());
        session.setUpdateTime(now);
        sessionMapper.updateById(session);
    }

    private Venue requireActiveVenue(Long venueId) {
        Venue venue = venueMapper.selectById(venueId);
        if (venue == null || !Integer.valueOf(1).equals(venue.getStatus())) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "场馆不存在或已停用");
        }
        return venue;
    }

    private Station requireManageableStation(Long stationId, Long userId) {
        InternalUserRefResponse user = userAccessService.requireAdminOrOrganizerOrAnyPermission(userId, "activity.manage", "tour.manage");
        Station station = requireStation(stationId);
        if (userAccessService.isAdmin(user) || !userAccessService.isOrganizer(user)) {
            return station;
        }
        if (station.getTourId() != null) {
            Tour tour = tourMapper.selectById(station.getTourId());
            if (tour == null || !Objects.equals(tour.getOrganizerId(), user.getId())) {
                throw new BusinessException(ResultCode.FORBIDDEN, "无权限管理该站点");
            }
            return station;
        }
        if (station.getActivityId() != null) {
            Activity activity = activityMapper.selectById(station.getActivityId());
            if (activity == null || !Objects.equals(activity.getOrganizerId(), user.getId())) {
                throw new BusinessException(ResultCode.FORBIDDEN, "无权限管理该站点");
            }
            return station;
        }
        throw new BusinessException(ResultCode.BAD_REQUEST, "站点缺少归属信息");
    }

    private Long requireStationOrganizerId(Station station) {
        if (station.getTourId() != null) {
            Tour tour = tourMapper.selectById(station.getTourId());
            if (tour == null || tour.getOrganizerId() == null) {
                throw new BusinessException(ResultCode.BAD_REQUEST, "站点巡演归属不存在");
            }
            return tour.getOrganizerId();
        }
        if (station.getActivityId() != null) {
            Activity activity = activityMapper.selectById(station.getActivityId());
            if (activity == null || activity.getOrganizerId() == null) {
                throw new BusinessException(ResultCode.BAD_REQUEST, "站点活动归属不存在");
            }
            return activity.getOrganizerId();
        }
        throw new BusinessException(ResultCode.BAD_REQUEST, "站点缺少归属信息");
    }

    private Station requireStation(Long stationId) {
        if (stationId == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "站点ID不能为空");
        }
        Station station = stationMapper.selectById(stationId);
        if (station == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "站点不存在");
        }
        return station;
    }

    private StationConfigVersion requireVersion(Long versionId) {
        if (versionId == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "版本ID不能为空");
        }
        StationConfigVersion version = versionMapper.selectById(versionId);
        if (version == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "站点配置版本不存在");
        }
        return version;
    }

    private void requireRequest(StationConfigVersionRequest request) {
        if (request == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "请求不能为空");
        }
        if (!StringUtils.hasText(request.getChangeType())) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "变更类型不能为空");
        }
        if (!ALLOWED_CHANGE_TYPES.contains(request.getChangeType().trim())) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "不支持的变更类型");
        }
    }

    private void requireOperator(Long operatorId) {
        if (operatorId == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "操作人不能为空");
        }
    }

    private void requireReviewRequest(StationConfigVersionReviewRequest request) {
        if (request == null || request.getReviewerId() == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "审核人不能为空");
        }
    }

    private void requireStatus(StationConfigVersion version, String status, String message) {
        if (!status.equals(version.getStatus())) {
            throw new BusinessException(ResultCode.BAD_REQUEST, message);
        }
    }

    private void validateSubmit(StationConfigVersion version) {
        if ((CHANGE_SET_VENUE.equals(version.getChangeType()) || CHANGE_CHANGE_VENUE.equals(version.getChangeType()))
                && version.getVenueApplicationId() == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "场馆变更必须提供已审核通过的场馆审核资料");
        }
        if (CHANGE_CHANGE_VENUE.equals(version.getChangeType())) {
            Station station = requireStation(version.getStationId());
            if (station.getActivityId() != null) {
                validateSingleActivityVenueChange(version, station);
            }
        }
        if (isScheduleChange(version)) {
            validateScheduleChange(version);
        }
    }

    private boolean isScheduleChange(StationConfigVersion version) {
        return CHANGE_SET_SCHEDULE.equals(version.getChangeType()) || CHANGE_CHANGE_SCHEDULE.equals(version.getChangeType());
    }

    private void validateScheduleChange(StationConfigVersion version) {
        if (Boolean.TRUE.equals(version.getScheduleTba())) {
            return;
        }
        if (version.getStartTime() == null || version.getEndTime() == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "排期变更必须填写开始和结束时间");
        }
        if (!version.getEndTime().isAfter(version.getStartTime())) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "排期结束时间必须晚于开始时间");
        }
    }

    private void validateSingleActivityVenueChange(StationConfigVersion version, Station station) {
        if (StringUtils.hasText(version.getCity())
                && StringUtils.hasText(station.getCity())
                && !version.getCity().trim().equals(station.getCity().trim())) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "场地变更不能修改城市");
        }
        List<Session> sessions = sessionMapper.selectList(new LambdaQueryWrapper<Session>()
                .eq(Session::getActivityId, station.getActivityId()));
        List<Long> sessionIds = sessions == null ? Collections.emptyList() : sessions.stream()
                .map(Session::getId)
                .filter(Objects::nonNull)
                .collect(Collectors.toList());
        if (sessionIds.isEmpty()) {
            return;
        }
        if (!StringUtils.hasText(internalApiToken)) {
            throw new BusinessException(ResultCode.INTERNAL_ERROR, "内部接口令牌未配置");
        }
        Result<PaidOrderCountResponse> result = orderInternalClient.countPaidBySessions(
                new PaidOrderCountRequest(sessionIds), internalApiToken);
        if (result == null || result.getCode() != ResultCode.SUCCESS.getCode()) {
            String message = result != null && StringUtils.hasText(result.getMessage()) ? result.getMessage() : "订单服务无响应";
            throw new BusinessException(ResultCode.INTERNAL_ERROR, "统计已支付订单失败: " + message);
        }
        PaidOrderCountResponse data = result.getData();
        long paidOrderCount = data != null && data.getPaidOrderCount() != null ? data.getPaidOrderCount() : 0L;
        if (paidOrderCount > 0) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "活动已有已支付订单，请先完成退款/下架清理后再申请场地变更");
        }
    }

    private VenueApplication requireStationVenueApplication(Station station) {
        VenueApplication application = venueApplicationMapper.selectById(station.getVenueApplicationId());
        if (application == null || !Integer.valueOf(1).equals(application.getStatus())) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "站点尚未绑定已通过的场馆审核资料");
        }
        Long organizerId = requireStationOrganizerId(station);
        if (!Objects.equals(application.getApplicantId(), organizerId)) {
            throw new BusinessException(ResultCode.FORBIDDEN, "场馆审核资料不属于该站点主办方");
        }
        return application;
    }

    private void validateSingleActivityVenueCity(Station station, Long venueId) {
        if (station.getActivityId() == null || venueId == null || !StringUtils.hasText(station.getCity())) {
            return;
        }
        Venue venue = requireActiveVenue(venueId);
        if (StringUtils.hasText(venue.getCity()) && !station.getCity().trim().equals(venue.getCity().trim())) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "场地变更不能选择其他城市的场馆");
        }
    }

    private void validateBeforeApprove(StationConfigVersion version) {
        if (CHANGE_CHANGE_VENUE.equals(version.getChangeType())) {
            Station station = requireStation(version.getStationId());
            if (station.getActivityId() != null) {
                validateSingleActivityVenueChange(version, station);
            }
        }
        if (isScheduleChange(version)) {
            validateScheduleChange(version);
        }
    }

    private int nextVersionNo(Long stationId) {
        return listByStation(stationId).stream()
                .map(StationConfigVersion::getVersionNo)
                .filter(Objects::nonNull)
                .max(Comparator.naturalOrder())
                .orElse(0) + 1;
    }

    private List<StationConfigVersion> listByStation(Long stationId) {
        List<StationConfigVersion> versions = versionMapper.selectList(new LambdaQueryWrapper<StationConfigVersion>()
                .eq(StationConfigVersion::getStationId, stationId)
                .orderByDesc(StationConfigVersion::getVersionNo)
                .orderByDesc(StationConfigVersion::getId));
        return versions == null ? Collections.emptyList() : versions;
    }

    private void copyRequest(StationConfigVersion version, StationConfigVersionRequest request) {
        version.setChangeType(request.getChangeType().trim());
        version.setCity(trimToNull(request.getCity()));
        version.setStationName(trimToNull(request.getStationName()));
        version.setVenueId(request.getVenueId());
        version.setVenueApplicationId(request.getVenueApplicationId());
        version.setVenueName(trimToNull(request.getVenueName()));
        version.setVenueAddress(trimToNull(request.getVenueAddress()));
        version.setStartTime(request.getStartTime());
        version.setEndTime(request.getEndTime());
        version.setScheduleTba(request.getScheduleTba());
        version.setSeatTemplateSourceType(trimToNull(request.getSeatTemplateSourceType()));
        version.setSeatTemplateSourceId(request.getSeatTemplateSourceId());
        version.setReason(trimToNull(request.getReason()));
    }

    private String trimToNull(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }
}
