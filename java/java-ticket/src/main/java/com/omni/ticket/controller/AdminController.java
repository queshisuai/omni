package com.omni.ticket.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.omni.common.result.Result;
import com.omni.common.result.ResultCode;
import com.omni.common.util.JwtUtil;
import com.omni.ticket.dto.DeactivateActivityRequest;
import com.omni.ticket.dto.DeactivateOrganizerRequest;
import com.omni.ticket.dto.AdminSummaryResponse;
import com.omni.ticket.dto.DeleteActivityRequest;
import com.omni.ticket.dto.DeleteActivityResponse;
import com.omni.ticket.dto.RefundImpactResponse;
import com.omni.ticket.dto.ActivityArtistDto;
import com.omni.ticket.dto.ActivityRiskCaseResponse;
import com.omni.ticket.dto.ActivityRiskResolutionRequest;
import com.omni.ticket.dto.ActivityRiskResolutionResponse;
import com.omni.ticket.dto.ActivityRiskResolutionReviewRequest;
import com.omni.ticket.dto.AssetUploadResponse;
import com.omni.ticket.dto.ArtistReviewRequest;
import com.omni.ticket.dto.ArtistRiskRequest;
import com.omni.ticket.dto.ArtistSearchResponse;
import com.omni.ticket.dto.ArtistSubmissionRequest;
import com.omni.ticket.dto.SeatLayoutTemplateCandidateResponse;
import com.omni.ticket.dto.SeatCraftLayoutDtos;
import com.omni.ticket.dto.SeatTemplateResponse;
import com.omni.ticket.dto.SeatTemplateSyncResponse;
import com.omni.ticket.dto.SessionAdminResponse;
import com.omni.ticket.dto.UpdateActivityStatusRequest;
import com.omni.ticket.dto.VenueApplicationRequest;
import com.omni.ticket.dto.VenueApplicationResponse;
import com.omni.ticket.dto.VenueApplicationReviewRequest;
import com.omni.ticket.dto.VenueSeatRequest;
import com.omni.ticket.dto.OrderInfoResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.omni.ticket.entity.*;
import com.omni.ticket.mapper.*;
import com.omni.ticket.service.ActivityAdminService;
import com.omni.ticket.service.ActivityArtistService;
import com.omni.ticket.service.ArtistAdminService;
import com.omni.ticket.service.ArtistGovernanceService;
import com.omni.ticket.service.ActivityRiskResponseService;
import com.omni.ticket.service.ActivitySeatLayoutService;
import com.omni.ticket.service.AdminSummaryService;
import com.omni.ticket.service.UserAccessService;
import com.omni.ticket.service.VenueDefaultLayoutService;
import com.omni.ticket.service.SeatTemplateService;
import com.omni.ticket.service.SessionAdminService;
import com.omni.ticket.service.SessionSeatLayoutService;
import com.omni.ticket.service.SessionSeatProtectionService;
import com.omni.ticket.service.SessionSeatService;
import com.omni.ticket.service.TicketTypeAreaService;
import com.omni.ticket.service.TicketTypeStockRecalculationService;
import com.omni.ticket.service.TourStationService;
import com.omni.ticket.service.TicketAssetService;
import com.omni.ticket.service.VenueApplicationService;
import com.omni.ticket.service.OrderAdminQueryService;
import io.jsonwebtoken.Claims;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * B端管理接口 - 角色分级权限
 * admin（平台管理员）：全部数据增删改查
 * organizer（商户/主办方）：只能管理自己上传的活动，查看自己的订单
 */
@RestController
@RequestMapping("/api/ticket/admin")
public class AdminController {

    private static final String BEARER_PREFIX = "Bearer ";
    private static final String SEAT_MAP_VISIBILITY_HIDDEN = "hidden";
    private static final String SEAT_MAP_VISIBILITY_PUBLISHED = "published";

    private final ActivityMapper activityMapper;
    private final ArtistMapper artistMapper;
    private final SessionMapper sessionMapper;
    private final TicketTypeMapper ticketTypeMapper;
    private final VenueMapper venueMapper;
    private final UserAccessService userAccessService;
    private final ActivityAdminService activityAdminService;
    private final SessionAdminService sessionAdminService;
    private final VenueApplicationService venueApplicationService;
    private final SeatTemplateService seatTemplateService;
    private final TicketTypeAreaService ticketTypeAreaService;
    private final AdminSummaryService adminSummaryService;
    private final SessionSeatService sessionSeatService;
    private final VenueDefaultLayoutService venueDefaultLayoutService;
    private final ActivitySeatLayoutService activitySeatLayoutService;
    private final SessionSeatLayoutService sessionSeatLayoutService;
    private final TourStationService tourStationService;
    private final OrderAdminQueryService orderAdminQueryService;
    private final SessionSeatProtectionService sessionSeatProtectionService;
    private final TicketTypeStockRecalculationService stockRecalculationService;
    private final ActivityArtistService activityArtistService;
    private final ArtistAdminService artistAdminService;
    private final ArtistGovernanceService artistGovernanceService;
    private final ActivityRiskResponseService activityRiskResponseService;
    private final TicketAssetService ticketAssetService;

    public AdminController(ActivityMapper activityMapper, SessionMapper sessionMapper,
                            TicketTypeMapper ticketTypeMapper, VenueMapper venueMapper,
                            UserAccessService userAccessService,
                             ActivityAdminService activityAdminService,
                             SessionAdminService sessionAdminService,
                             VenueApplicationService venueApplicationService,
                              SeatTemplateService seatTemplateService,
                                TicketTypeAreaService ticketTypeAreaService,
                                AdminSummaryService adminSummaryService,
                                 SessionSeatService sessionSeatService,
                                 VenueDefaultLayoutService venueDefaultLayoutService) {
        this(activityMapper, null, sessionMapper, ticketTypeMapper, venueMapper, userAccessService, activityAdminService,
                sessionAdminService, venueApplicationService, seatTemplateService, ticketTypeAreaService,
                adminSummaryService, sessionSeatService, venueDefaultLayoutService, null, null, null, null, null, null, null, null, null, null, null);
    }

    @Autowired
    public AdminController(ActivityMapper activityMapper, ArtistMapper artistMapper, SessionMapper sessionMapper,
                            TicketTypeMapper ticketTypeMapper, VenueMapper venueMapper,
                            UserAccessService userAccessService,
                             ActivityAdminService activityAdminService,
                             SessionAdminService sessionAdminService,
                             VenueApplicationService venueApplicationService,
                              SeatTemplateService seatTemplateService,
                                TicketTypeAreaService ticketTypeAreaService,
                                AdminSummaryService adminSummaryService,
                                  SessionSeatService sessionSeatService,
                                   VenueDefaultLayoutService venueDefaultLayoutService,
                                   ActivitySeatLayoutService activitySeatLayoutService,
                                   SessionSeatLayoutService sessionSeatLayoutService,
                                    TourStationService tourStationService,
                                    OrderAdminQueryService orderAdminQueryService,
                                     SessionSeatProtectionService sessionSeatProtectionService,
                                     TicketTypeStockRecalculationService stockRecalculationService,
                                      ActivityArtistService activityArtistService,
                                      ArtistAdminService artistAdminService,
                                      ArtistGovernanceService artistGovernanceService,
                                      ActivityRiskResponseService activityRiskResponseService,
                                      TicketAssetService ticketAssetService) {
        this.activityMapper = activityMapper;
        this.artistMapper = artistMapper;
        this.sessionMapper = sessionMapper;
        this.ticketTypeMapper = ticketTypeMapper;
        this.venueMapper = venueMapper;
        this.userAccessService = userAccessService;
        this.activityAdminService = activityAdminService;
        this.sessionAdminService = sessionAdminService;
        this.venueApplicationService = venueApplicationService;
        this.seatTemplateService = seatTemplateService;
        this.ticketTypeAreaService = ticketTypeAreaService;
        this.adminSummaryService = adminSummaryService;
        this.sessionSeatService = sessionSeatService;
        this.venueDefaultLayoutService = venueDefaultLayoutService;
        this.activitySeatLayoutService = activitySeatLayoutService;
        this.sessionSeatLayoutService = sessionSeatLayoutService;
        this.tourStationService = tourStationService;
        this.orderAdminQueryService = orderAdminQueryService;
        this.sessionSeatProtectionService = sessionSeatProtectionService;
        this.stockRecalculationService = stockRecalculationService;
        this.activityArtistService = activityArtistService;
        this.artistAdminService = artistAdminService;
        this.artistGovernanceService = artistGovernanceService;
        this.activityRiskResponseService = activityRiskResponseService;
        this.ticketAssetService = ticketAssetService;
    }

    @PostMapping("/assets")
    public Result<AssetUploadResponse> uploadAsset(@RequestHeader(value = "Authorization", required = false) String authorization,
                                                   @RequestParam Long userId,
                                                   @RequestParam String bizType,
                                                   @RequestParam MultipartFile file) {
        Long operatorId = parseOperatorId(authorization);
        if (operatorId == null) {
            return Result.fail(ResultCode.UNAUTHORIZED);
        }
        if (!operatorId.equals(userId)) {
            return Result.fail(ResultCode.FORBIDDEN);
        }
        checkRole(userId);
        return Result.success(ticketAssetService.upload(userId, bizType, file));
    }

    @GetMapping("/artists/search")
    public Result<List<ArtistSearchResponse>> searchArtists(@RequestParam(required = false) String keyword) {
        return Result.success(artistAdminService.search(keyword));
    }

    @GetMapping("/artists/{id}")
    public Result<Artist> getArtist(@PathVariable Long id) {
        Artist artist = artistAdminService.getById(id);
        if (artist == null) return Result.fail(404, "艺人不存在");
        return Result.success(artist);
    }

    @PostMapping("/artists/submissions")
    public Result<Artist> submitArtist(@RequestBody ArtistSubmissionRequest request) {
        return Result.success(artistGovernanceService.submit(request));
    }

    @GetMapping("/artists/pending")
    public Result<List<Artist>> listPendingArtists(@RequestParam Long userId) {
        return Result.success(artistGovernanceService.listPending(userId));
    }

    @PostMapping("/artists/{id}/review")
    public Result<Artist> reviewArtist(@PathVariable Long id, @RequestBody ArtistReviewRequest request) {
        return Result.success(artistGovernanceService.review(id, request));
    }

    @PostMapping("/artists/{id}/risk")
    public Result<Artist> updateArtistRisk(@PathVariable Long id, @RequestBody ArtistRiskRequest request) {
        return Result.success(artistGovernanceService.updateRisk(id, request));
    }

    @PostMapping("/activities/{id}/risk-resolution")
    public Result<ActivityRiskResolutionResponse> submitRiskResolution(@PathVariable Long id,
                                                                       @RequestBody ActivityRiskResolutionRequest request) {
        return Result.success(activityRiskResponseService.submitResolution(id, request));
    }

    @GetMapping("/risk-resolutions")
    public Result<List<ActivityRiskResolutionResponse>> listRiskResolutions(@RequestParam Long userId,
                                                                            @RequestParam(required = false) String status) {
        return Result.success(activityRiskResponseService.listResolutions(userId, status));
    }

    @PostMapping("/risk-resolutions/{id}/review")
    public Result<ActivityRiskResolutionResponse> reviewRiskResolution(@PathVariable Long id,
                                                                       @RequestBody ActivityRiskResolutionReviewRequest request) {
        return Result.success(activityRiskResponseService.reviewResolution(id, request));
    }

    @PostMapping("/activities/{id}/suspend")
    public Result<ActivityRiskResolutionResponse> suspendActivityForRisk(@PathVariable Long id,
                                                                          @RequestBody Map<String, Object> body) {
        Long userId = body.get("userId") == null ? null : Long.valueOf(body.get("userId").toString());
        String reason = body.get("reason") == null ? null : body.get("reason").toString();
        return Result.success(activityRiskResponseService.adminSuspendActivity(id, userId, reason));
    }

    @GetMapping("/risk-cases")
    public Result<List<ActivityRiskCaseResponse>> listRiskCases(@RequestParam Long userId) {
        return Result.success(activityRiskResponseService.listRiskCases(userId));
    }

    @GetMapping("/summary")
    public Result<AdminSummaryResponse> getAdminSummary(@RequestParam Long userId) {
        return Result.success(adminSummaryService.getSummary(userId));
    }

    @GetMapping("/orders")
    public Result<List<OrderInfoResponse>> listAdminOrders(@RequestParam Long userId,
                                                           @RequestParam(defaultValue = "false") Boolean paidOnly) {
        return Result.success(orderAdminQueryService.listOrders(userId, paidOnly));
    }

    @PostMapping("/tours/draft")
    public Result<Tour> createTourDraft(@RequestBody Map<String, Object> body) {
        Long userId = parsePositiveLong(body == null ? null : body.get("userId"));
        return Result.success(tourStationService.createTourDraft(userId, body));
    }

    @GetMapping("/tours")
    public Result<Page<Tour>> listTours(@RequestParam Long userId,
                                         @RequestParam(defaultValue = "1") Integer page,
                                         @RequestParam(defaultValue = "10") Integer size) {
        return Result.success(tourStationService.listManageableTours(userId, page, size));
    }

    @GetMapping("/tours/{tourId}")
    public Result<Map<String, Object>> getTour(@PathVariable Long tourId, @RequestParam Long userId) {
        return Result.success(tourStationService.getManageableTourDetail(userId, tourId));
    }

    @PostMapping("/tours/{tourId}/stations/draft")
    public Result<Station> createStationDraft(@PathVariable Long tourId, @RequestBody Map<String, Object> body) {
        Long userId = parsePositiveLong(body == null ? null : body.get("userId"));
        return Result.success(tourStationService.createStationDraft(userId, tourId, body));
    }

    @PostMapping("/stations/{stationId}/publish")
    public Result<Map<String, Object>> publishStation(@PathVariable Long stationId, @RequestBody Map<String, Object> body) {
        Long userId = parsePositiveLong(body == null ? null : body.get("userId"));
        return Result.success(tourStationService.publishStation(userId, stationId, body));
    }

    /** 获取用户角色，非admin/organizer返回null并拒绝 */
    private String checkRole(Long userId) {
        return userAccessService.requireAdminOrOrganizerRole(userId);
    }

    private Long resolveArtistId(Map<String, Object> body) {
        Long artistId = parsePositiveLong(body.get("artistId"));
        if (artistId != null) return artistId;
        String artistName = parseNonBlankString(body.get("artistName"));
        if (artistName == null || artistMapper == null) return null;
        Artist existing = artistMapper.selectOne(new LambdaQueryWrapper<Artist>()
                .eq(Artist::getName, artistName)
                .eq(Artist::getStatus, 1)
                .last("LIMIT 1"));
        if (existing != null && existing.getId() != null) return existing.getId();
        Artist artist = new Artist();
        artist.setName(artistName);
        artist.setStatus(1);
        artist.setCreateTime(LocalDateTime.now());
        artistMapper.insert(artist);
        return artist.getId();
    }

    /** 检查organizer是否拥有此活动 */
    private boolean ownsActivity(Long activityId, Long userId) {
        Activity a = activityMapper.selectById(activityId);
        return a != null && userId.equals(a.getOrganizerId());
    }

    // ========== 活动管理 ==========

    @PostMapping("/activities")
    public Result<Activity> createActivity(@RequestBody Map<String, Object> body) {
        Long userId = parsePositiveLong(body.get("userId"));
        if (userId == null) return Result.fail(400, "用户ID不正确");
        String role = checkRole(userId);
        if (role == null) return Result.fail(403, "无权限");

        Long categoryId = parsePositiveLong(body.get("categoryId"));
        if (categoryId == null) return Result.fail(400, "分类ID不正确");
        List<ActivityArtistDto> artists = parseArtists(body.get("artists"));
        Long artistId = artists.stream()
                .filter(a -> Boolean.TRUE.equals(a.getPrimary()))
                .map(ActivityArtistDto::getArtistId)
                .findFirst()
                .orElseGet(() -> resolveArtistId(body));
        if (artistId == null && !artists.isEmpty()) artistId = artists.get(0).getArtistId();
        if (artistId == null) return Result.fail(400, "艺人/团队名称不能为空");
        String name = parseNonBlankString(body.get("name"));
        if (name == null) return Result.fail(400, "活动名称不能为空");

        Activity activity = new Activity();
        activity.setCategoryId(categoryId);
        activity.setArtistId(artistId);
        activity.setTourId(parsePositiveLong(body.get("tourId")));
        activity.setStationId(parsePositiveLong(body.get("stationId")));
        activity.setVenueApplicationId(parsePositiveLong(body.get("venueApplicationId")));
        activity.setVenueApprovalNo(parseNonBlankString(body.get("venueApprovalNo")));
        activity.setVenueApprovalFileUrl(parseNonBlankString(body.get("venueApprovalFileUrl")));
        activity.setVenueApprovalNote(parseNonBlankString(body.get("venueApprovalNote")));
        activity.setPublishStatus(body.get("publishStatus") != null ? body.get("publishStatus").toString() : "draft");
        String seatMapVisibility = parseSeatMapVisibility(body.get("seatMapVisibility"), SEAT_MAP_VISIBILITY_HIDDEN);
        if (seatMapVisibility == null) return Result.fail(400, "座位图展示策略不正确");
        activity.setSeatMapVisibility(seatMapVisibility);
        activity.setName(name);
        activity.setDescription(body.get("description") != null ? body.get("description").toString() : null);
        activity.setPoster(body.get("poster") != null ? body.get("poster").toString() : null);
        activity.setStatus(1);
        activity.setOrganizerId(userId); // 记录创建者
        activityMapper.insert(activity);
        if (!artists.isEmpty()) activityArtistService.saveLineup(activity.getId(), artists);
        return Result.success(activity);
    }

    @PutMapping("/activities/{id}")
    public Result<Activity> updateActivity(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        if (id == null || id <= 0) return Result.fail(400, "活动ID不正确");
        Long userId = parsePositiveLong(body.get("userId"));
        if (userId == null) return Result.fail(400, "用户ID不正确");
        String role = checkRole(userId);
        if (role == null) return Result.fail(403, "无权限");

        Activity activity = activityMapper.selectById(id);
        if (activity == null) return Result.fail(404, "活动不存在");

        // organizer只能修改自己的活动
        if ("organizer".equals(role) && !userId.equals(activity.getOrganizerId()))
            return Result.fail(403, "只能修改自己主办的活动");

        if (body.containsKey("name")) {
            String name = parseNonBlankString(body.get("name"));
            if (name == null) return Result.fail(400, "活动名称不能为空");
            activity.setName(name);
        }
        if (body.containsKey("description")) activity.setDescription(body.get("description") != null ? body.get("description").toString() : null);
        if (body.containsKey("poster")) activity.setPoster(body.get("poster") != null ? body.get("poster").toString() : null);
        if (body.containsKey("categoryId")) {
            Long categoryId = parsePositiveLong(body.get("categoryId"));
            if (categoryId == null) return Result.fail(400, "分类ID不正确");
            activity.setCategoryId(categoryId);
        }
        if (body.containsKey("artistId")) {
            Long artistId = parsePositiveLong(body.get("artistId"));
            if (artistId == null) return Result.fail(400, "艺人/团队名称不能为空");
            activity.setArtistId(artistId);
        } else if (body.containsKey("artistName")) {
            Long artistId = resolveArtistId(body);
            if (artistId == null) return Result.fail(400, "艺人/团队名称不能为空");
            activity.setArtistId(artistId);
        }
        if (body.containsKey("artists")) {
            List<ActivityArtistDto> artists = parseArtists(body.get("artists"));
            activityArtistService.saveLineup(id, artists);
            Long lineupArtistId = artists.stream()
                    .filter(a -> Boolean.TRUE.equals(a.getPrimary()))
                    .findFirst()
                    .map(ActivityArtistDto::getArtistId)
                    .orElseGet(() -> artists.isEmpty() ? null : artists.get(0).getArtistId());
            if (lineupArtistId != null) activity.setArtistId(lineupArtistId);
        }
        if (body.containsKey("seatMapVisibility")) {
            String seatMapVisibility = parseSeatMapVisibility(body.get("seatMapVisibility"), null);
            if (seatMapVisibility == null) return Result.fail(400, "座位图展示策略不正确");
            activity.setSeatMapVisibility(seatMapVisibility);
        }
        activityMapper.updateById(activity);
        return Result.success(activity);
    }

    @GetMapping("/activities/{id}")
    public Result<Activity> getAdminActivity(@PathVariable Long id, @RequestParam Long userId) {
        if (id == null || id <= 0) return Result.fail(400, "活动ID不正确");
        if (userId == null || userId <= 0) return Result.fail(400, "用户ID不正确");
        String role = checkRole(userId);
        if (role == null) return Result.fail(403, "无权限");

        Activity activity = activityMapper.selectById(id);
        if (activity == null) return Result.fail(404, "活动不存在");

        // organizer只能查看自己的活动
        if ("organizer".equals(role) && !userId.equals(activity.getOrganizerId()))
            return Result.fail(403, "只能查看自己主办的活动");

        if (activityArtistService != null) {
            List<ActivityArtistDto> lineup = activityArtistService.listAdminLineup(id);
            activity.setArtists(lineup);
            String summary = lineup.stream()
                    .filter(a -> "public".equals(a.getVisibility()))
                    .map(ActivityArtistDto::getName)
                    .filter(StringUtils::hasText)
                    .collect(Collectors.joining("、"));
            activity.setArtistName(summary);
            if (!StringUtils.hasText(summary)) attachArtistName(activity);
        } else {
            attachArtistName(activity);
        }

        return Result.success(activity);
    }

    private void attachArtistName(Activity activity) {
        if (activity == null || activity.getArtistId() == null || artistMapper == null) return;
        Artist artist = artistMapper.selectById(activity.getArtistId());
        if (artist != null) activity.setArtistName(artist.getName());
    }

    private List<ActivityArtistDto> parseArtists(Object value) {
        if (!(value instanceof List<?>)) return List.of();
        List<?> list = (List<?>) value;
        List<ActivityArtistDto> artists = new ArrayList<>();
        for (Object item : list) {
            if (!(item instanceof Map<?, ?>)) continue;
            Map<?, ?> map = (Map<?, ?>) item;
            ActivityArtistDto dto = new ActivityArtistDto();
            dto.setArtistId(parsePositiveLong(map.get("artistId")));
            dto.setPrimary(Boolean.TRUE.equals(map.get("isPrimary")) || Boolean.TRUE.equals(map.get("primary")));
            dto.setRoleType(parseNonBlankString(map.get("roleType")));
            dto.setRoleName(parseNonBlankString(map.get("roleName")));
            dto.setVisibility(parseNonBlankString(map.get("visibility")));
            Long sort = parsePositiveLong(map.get("sort"));
            dto.setSort(sort == null ? null : sort.intValue());
            artists.add(dto);
        }
        return artists;
    }

    @PutMapping("/activities/{id}/status")
    public Result<Void> updateActivityStatus(@PathVariable Long id, @RequestBody UpdateActivityStatusRequest request) {
        activityAdminService.updateActivityStatus(id, request);
        return Result.success();
    }

    @PostMapping("/activities/{id}/deactivate")
    public Result<RefundImpactResponse> deactivateActivity(@PathVariable Long id,
                                                             @RequestBody DeactivateActivityRequest request) {
        return Result.success(activityAdminService.deactivateActivity(id, request));
    }

    @GetMapping("/activities/{activityId}/seat-layout")
    public Result<SeatCraftLayoutDtos.LayoutResponse> getActivitySeatLayout(@PathVariable Long activityId,
                                                                             @RequestParam Long userId) {
        return Result.success(activitySeatLayoutService.getLayout(userId, activityId));
    }

    @PutMapping("/activities/{activityId}/seat-layout")
    public Result<SeatCraftLayoutDtos.LayoutResponse> updateActivitySeatLayout(@PathVariable Long activityId,
                                                                                @RequestBody SeatCraftLayoutDtos.LayoutSaveRequest request) {
        if (request == null) {
            return Result.fail(400, "座位图参数不能为空");
        }
        return Result.success(activitySeatLayoutService.updateLayout(request.getUserId(), activityId, request.getLayout()));
    }

    @PostMapping("/organizers/deactivate")
    public Result<RefundImpactResponse> deactivateOrganizer(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestBody DeactivateOrganizerRequest request) {
        Long operatorId = parseOperatorId(authorization);
        if (operatorId == null) {
            return Result.fail(ResultCode.UNAUTHORIZED);
        }
        if (request == null) {
            request = new DeactivateOrganizerRequest();
        }
        request.setUserId(operatorId);
        return Result.success(activityAdminService.deactivateOrganizer(request));
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

    private Long parsePositiveLong(Object value) {
        if (value == null) return null;
        try {
            Long parsed = Long.valueOf(value.toString());
            return parsed > 0 ? parsed : null;
        } catch (RuntimeException e) {
            return null;
        }
    }

    private String parseNonBlankString(Object value) {
        if (value == null) return null;
        String text = value.toString().trim();
        return StringUtils.hasText(text) ? text : null;
    }

    private String parseSeatMapVisibility(Object value, String defaultValue) {
        if (value == null) return defaultValue;
        String visibility = value.toString().trim();
        if (SEAT_MAP_VISIBILITY_PUBLISHED.equals(visibility) || SEAT_MAP_VISIBILITY_HIDDEN.equals(visibility)) {
            return visibility;
        }
        return null;
    }

    @DeleteMapping("/activities/{id}")
    public Result<DeleteActivityResponse> deleteActivity(@PathVariable Long id,
                                                         @RequestBody DeleteActivityRequest request) {
        if (request == null || request.getUserId() == null || request.getUserId() <= 0) {
            return Result.fail(400, "用户ID不正确");
        }
        if (!StringUtils.hasText(request.getReason())) {
            return Result.fail(400, "删除原因不能为空");
        }
        return Result.success(activityAdminService.deleteActivity(id, request));
    }

    @GetMapping("/activities")
    public Result<Page<Activity>> listAdminActivities(
            @RequestParam Long userId,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Integer status) {
        String role = checkRole(userId);
        if (role == null) return Result.fail(403, "无权限");

        LambdaQueryWrapper<Activity> wrapper = new LambdaQueryWrapper<>();
        // organizer 只能看自己的活动，admin 看全部
        if ("organizer".equals(role)) {
            wrapper.eq(Activity::getOrganizerId, userId);
        }
        wrapper.ne(Activity::getPublishStatus, "deleted");
        if (StringUtils.hasText(keyword)) {
            wrapper.like(Activity::getName, keyword.trim());
        }
        if (status != null) {
            wrapper.eq(Activity::getStatus, status);
        }
        wrapper.orderByDesc(Activity::getCreateTime);
        Page<Activity> result = activityMapper.selectPage(new Page<>(page, size), wrapper);
        if (activityArtistService != null) {
            result.getRecords().forEach(this::attachLineupSummary);
        }
        return Result.success(result);
    }

    private void attachLineupSummary(Activity activity) {
        if (activity == null || activity.getId() == null) return;
        List<ActivityArtistDto> lineup = activityArtistService.listAdminLineup(activity.getId());
        activity.setArtists(lineup);
        String summary = lineup.stream()
                .filter(a -> "public".equals(a.getVisibility()))
                .map(ActivityArtistDto::getName)
                .filter(StringUtils::hasText)
                .collect(Collectors.joining("、"));
        if (StringUtils.hasText(summary)) {
            activity.setArtistName(summary);
        }
    }

    // ========== 场次管理（权限继承自活动） ==========

    @PostMapping("/sessions")
    public Result<Session> createSession(@RequestBody Map<String, Object> body) {
        return Result.success(sessionAdminService.createSession(body));
    }

    @PutMapping("/sessions/{id}")
    public Result<Session> updateSession(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        return Result.success(sessionAdminService.updateSession(id, body));
    }

    @DeleteMapping("/sessions/{id}")
    public Result<Void> deleteSession(@RequestParam Long userId, @PathVariable Long id) {
        sessionAdminService.deleteSession(userId, id);
        return Result.success();
    }

    @GetMapping("/sessions")
    public Result<Page<SessionAdminResponse>> listAdminSessions(
            @RequestParam Long userId,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size,
            @RequestParam(required = false) Long activityId,
            @RequestParam(required = false) Long venueId,
            @RequestParam(required = false) Integer status) {
        return Result.success(sessionAdminService.listSessions(userId, page, size, activityId, venueId, status));
    }

    @GetMapping("/sessions/{sessionId}/seat-layout")
    public Result<SeatCraftLayoutDtos.LayoutResponse> getSessionSeatLayout(@PathVariable Long sessionId,
                                                                             @RequestParam Long userId) {
        return Result.success(sessionSeatLayoutService.getLayout(userId, sessionId));
    }

    @PutMapping("/sessions/{sessionId}/seat-layout")
    public Result<SeatCraftLayoutDtos.LayoutResponse> updateSessionSeatLayout(@PathVariable Long sessionId,
                                                                                 @RequestBody SeatCraftLayoutDtos.LayoutSaveRequest request) {
        if (request == null) {
            return Result.fail(400, "座位图参数不能为空");
        }
        return Result.success(sessionSeatLayoutService.updateLayout(request.getUserId(), sessionId, request.getLayout()));
    }

    @PutMapping("/sessions/{sessionId}/ticket-bindings")
    public Result<Void> updateSessionTicketBindings(@PathVariable Long sessionId,
                                                     @RequestBody TicketBindingUpdateRequest request) {
        if (request == null) {
            return Result.fail(400, "票档绑定参数不能为空");
        }
        sessionSeatLayoutService.updateTicketBindings(request.getUserId(), sessionId, request.getBindings());
        return Result.success();
    }

    @GetMapping("/sessions/{sessionId}/seat-layout/ticket-drafts")
    public Result<List<SeatCraftLayoutDtos.SectionResponse>> getTicketDrafts(@PathVariable Long sessionId,
                                                                               @RequestParam Long userId) {
        return Result.success(sessionSeatLayoutService.buildTicketDraftsForSession(userId, sessionId));
    }

    // ========== 票档管理（权限继承自活动） ==========

    @Transactional
    @PostMapping("/ticket-types")
    public Result<TicketType> createTicketType(@RequestBody Map<String, Object> body) {
        Long userId = Long.valueOf(body.get("userId").toString());
        String role = checkRole(userId);
        if (role == null) return Result.fail(403, "无权限");

        Long sessionId = Long.valueOf(body.get("sessionId").toString());
        Session session = sessionMapper.selectById(sessionId);
        if (session == null) return Result.fail(404, "场次不存在");

        if ("organizer".equals(role) && !ownsActivity(session.getActivityId(), userId))
            return Result.fail(403, "只能管理自己主办的票档");

        TicketType tt = new TicketType();
        tt.setSessionId(sessionId);
        tt.setName(body.get("name").toString());
        tt.setPrice(new java.math.BigDecimal(body.get("price").toString()));
        tt.setStatus(1);
        if (body.containsKey("areaIds")) {
            @SuppressWarnings("unchecked")
            List<Object> rawAreaIds = (List<Object>) body.get("areaIds");
            List<Long> areaIds = rawAreaIds.stream().map(value -> Long.valueOf(value.toString())).collect(java.util.stream.Collectors.toList());
            tt = ticketTypeAreaService.createTicketType(tt, areaIds);
        } else if (body.containsKey("layoutSectionIds")) {
            @SuppressWarnings("unchecked")
            List<Object> rawSectionIds = (List<Object>) body.get("layoutSectionIds");
            List<Long> sectionIds = rawSectionIds.stream().map(value -> Long.valueOf(value.toString())).distinct().collect(Collectors.toList());
            if (sectionIds.isEmpty()) {
                return Result.fail(400, "请选择绑定分区");
            }
            int totalStock = sessionSeatLayoutService.countAvailableSeatsForSections(sessionId, sectionIds);
            if (totalStock <= 0) {
                return Result.fail(400, "所选分区暂无可售座位");
            }
            tt.setTotalStock(totalStock);
            tt.setRemainStock(totalStock);
            ticketTypeMapper.insert(tt);
            Map<Long, SessionSeatLayoutService.TicketDraftInput> drafts = new java.util.LinkedHashMap<>();
            for (Long sectionId : sectionIds) {
                SessionSeatLayoutService.TicketDraftInput input = new SessionSeatLayoutService.TicketDraftInput();
                input.setTicketTypeId(tt.getId());
                input.setName(tt.getName());
                input.setPrice(tt.getPrice());
                drafts.put(sectionId, input);
            }
            sessionSeatLayoutService.bindTicketTypesAndGenerateSeats(userId, sessionId, drafts);
        } else {
            tt.setTotalStock(Integer.valueOf(body.get("totalStock").toString()));
            tt.setRemainStock(Integer.valueOf(body.get("totalStock").toString()));
            ticketTypeMapper.insert(tt);
        }
        return Result.success(tt);
    }

    @PutMapping("/ticket-types/{id}")
    public Result<TicketType> updateTicketType(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        Long userId = Long.valueOf(body.get("userId").toString());
        String role = checkRole(userId);
        if (role == null) return Result.fail(403, "无权限");

        TicketType tt = ticketTypeMapper.selectById(id);
        if (tt == null) return Result.fail(404, "票档不存在");

        Session session = sessionMapper.selectById(tt.getSessionId());
        if ("organizer".equals(role) && !ownsActivity(session.getActivityId(), userId))
            return Result.fail(403, "只能管理自己主办的票档");

        if (body.containsKey("name")) tt.setName(body.get("name").toString());
        if (body.containsKey("price")) tt.setPrice(new java.math.BigDecimal(body.get("price").toString()));
        if (body.containsKey("totalStock")) {
            int diff = Integer.valueOf(body.get("totalStock").toString()) - tt.getTotalStock();
            tt.setTotalStock(Integer.valueOf(body.get("totalStock").toString()));
            tt.setRemainStock(tt.getRemainStock() + diff);
        }
        if (body.containsKey("status")) tt.setStatus(Integer.valueOf(body.get("status").toString()));
        ticketTypeMapper.updateById(tt);
        return Result.success(tt);
    }

    @DeleteMapping("/ticket-types/{id}")
    public Result<Void> deleteTicketType(@RequestParam Long userId, @PathVariable Long id) {
        String role = checkRole(userId);
        if (role == null) return Result.fail(403, "无权限");

        TicketType tt = ticketTypeMapper.selectById(id);
        if (tt == null) return Result.fail(404, "票档不存在");

        Session session = sessionMapper.selectById(tt.getSessionId());
        if ("organizer".equals(role) && !ownsActivity(session.getActivityId(), userId))
            return Result.fail(403, "只能删除自己主办的票档");

        Set<Long> protectedSeatIds = sessionSeatProtectionService.findProtectedSeatIds(tt.getSessionId());
        List<SessionSeat> ticketSeats = sessionSeatService.listBySession(tt.getSessionId()).stream()
                .filter(seat -> Objects.equals(seat.getTicketTypeId(), id))
                .collect(Collectors.toList());
        boolean hasProtectedSeat = ticketSeats.stream()
                .map(SessionSeat::getId)
                .anyMatch(protectedSeatIds::contains);
        if (hasProtectedSeat) {
            return Result.fail(400, "该票档已有购票订单，请先完成退款后再删除。");
        }
        ticketSeats.forEach(seat -> {
            seat.setTicketTypeId(null);
            sessionSeatService.update(seat);
        });
        ticketTypeMapper.deleteById(id);
        stockRecalculationService.recalculateForSession(tt.getSessionId());
        return Result.success();
    }

    public static class TicketBindingUpdateRequest {
        private Long userId;
        private List<SessionSeatLayoutService.TicketBindingInput> bindings;

        public Long getUserId() { return userId; }
        public void setUserId(Long userId) { this.userId = userId; }
        public List<SessionSeatLayoutService.TicketBindingInput> getBindings() { return bindings; }
        public void setBindings(List<SessionSeatLayoutService.TicketBindingInput> bindings) { this.bindings = bindings; }
    }

    // ========== 场馆管理（admin全权限，organizer只读） ==========

    @PostMapping("/venues")
    public Result<Venue> createVenue(@RequestBody Map<String, Object> body) {
        Long userId = parsePositiveLong(body.get("userId"));
        String role = checkRole(userId);
        if (role == null) return Result.fail(403, "无权限");
        if ("organizer".equals(role)) return Result.fail(403, "仅平台管理员可创建场馆");

        Venue venue = new Venue();
        venue.setName(parseNonBlankString(body.get("name")));
        venue.setCity(body.get("city") != null ? body.get("city").toString() : null);
        venue.setAddress(body.get("address") != null ? body.get("address").toString() : null);
        venue.setCapacity(body.get("capacity") != null ? Integer.valueOf(body.get("capacity").toString()) : null);
        venue.setStatus(1);
        venueMapper.insert(venue);

        if (body.containsKey("layout") && body.get("layout") != null) {
            ObjectMapper objectMapper = new ObjectMapper();
            SeatCraftLayoutDtos.LayoutResponse layout = objectMapper.convertValue(body.get("layout"), SeatCraftLayoutDtos.LayoutResponse.class);
            venueDefaultLayoutService.saveLayout(userId, venue.getId(), layout);
        }

        return Result.success(venue);
    }

    @PutMapping("/venues/{id}")
    public Result<Venue> updateVenue(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        Long userId = Long.valueOf(body.get("userId").toString());
        String role = checkRole(userId);
        if (role == null) return Result.fail(403, "无权限");
        if ("organizer".equals(role)) return Result.fail(403, "仅平台管理员可修改场馆");

        Venue venue = venueMapper.selectById(id);
        if (venue == null) return Result.fail(404, "场馆不存在");
        if (body.containsKey("name")) venue.setName(body.get("name").toString());
        if (body.containsKey("city")) venue.setCity(body.get("city") != null ? body.get("city").toString() : null);
        if (body.containsKey("address")) venue.setAddress(body.get("address") != null ? body.get("address").toString() : null);
        if (body.containsKey("capacity")) venue.setCapacity(body.get("capacity") != null ? Integer.valueOf(body.get("capacity").toString()) : null);
        venueMapper.updateById(venue);
        return Result.success(venue);
    }

    @GetMapping("/venues")
    public Result<List<Venue>> listAdminVenues(@RequestParam Long userId) {
        String role = checkRole(userId);
        if (role == null) return Result.fail(403, "无权限");
        return Result.success(venueMapper.selectList(null));
    }

    @PostMapping("/venues/{id}/areas")
    public Result<SeatTemplateResponse> createVenueArea(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        body.put("venueId", id);
        SeatTemplateResponse response = seatTemplateService.createArea(body);
        response.setSyncResult(sessionSeatService.syncVenueSessions(id));
        return Result.success(response);
    }

    @GetMapping("/venues/{id}/areas")
    public Result<List<VenueArea>> listVenueAreas(@PathVariable Long id, @RequestParam Long userId) {
        return Result.success(seatTemplateService.listAreas(userId, id));
    }

    @GetMapping("/venues/{id}/seats")
    public Result<List<VenueSeat>> listVenueSeats(@PathVariable Long id, @RequestParam Long userId) {
        return Result.success(seatTemplateService.listSeats(userId, id));
    }

    @GetMapping("/venues/{venueId}/default-layout")
    public Result<SeatCraftLayoutDtos.LayoutResponse> getVenueDefaultLayout(@PathVariable Long venueId) {
        SeatCraftLayoutDtos.LayoutResponse layout = venueDefaultLayoutService.getLayout(venueId);
        return Result.success(layout);
    }

    @PutMapping("/venues/{venueId}/default-layout")
    public Result<SeatCraftLayoutDtos.LayoutResponse> updateVenueDefaultLayout(@PathVariable Long venueId,
                                                                                 @RequestBody SeatCraftLayoutDtos.LayoutSaveRequest request) {
        return Result.success(venueDefaultLayoutService.saveLayout(request.getUserId(), venueId, request.getLayout()));
    }

    @GetMapping("/venues/{venueId}/seat-layout-templates")
    public Result<List<SeatLayoutTemplateCandidateResponse>> listVenueSeatLayoutTemplates(@PathVariable Long venueId,
                                                                                           @RequestParam Long userId) {
        return Result.success(venueApplicationService.listSeatLayoutTemplates(userId, venueId));
    }

    @PostMapping("/venues/{id}/seats")
    public Result<SeatTemplateSyncResponse> createVenueSeat(@PathVariable Long id,
                                                            @RequestBody VenueSeatRequest request) {
        if (request == null) {
            return Result.fail(400, "座位参数不能为空");
        }
        request.setVenueId(id);
        seatTemplateService.createSeat(request);
        return Result.success(sessionSeatService.syncVenueSessions(id));
    }

    @PutMapping("/venue-seats/{seatId}")
    public Result<SeatTemplateSyncResponse> updateVenueSeat(@PathVariable Long seatId,
                                                            @RequestBody VenueSeatRequest request) {
        VenueSeat seat = seatTemplateService.updateSeat(seatId, request);
        return Result.success(sessionSeatService.syncVenueSessions(seat.getVenueId()));
    }

    @DeleteMapping("/venue-seats/{seatId}")
    public Result<SeatTemplateSyncResponse> deleteVenueSeat(@PathVariable Long seatId, @RequestParam Long userId) {
        VenueSeat seat = seatTemplateService.deleteSeat(userId, seatId);
        sessionSeatService.disableAvailableSeatsByVenueSeatId(seat.getId());
        return Result.success(sessionSeatService.syncVenueSessions(seat.getVenueId()));
    }

    @PostMapping("/venue-applications")
    public Result<VenueApplicationResponse> submitVenueApplication(@RequestBody VenueApplicationRequest request) {
        return Result.success(VenueApplicationResponse.from(venueApplicationService.submit(request)));
    }

    @GetMapping("/venue-applications/my")
    public Result<List<VenueApplicationResponse>> listMyVenueApplications(@RequestParam Long userId) {
        return Result.success(venueApplicationService.listMine(userId));
    }

    @GetMapping("/venue-applications")
    public Result<List<VenueApplicationResponse>> listVenueApplications(@RequestParam Long userId,
                                                                         @RequestParam(required = false) Integer status) {
        return Result.success(venueApplicationService.listAdmin(userId, status));
    }

    @PostMapping("/venue-applications/{id}/review")
    public Result<VenueApplicationResponse> reviewVenueApplication(@PathVariable Long id,
                                                                   @RequestBody VenueApplicationReviewRequest request) {
        VenueApplication application;
        if ("reject".equals(request.getAction())) {
            application = venueApplicationService.reject(id, request.getUserId(), request.getReviewNote());
        } else {
            application = venueApplicationService.approve(id, request.getUserId(), request.getMode(), request.getVenueId(), request.getReviewNote());
        }
        return Result.success(VenueApplicationResponse.from(application));
    }
}
