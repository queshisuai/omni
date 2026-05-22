package com.omni.ticket.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.omni.exception.BusinessException;
import com.omni.ticket.dto.SeatCraftBlockDtos;
import com.omni.ticket.dto.SeatCraftLayoutDtos;
import com.omni.ticket.entity.Activity;
import com.omni.ticket.entity.ActivitySeatLayout;
import com.omni.ticket.entity.ActivitySeatLayoutSection;
import com.omni.ticket.entity.SeatBlock;
import com.omni.ticket.entity.SeatOverride;
import com.omni.ticket.entity.Session;
import com.omni.ticket.entity.SessionSeat;
import com.omni.ticket.entity.SessionSeatLayout;
import com.omni.ticket.entity.SessionSeatLayoutSection;
import com.omni.ticket.entity.TicketType;
import com.omni.ticket.dto.InternalUserRefResponse;
import com.omni.ticket.entity.VenueArea;
import com.omni.ticket.entity.VenueSeat;
import com.omni.ticket.mapper.ActivityMapper;
import com.omni.ticket.mapper.ActivitySeatLayoutMapper;
import com.omni.ticket.mapper.ActivitySeatLayoutSectionMapper;
import com.omni.ticket.mapper.SeatBlockMapper;
import com.omni.ticket.mapper.SessionMapper;
import com.omni.ticket.mapper.SessionSeatLayoutMapper;
import com.omni.ticket.mapper.SessionSeatLayoutSectionMapper;
import com.omni.ticket.mapper.SessionSeatMapper;
import com.omni.ticket.mapper.TicketTypeMapper;
import com.omni.ticket.mapper.VenueAreaMapper;
import com.omni.ticket.service.UserAccessService;
import com.omni.ticket.mapper.VenueSeatMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class SessionSeatLayoutService {
    private final SessionMapper sessionMapper;
    private final ActivityMapper activityMapper;
    private final UserAccessService userAccessService;
    private final ActivitySeatLayoutMapper activityLayoutMapper;
    private final ActivitySeatLayoutSectionMapper activitySectionMapper;
    private final SessionSeatLayoutMapper sessionLayoutMapper;
    private final SessionSeatLayoutSectionMapper sessionSectionMapper;
    private final SessionSeatMapper sessionSeatMapper;
    private final TicketTypeMapper ticketTypeMapper;
    private final VenueAreaMapper venueAreaMapper;
    private final VenueSeatMapper venueSeatMapper;
    private final SeatCraftBlockLayoutService blockLayoutService;
    private final SessionBlockTicketStockService blockTicketStockService;
    private final SeatBlockMapper seatBlockMapper;
    private final SessionSeatProtectionService sessionSeatProtectionService;
    private final TicketTypeStockRecalculationService stockRecalculationService;
    private final SeatBlockGeometryService geometryService = new SeatBlockGeometryService();

    public SessionSeatLayoutService(SessionMapper sessionMapper,
                                    ActivityMapper activityMapper,
                                    UserAccessService userAccessService,
                                    ActivitySeatLayoutMapper activityLayoutMapper,
                                    ActivitySeatLayoutSectionMapper activitySectionMapper,
                                    SessionSeatLayoutMapper sessionLayoutMapper,
                                    SessionSeatLayoutSectionMapper sessionSectionMapper,
                                     SessionSeatMapper sessionSeatMapper,
                                     TicketTypeMapper ticketTypeMapper,
                                     VenueAreaMapper venueAreaMapper,
                                     VenueSeatMapper venueSeatMapper) {
        this(sessionMapper, activityMapper, userAccessService, activityLayoutMapper, activitySectionMapper,
                sessionLayoutMapper, sessionSectionMapper, sessionSeatMapper, ticketTypeMapper, venueAreaMapper, venueSeatMapper, null);
    }

    public SessionSeatLayoutService(SessionMapper sessionMapper,
                                    ActivityMapper activityMapper,
                                    UserAccessService userAccessService,
                                    ActivitySeatLayoutMapper activityLayoutMapper,
                                    ActivitySeatLayoutSectionMapper activitySectionMapper,
                                    SessionSeatLayoutMapper sessionLayoutMapper,
                                    SessionSeatLayoutSectionMapper sessionSectionMapper,
                                    SessionSeatMapper sessionSeatMapper,
                                    TicketTypeMapper ticketTypeMapper,
                                     VenueAreaMapper venueAreaMapper,
                                     VenueSeatMapper venueSeatMapper,
                                     SeatCraftBlockLayoutService blockLayoutService) {
        this(sessionMapper, activityMapper, userAccessService, activityLayoutMapper, activitySectionMapper,
                sessionLayoutMapper, sessionSectionMapper, sessionSeatMapper, ticketTypeMapper, venueAreaMapper, venueSeatMapper,
                blockLayoutService, null, null, null, null);
    }

    @Autowired
    public SessionSeatLayoutService(SessionMapper sessionMapper,
                                    ActivityMapper activityMapper,
                                    UserAccessService userAccessService,
                                    ActivitySeatLayoutMapper activityLayoutMapper,
                                    ActivitySeatLayoutSectionMapper activitySectionMapper,
                                    SessionSeatLayoutMapper sessionLayoutMapper,
                                    SessionSeatLayoutSectionMapper sessionSectionMapper,
                                    SessionSeatMapper sessionSeatMapper,
                                    TicketTypeMapper ticketTypeMapper,
                                    VenueAreaMapper venueAreaMapper,
                                    VenueSeatMapper venueSeatMapper,
                                    SeatCraftBlockLayoutService blockLayoutService,
                                    SessionBlockTicketStockService blockTicketStockService,
                                    SeatBlockMapper seatBlockMapper,
                                    SessionSeatProtectionService sessionSeatProtectionService,
                                    TicketTypeStockRecalculationService stockRecalculationService) {
        this.sessionMapper = sessionMapper;
        this.activityMapper = activityMapper;
        this.userAccessService = userAccessService;
        this.activityLayoutMapper = activityLayoutMapper;
        this.activitySectionMapper = activitySectionMapper;
        this.sessionLayoutMapper = sessionLayoutMapper;
        this.sessionSectionMapper = sessionSectionMapper;
        this.sessionSeatMapper = sessionSeatMapper;
        this.ticketTypeMapper = ticketTypeMapper;
        this.venueAreaMapper = venueAreaMapper;
        this.venueSeatMapper = venueSeatMapper;
        this.blockLayoutService = blockLayoutService;
        this.blockTicketStockService = blockTicketStockService;
        this.seatBlockMapper = seatBlockMapper;
        this.sessionSeatProtectionService = sessionSeatProtectionService;
        this.stockRecalculationService = stockRecalculationService;
    }

    @Transactional
    public SeatCraftLayoutDtos.LayoutResponse copyFromActivityLayout(Long userId, Long sessionId, Long activityLayoutId) {
        Session session = requireManageableSession(userId, sessionId);
        rejectLegacySnapshot(sessionId);
        ActivitySeatLayout activityLayout = activityLayoutMapper.selectById(activityLayoutId);
        if (activityLayout == null || !Integer.valueOf(1).equals(activityLayout.getStatus())) {
            throw new BusinessException(404, "活动座位图不存在");
        }
        if (!session.getActivityId().equals(activityLayout.getActivityId())) {
            throw new BusinessException(400, "只能复制同一活动的座位图");
        }
        List<ActivitySeatLayoutSection> sourceSections = activitySectionMapper.selectList(new LambdaQueryWrapper<ActivitySeatLayoutSection>()
                .eq(ActivitySeatLayoutSection::getActivityLayoutId, activityLayoutId)
                .eq(ActivitySeatLayoutSection::getStatus, 1)
                .orderByAsc(ActivitySeatLayoutSection::getSort)
                .orderByAsc(ActivitySeatLayoutSection::getId));

        LocalDateTime now = LocalDateTime.now();
        SessionSeatLayout layout = upsertLayout(session.getId(), activityLayout.getId(),
                activityLayout.getName(), activityLayout.getTemplateType(), activityLayout.getStageTitle(), activityLayout.getStageX(),
                activityLayout.getStageY(), activityLayout.getCanvasWidth(), activityLayout.getCanvasHeight(), now);
        disableSections(layout.getId(), now);
        List<SessionSeatLayoutSection> sections = sourceSections.stream()
                .map(section -> copySection(layout.getId(), section, now))
                .collect(Collectors.toList());
        sections.forEach(sessionSectionMapper::insert);
        if (blockLayoutService != null) {
            SeatCraftBlockDtos.LayoutRequest blockLayout = blockLayoutService.getLayout("activity", activityLayout.getActivityId());
            if (blockLayout != null) {
                blockLayoutService.replaceLayout("session", session.getId(), blockLayout);
            }
        }
        return toLayoutResponse(layout, sections);
    }

    public SeatCraftLayoutDtos.LayoutResponse copyFromActivity(Long userId, Long sessionId, Long activityId) {
        ActivitySeatLayout activityLayout = activityLayoutMapper.selectOne(new LambdaQueryWrapper<ActivitySeatLayout>()
                .eq(ActivitySeatLayout::getActivityId, activityId)
                .eq(ActivitySeatLayout::getStatus, 1)
                .orderByDesc(ActivitySeatLayout::getId)
                .last("LIMIT 1"));
        if (activityLayout == null) {
            throw new BusinessException(404, "活动座位图不存在");
        }
        return copyFromActivityLayout(userId, sessionId, activityLayout.getId());
    }

    public SeatCraftLayoutDtos.LayoutResponse getLayout(Long userId, Long sessionId) {
        Session session = requireManageableSession(userId, sessionId);
        SessionSeatLayout layout = findActiveLayout(session.getId());
        if (layout == null) {
            throw new BusinessException(404, "场次座位图不存在");
        }
        return toLayoutResponse(layout, findActiveSections(layout.getId()));
    }

    @Transactional
    public SeatCraftLayoutDtos.LayoutResponse updateLayout(Long userId, Long sessionId, SeatCraftLayoutDtos.LayoutResponse request) {
        Session session = requireManageableSession(userId, sessionId);
        if (request == null) {
            throw new BusinessException(400, "座位图参数不能为空");
        }
        SessionSeatLayout layout = findActiveLayout(session.getId());
        if (layout == null) {
            layout = new SessionSeatLayout();
            layout.setSessionId(session.getId());
            layout.setStatus(1);
            layout.setCreateTime(LocalDateTime.now());
        }

        LocalDateTime now = LocalDateTime.now();
        if (request.getBlockLayout() != null) {
            reconcileRemovedBlocks(session.getId(), request.getBlockLayout(), now);
        }
        layout.setName(requireText(request.getName(), "座位图名称不能为空"));
        layout.setTemplateType(requireText(request.getTemplateType(), "座位图类型不能为空"));
        layout.setStageTitle(requireText(request.getStageTitle(), "舞台名称不能为空"));
        layout.setStageX(requireNumber(request.getStageX(), "舞台X坐标不能为空"));
        layout.setStageY(requireNumber(request.getStageY(), "舞台Y坐标不能为空"));
        layout.setCanvasWidth(requireNumber(request.getCanvasWidth(), "画布宽度不能为空"));
        layout.setCanvasHeight(requireNumber(request.getCanvasHeight(), "画布高度不能为空"));
        layout.setUpdateTime(now);
        if (layout.getId() == null) {
            sessionLayoutMapper.insert(layout);
        } else {
            sessionLayoutMapper.updateById(layout);
        }

        Long layoutId = layout.getId();
        disableSections(layoutId, now);
        List<SessionSeatLayoutSection> sections = (request.getSections() == null ? List.<SeatCraftLayoutDtos.SectionResponse>of() : request.getSections()).stream()
                .map(section -> buildSection(layoutId, section, now))
                .collect(Collectors.toList());
        sections.forEach(sessionSectionMapper::insert);
        if (request.getBlockLayout() != null && blockLayoutService != null) {
            blockLayoutService.replaceLayout("session", sessionId, request.getBlockLayout());
            if (blockTicketStockService != null) {
                blockTicketStockService.generateForSession(sessionId);
            }
        }
        if (stockRecalculationService != null) {
            stockRecalculationService.recalculateForSession(session.getId());
        }
        return toLayoutResponse(layout, sections);
    }

    private void reconcileRemovedBlocks(Long sessionId, SeatCraftBlockDtos.LayoutRequest blockLayout, LocalDateTime now) {
        if (blockLayout == null) {
            return;
        }
        requireSeatProtectionDependencies();
        List<SeatBlock> existingBlocks = seatBlockMapper.selectList(new LambdaQueryWrapper<SeatBlock>()
                .eq(SeatBlock::getOwnerType, "session")
                .eq(SeatBlock::getOwnerId, sessionId)
                .eq(SeatBlock::getStatus, 1));
        if (existingBlocks == null || existingBlocks.isEmpty()) {
            return;
        }
        Map<String, SeatCraftBlockDtos.BlockRequest> incomingBlocks = incomingBlocksByKey(blockLayout);
        Map<String, List<SeatOverride>> incomingOverrides = incomingOverridesByBlockKey(blockLayout);
        Map<Long, Set<String>> validSeatKeysByBlockId = new HashMap<>();
        List<Long> affectedBlockIds = existingBlocks.stream()
                .filter(block -> block.getId() != null)
                .filter(block -> {
                    String blockKey = trim(block.getBlockKey());
                    SeatCraftBlockDtos.BlockRequest incoming = incomingBlocks.get(blockKey);
                    if (incoming == null) {
                        return true;
                    }
                    Set<String> validKeys = generatedSeatKeys(block, incoming, incomingOverrides.getOrDefault(blockKey, Collections.emptyList()));
                    validSeatKeysByBlockId.put(block.getId(), validKeys);
                    return true;
                })
                .map(SeatBlock::getId)
                .collect(Collectors.toList());
        if (affectedBlockIds.isEmpty()) {
            return;
        }
        List<SessionSeat> affectedSeats = sessionSeatMapper.selectList(new LambdaQueryWrapper<SessionSeat>()
                .eq(SessionSeat::getSessionId, sessionId)
                .in(SessionSeat::getSeatBlockId, affectedBlockIds));
        List<SessionSeat> obsoleteSeats = (affectedSeats == null ? Collections.<SessionSeat>emptyList() : affectedSeats).stream()
                .filter(seat -> seat != null && isObsoleteSeat(seat, validSeatKeysByBlockId))
                .collect(Collectors.toList());
        if (obsoleteSeats.isEmpty()) {
            return;
        }
        Set<Long> protectedSeatIds = sessionSeatProtectionService.findProtectedSeatIds(sessionId);
        for (SessionSeat seat : obsoleteSeats) {
            if (seat != null && protectedSeatIds.contains(seat.getId())) {
                throw new BusinessException(400, "该座位区域已有购票订单，请先完成退款后再调整或删除。");
            }
        }
        for (SessionSeat seat : obsoleteSeats) {
            if (seat == null || !Integer.valueOf(1).equals(seat.getStatus())) {
                continue;
            }
            seat.setStatus(4);
            seat.setUpdateTime(now);
            sessionSeatMapper.updateById(seat);
        }
    }

    private void requireSeatProtectionDependencies() {
        if (seatBlockMapper == null || sessionSeatMapper == null || sessionSeatProtectionService == null) {
            throw new BusinessException(503, "无法确认订单座位占用状态，请稍后重试。");
        }
    }

    private Map<String, SeatCraftBlockDtos.BlockRequest> incomingBlocksByKey(SeatCraftBlockDtos.LayoutRequest blockLayout) {
        return (blockLayout.getBlocks() == null ? List.<SeatCraftBlockDtos.BlockRequest>of() : blockLayout.getBlocks()).stream()
                .filter(Objects::nonNull)
                .filter(block -> trim(block.getBlockKey()) != null)
                .collect(Collectors.toMap(block -> trim(block.getBlockKey()), block -> block, (first, second) -> second));
    }

    private Map<String, List<SeatOverride>> incomingOverridesByBlockKey(SeatCraftBlockDtos.LayoutRequest blockLayout) {
        return (blockLayout.getOverrides() == null ? List.<SeatCraftBlockDtos.OverrideRequest>of() : blockLayout.getOverrides()).stream()
                .filter(Objects::nonNull)
                .filter(override -> trim(override.getBlockKey()) != null)
                .map(this::toSeatOverride)
                .collect(Collectors.groupingBy(SeatOverrideWithBlockKey::blockKey,
                        Collectors.mapping(SeatOverrideWithBlockKey::override, Collectors.toList())));
    }

    private SeatOverrideWithBlockKey toSeatOverride(SeatCraftBlockDtos.OverrideRequest request) {
        SeatOverride override = new SeatOverride();
        override.setRowNo(request.getRowNo());
        override.setSeatNo(request.getSeatNo());
        override.setStatus(request.getStatus());
        override.setDx(request.getDx());
        override.setDy(request.getDy());
        override.setCustomLabel(request.getCustomLabel());
        return new SeatOverrideWithBlockKey(trim(request.getBlockKey()), override);
    }

    private SeatBlock projectIncomingBlock(SeatBlock existing, SeatCraftBlockDtos.BlockRequest request) {
        SeatBlock block = new SeatBlock();
        block.setId(existing.getId());
        block.setBlockKey(trim(request.getBlockKey()));
        block.setBlockType(trim(request.getBlockType()));
        block.setTicketGroupKey(trim(request.getTicketGroupKey()));
        block.setX(request.getX());
        block.setY(request.getY());
        block.setRotation(request.getRotation());
        block.setScale(request.getScale());
        block.setRows(request.getRows());
        block.setCols(request.getCols());
        block.setSeatsPerRow(request.getSeatsPerRow());
        block.setRowSpacing(request.getRowSpacing());
        block.setSeatSpacing(request.getSeatSpacing());
        block.setInnerRadius(request.getInnerRadius());
        block.setArcStartAngle(request.getArcStartAngle());
        block.setArcEndAngle(request.getArcEndAngle());
        block.setCapacity(request.getCapacity());
        return block;
    }

    private Set<String> generatedSeatKeys(SeatBlock existing, SeatCraftBlockDtos.BlockRequest incoming, List<SeatOverride> overrides) {
        SeatBlock projected = projectIncomingBlock(existing, incoming);
        return geometryService.generateSeats(projected, overrides).stream()
                .map(seat -> generatedCoordinateKey(seat.getRowNo(), seat.getSeatNo()))
                .collect(Collectors.toSet());
    }

    private boolean isObsoleteSeat(SessionSeat seat, Map<Long, Set<String>> validSeatKeysByBlockId) {
        Set<String> validKeys = validSeatKeysByBlockId.get(seat.getSeatBlockId());
        if (validKeys == null) {
            return true;
        }
        return !validKeys.contains(sessionSeatCoordinateKey(seat));
    }

    private String sessionSeatCoordinateKey(SessionSeat seat) {
        Integer rowNo = seat.getGeneratedRowNo() != null ? seat.getGeneratedRowNo() : seat.getRowNo();
        Integer seatNo = seat.getGeneratedSeatNo() != null ? seat.getGeneratedSeatNo() : seat.getSeatNo();
        return generatedCoordinateKey(rowNo, seatNo);
    }

    private String generatedCoordinateKey(Integer rowNo, Integer seatNo) {
        if (rowNo == null || seatNo == null) {
            return null;
        }
        return rowNo + ":" + seatNo;
    }

    private String trim(String value) {
        if (value == null) {
            return null;
        }
        String text = value.trim();
        return text.isEmpty() ? null : text;
    }

    private static class SeatOverrideWithBlockKey {
        private final String blockKey;
        private final SeatOverride override;

        private SeatOverrideWithBlockKey(String blockKey, SeatOverride override) {
            this.blockKey = blockKey;
            this.override = override;
        }

        private String blockKey() {
            return blockKey;
        }

        private SeatOverride override() {
            return override;
        }
    }

    public boolean hasLayout(Long sessionId) {
        return findActiveLayout(sessionId) != null;
    }

    @Transactional
    public void updateTicketBindings(Long userId, Long sessionId, List<TicketBindingInput> bindings) {
        Session session = requireManageableSession(userId, sessionId);
        if (bindings == null || bindings.isEmpty()) {
            stockRecalculationService.recalculateForSession(session.getId());
            return;
        }
        Map<String, Long> targetTicketTypeByBlockKey = new java.util.LinkedHashMap<>();
        for (TicketBindingInput binding : bindings) {
            if (binding == null || binding.getTicketTypeId() == null) {
                continue;
            }
            TicketType ticketType = ticketTypeMapper.selectById(binding.getTicketTypeId());
            if (ticketType == null) {
                throw new BusinessException(404, "票档不存在");
            }
            if (!Objects.equals(ticketType.getSessionId(), session.getId())) {
                throw new BusinessException(400, "票档不属于当前场次");
            }
            List<String> blockKeys = normalizeBlockKeys(binding.getBlockKeys());
            for (String blockKey : blockKeys) {
                Long existingTicketTypeId = targetTicketTypeByBlockKey.putIfAbsent(blockKey, binding.getTicketTypeId());
                if (existingTicketTypeId != null && !Objects.equals(existingTicketTypeId, binding.getTicketTypeId())) {
                    throw new BusinessException(400, "同一座位区域不能绑定多个票档");
                }
            }
        }
        Set<Long> protectedSeatIds = sessionSeatProtectionService.findProtectedSeatIds(session.getId());
        LocalDateTime now = LocalDateTime.now();
        for (TicketBindingInput binding : bindings) {
            if (binding == null || binding.getTicketTypeId() == null || binding.getBlockKeys() == null || binding.getBlockKeys().isEmpty()) {
                continue;
            }
            List<String> blockKeys = normalizeBlockKeys(binding.getBlockKeys());
            if (blockKeys.isEmpty()) {
                continue;
            }
            List<SeatBlock> blocks = seatBlockMapper.selectList(new LambdaQueryWrapper<SeatBlock>()
                    .eq(SeatBlock::getOwnerType, "session")
                    .eq(SeatBlock::getOwnerId, session.getId())
                    .in(SeatBlock::getBlockKey, blockKeys)
                    .eq(SeatBlock::getStatus, 1));
            List<Long> blockIds = blocks.stream()
                    .map(SeatBlock::getId)
                    .filter(Objects::nonNull)
                    .collect(Collectors.toList());
            if (blockIds.isEmpty()) {
                continue;
            }
            List<SessionSeat> seats = sessionSeatMapper.selectList(new LambdaQueryWrapper<SessionSeat>()
                    .eq(SessionSeat::getSessionId, session.getId())
                    .in(SessionSeat::getSeatBlockId, blockIds));
            for (SessionSeat seat : seats) {
                if (seat == null || Objects.equals(seat.getTicketTypeId(), binding.getTicketTypeId())) {
                    continue;
                }
                if (protectedSeatIds.contains(seat.getId())) {
                    throw new BusinessException(400, "该座位区域已有购票订单，请先完成退款后再调整或删除。");
                }
                seat.setTicketTypeId(binding.getTicketTypeId());
                seat.setUpdateTime(now);
                sessionSeatMapper.updateById(seat);
            }
        }
        stockRecalculationService.recalculateForSession(session.getId());
    }

    private List<String> normalizeBlockKeys(List<String> blockKeys) {
        if (blockKeys == null) {
            return List.of();
        }
        return blockKeys.stream()
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(key -> !key.isEmpty())
                .distinct()
                .collect(Collectors.toList());
    }

    public List<SeatCraftLayoutDtos.SectionResponse> buildTicketDrafts(Long sessionLayoutId) {
        return findActiveSections(sessionLayoutId).stream()
                .map(this::toSectionResponse)
                .collect(Collectors.toList());
    }

    public List<SeatCraftLayoutDtos.SectionResponse> buildTicketDraftsForSession(Long userId, Long sessionId) {
        Session session = requireManageableSession(userId, sessionId);
        SessionSeatLayout layout = findActiveLayout(session.getId());
        if (layout == null) {
            throw new BusinessException(404, "场次座位图不存在");
        }
        return buildTicketDrafts(layout.getId());
    }

    @Transactional
    public int bindTicketTypesAndGenerateSeats(Long userId, Long sessionId, Map<Long, TicketDraftInput> drafts) {
        Session session = requireManageableSession(userId, sessionId);
        SessionSeatLayout layout = findActiveLayout(session.getId());
        if (layout == null) {
            throw new BusinessException(404, "场次座位图不存在");
        }
        if (drafts != null) {
            LocalDateTime now = LocalDateTime.now();
            drafts.forEach((sectionId, draft) -> {
                if (draft == null || draft.getTicketTypeId() == null) {
                    throw new BusinessException(400, "票档ID不能为空");
                }
                SessionSeatLayoutSection section = sessionSectionMapper.selectById(sectionId);
                if (section == null || !Integer.valueOf(1).equals(section.getStatus())) {
                    throw new BusinessException(404, "场次座位图分区不存在");
                }
                if (!layout.getId().equals(section.getSessionLayoutId())) {
                    throw new BusinessException(400, "票档草稿分区不属于当前场次座位图");
                }
                TicketType ticketType = ticketTypeMapper.selectById(draft.getTicketTypeId());
                if (ticketType == null) {
                    throw new BusinessException(404, "票档不存在");
                }
                if (!sessionId.equals(ticketType.getSessionId())) {
                    throw new BusinessException(400, "票档不属于当前场次");
                }
                if (section.getTicketTypeId() != null && !section.getTicketTypeId().equals(draft.getTicketTypeId())) {
                    throw new BusinessException(400, "分区已绑定其他票档");
                }
                section.setTicketTypeId(draft.getTicketTypeId());
                section.setUpdateTime(now);
                sessionSectionMapper.updateById(section);
                sessionSeatMapper.updateTicketTypeByLayoutSection(sessionId, sectionId, draft.getTicketTypeId());
            });
        }
        return generateSessionSeats(sessionId);
    }

    @Transactional
    public int generateSessionSeats(Long sessionId) {
        Session session = sessionMapper.selectById(sessionId);
        if (session == null) {
            throw new BusinessException(404, "场次不存在");
        }
        Long existingCount = sessionSeatMapper.selectCount(new LambdaQueryWrapper<SessionSeat>()
                .eq(SessionSeat::getSessionId, sessionId));
        if (existingCount != null && existingCount > 0) {
            SessionSeatLayout layout = findActiveLayout(sessionId);
            if (layout != null && hasLegacySessionSeat(sessionId)) {
                throw new BusinessException(400, "场次已有旧版座位快照，不能直接生成SeatCraft座位");
            }
            return 0;
        }
        SessionSeatLayout layout = findActiveLayout(sessionId);
        if (layout == null) {
            throw new BusinessException(404, "场次座位图不存在");
        }
        if (blockLayoutService != null && blockTicketStockService != null
                && blockLayoutService.getLayout("session", sessionId) != null) {
            return blockTicketStockService.generateForSession(sessionId);
        }
        List<SessionSeatLayoutSection> sections = findActiveSections(layout.getId());
        LocalDateTime now = LocalDateTime.now();
        int generated = 0;
        for (SessionSeatLayoutSection section : sections) {
            VenueArea area = createCompatibleArea(session.getVenueId(), section, now);
            for (int row = 1; row <= section.getRows(); row++) {
                for (int col = 1; col <= section.getCols(); col++) {
                    VenueSeat venueSeat = createCompatibleVenueSeat(session.getVenueId(), area.getId(), row, col, now);
                    SessionSeat sessionSeat = new SessionSeat();
                    sessionSeat.setSessionId(sessionId);
                    sessionSeat.setVenueId(session.getVenueId());
                    sessionSeat.setAreaId(area.getId());
                    sessionSeat.setVenueSeatId(venueSeat.getId());
                    sessionSeat.setRowNo(row);
                    sessionSeat.setSeatNo(col);
                    sessionSeat.setSeatLabel(seatLabel(row, col));
                    sessionSeat.setStatus(1);
                    sessionSeat.setTicketTypeId(section.getTicketTypeId());
                    sessionSeat.setLayoutSectionId(section.getId());
                    sessionSeat.setCreateTime(now);
                    sessionSeat.setUpdateTime(now);
                    sessionSeatMapper.insert(sessionSeat);
                    generated++;
                }
            }
        }
        return generated;
    }

    private VenueArea createCompatibleArea(Long venueId, SessionSeatLayoutSection section, LocalDateTime now) {
        VenueArea area = new VenueArea();
        area.setVenueId(venueId);
        area.setName(section.getName());
        area.setRowCount(section.getRows());
        area.setSeatsPerRow(section.getCols());
        area.setRowStart(1);
        area.setSeatStart(1);
        area.setColor(section.getColor());
        area.setSort(section.getSort());
        area.setStatus(0);
        area.setCreateTime(now);
        area.setUpdateTime(now);
        venueAreaMapper.insert(area);
        return area;
    }

    private VenueSeat createCompatibleVenueSeat(Long venueId, Long areaId, Integer row, Integer col, LocalDateTime now) {
        VenueSeat venueSeat = new VenueSeat();
        venueSeat.setVenueId(venueId);
        venueSeat.setAreaId(areaId);
        venueSeat.setRowNo(row);
        venueSeat.setSeatNo(col);
        venueSeat.setSeatLabel(seatLabel(row, col));
        venueSeat.setStatus(0);
        venueSeat.setCreateTime(now);
        venueSeatMapper.insert(venueSeat);
        return venueSeat;
    }

    private SessionSeatLayout upsertLayout(Long sessionId, Long activityLayoutId, String name, String templateType,
                                           String stageTitle, Integer stageX, Integer stageY, Integer canvasWidth, Integer canvasHeight,
                                           LocalDateTime now) {
        List<SessionSeatLayout> activeLayouts = sessionLayoutMapper.selectList(new LambdaQueryWrapper<SessionSeatLayout>()
                .eq(SessionSeatLayout::getSessionId, sessionId)
                .eq(SessionSeatLayout::getStatus, 1)
                .orderByDesc(SessionSeatLayout::getId));
        SessionSeatLayout layout = activeLayouts.isEmpty() ? null : activeLayouts.get(0);
        boolean creating = layout == null;
        if (creating) {
            layout = new SessionSeatLayout();
            layout.setSessionId(sessionId);
            layout.setCreateTime(now);
        }
        layout.setActivityLayoutId(activityLayoutId);
        layout.setName(name);
        layout.setTemplateType(templateType);
        layout.setStageTitle(stageTitle);
        layout.setStageX(stageX);
        layout.setStageY(stageY);
        layout.setCanvasWidth(canvasWidth);
        layout.setCanvasHeight(canvasHeight);
        layout.setStatus(1);
        layout.setUpdateTime(now);
        if (creating) {
            sessionLayoutMapper.insert(layout);
        } else {
            sessionLayoutMapper.updateById(layout);
        }
        Long currentLayoutId = layout.getId();
        activeLayouts.stream()
                .filter(active -> !active.getId().equals(currentLayoutId))
                .forEach(active -> {
                    active.setStatus(0);
                    active.setUpdateTime(now);
                    sessionLayoutMapper.updateById(active);
                });
        return layout;
    }

    private boolean hasLegacySessionSeat(Long sessionId) {
        List<SessionSeat> seats = sessionSeatMapper.selectList(new LambdaQueryWrapper<SessionSeat>()
                .eq(SessionSeat::getSessionId, sessionId));
        return seats.stream().anyMatch(seat -> seat.getLayoutSectionId() == null);
    }

    private void rejectLegacySnapshot(Long sessionId) {
        Long existingCount = sessionSeatMapper.selectCount(new LambdaQueryWrapper<SessionSeat>()
                .eq(SessionSeat::getSessionId, sessionId));
        if (existingCount != null && existingCount > 0 && hasLegacySessionSeat(sessionId)) {
            throw new BusinessException(400, "场次已有旧版座位快照，不能直接复制SeatCraft座位图");
        }
    }

    private void disableSections(Long sessionLayoutId, LocalDateTime now) {
        List<SessionSeatLayoutSection> sections = sessionSectionMapper.selectList(new LambdaQueryWrapper<SessionSeatLayoutSection>()
                .eq(SessionSeatLayoutSection::getSessionLayoutId, sessionLayoutId)
                .eq(SessionSeatLayoutSection::getStatus, 1));
        sections.forEach(section -> {
            section.setStatus(0);
            section.setUpdateTime(now);
            sessionSectionMapper.updateById(section);
        });
    }

    private SessionSeatLayoutSection copySection(Long sessionLayoutId, ActivitySeatLayoutSection source, LocalDateTime now) {
        SessionSeatLayoutSection section = new SessionSeatLayoutSection();
        section.setSessionLayoutId(sessionLayoutId);
        section.setActivityLayoutSectionId(source.getId());
        section.setSourceTemplateSectionId(source.getSourceTemplateSectionId());
        copyCommonSectionFields(section, source.getSectionKey(), source.getName(), source.getRows(), source.getCols(), source.getX(),
                source.getY(), source.getColor(), source.getType(), source.getLayout(), source.getRadius(), source.getArcSpan(),
                source.getRotation(), source.getPrimeRowStart(), source.getPrimeRowEnd(), source.getPrimeColStart(),
                source.getPrimeColEnd(), source.getSort(), now);
        return section;
    }

    private SessionSeatLayoutSection buildSection(Long sessionLayoutId, SeatCraftLayoutDtos.SectionResponse request, LocalDateTime now) {
        if (request == null) {
            throw new BusinessException(400, "座位图分区不能为空");
        }
        SessionSeatLayoutSection section = new SessionSeatLayoutSection();
        section.setSessionLayoutId(sessionLayoutId);
        section.setActivityLayoutSectionId(null);
        section.setSourceTemplateSectionId(null);
        section.setTicketTypeId(request.getTicketTypeId());
        copyCommonSectionFields(section,
                requireText(request.getSectionKey(), "分区标识不能为空"),
                requireText(request.getName(), "分区名称不能为空"),
                requirePositive(request.getRows(), "分区排数不正确"),
                requirePositive(request.getCols(), "分区座数不正确"),
                requireNumber(request.getX(), "分区X坐标不能为空"),
                requireNumber(request.getY(), "分区Y坐标不能为空"),
                requireText(request.getColor(), "分区颜色不能为空"),
                requireText(request.getType(), "分区类型不能为空"),
                requireText(request.getLayout(), "分区布局不能为空"),
                request.getRadius(), request.getArcSpan(), request.getRotation(), request.getPrimeRowStart(),
                request.getPrimeRowEnd(), request.getPrimeColStart(), request.getPrimeColEnd(),
                request.getSort() == null ? 0 : request.getSort(), now);
        return section;
    }

    private void copyCommonSectionFields(SessionSeatLayoutSection section, String sectionKey, String name, Integer rows, Integer cols,
                                         Integer x, Integer y, String color, String type, String layout, Integer radius,
                                         Integer arcSpan, Integer rotation, Integer primeRowStart, Integer primeRowEnd,
                                         Integer primeColStart, Integer primeColEnd, Integer sort, LocalDateTime now) {
        section.setSectionKey(sectionKey);
        section.setName(name);
        section.setRows(rows);
        section.setCols(cols);
        section.setX(x);
        section.setY(y);
        section.setColor(color);
        section.setType(type);
        section.setLayout(layout);
        section.setRadius(radius);
        section.setArcSpan(arcSpan);
        section.setRotation(rotation);
        section.setPrimeRowStart(primeRowStart);
        section.setPrimeRowEnd(primeRowEnd);
        section.setPrimeColStart(primeColStart);
        section.setPrimeColEnd(primeColEnd);
        section.setSeatCount(rows * cols);
        section.setSort(sort);
        section.setStatus(1);
        section.setCreateTime(now);
        section.setUpdateTime(now);
    }

    private SessionSeatLayout findActiveLayout(Long sessionId) {
        return sessionLayoutMapper.selectOne(new LambdaQueryWrapper<SessionSeatLayout>()
                .eq(SessionSeatLayout::getSessionId, sessionId)
                .eq(SessionSeatLayout::getStatus, 1)
                .orderByDesc(SessionSeatLayout::getId)
                .last("LIMIT 1"));
    }

    private List<SessionSeatLayoutSection> findActiveSections(Long sessionLayoutId) {
        return sessionSectionMapper.selectList(new LambdaQueryWrapper<SessionSeatLayoutSection>()
                .eq(SessionSeatLayoutSection::getSessionLayoutId, sessionLayoutId)
                .eq(SessionSeatLayoutSection::getStatus, 1)
                .orderByAsc(SessionSeatLayoutSection::getSort)
                .orderByAsc(SessionSeatLayoutSection::getId));
    }

    private SeatCraftLayoutDtos.LayoutResponse toLayoutResponse(SessionSeatLayout layout, List<SessionSeatLayoutSection> sections) {
        SeatCraftLayoutDtos.LayoutResponse response = new SeatCraftLayoutDtos.LayoutResponse();
        response.setId(layout.getId());
        response.setSessionId(layout.getSessionId());
        response.setName(layout.getName());
        response.setTemplateType(layout.getTemplateType());
        response.setStageTitle(layout.getStageTitle());
        response.setStageX(layout.getStageX());
        response.setStageY(layout.getStageY());
        response.setCanvasWidth(layout.getCanvasWidth());
        response.setCanvasHeight(layout.getCanvasHeight());
        response.setSections(sections.stream().map(this::toSectionResponse).collect(Collectors.toList()));
        if (blockLayoutService != null) {
            response.setBlockLayout(blockLayoutService.getLayout("session", layout.getSessionId()));
        }
        return response;
    }

    private SeatCraftLayoutDtos.SectionResponse toSectionResponse(SessionSeatLayoutSection section) {
        SeatCraftLayoutDtos.SectionResponse response = new SeatCraftLayoutDtos.SectionResponse();
        response.setId(section.getId());
        response.setSectionKey(section.getSectionKey());
        response.setName(section.getName());
        response.setRows(section.getRows());
        response.setCols(section.getCols());
        response.setX(section.getX());
        response.setY(section.getY());
        response.setColor(section.getColor());
        response.setType(section.getType());
        response.setLayout(section.getLayout());
        response.setRadius(section.getRadius());
        response.setArcSpan(section.getArcSpan());
        response.setRotation(section.getRotation());
        response.setPrimeRowStart(section.getPrimeRowStart());
        response.setPrimeRowEnd(section.getPrimeRowEnd());
        response.setPrimeColStart(section.getPrimeColStart());
        response.setPrimeColEnd(section.getPrimeColEnd());
        response.setSeatCount(section.getRows() * section.getCols());
        response.setTicketTypeId(section.getTicketTypeId());
        return response;
    }

    private String requireText(String value, String message) {
        if (value == null || value.trim().isEmpty()) {
            throw new BusinessException(400, message);
        }
        return value.trim();
    }

    private Integer requireNumber(Integer value, String message) {
        if (value == null) {
            throw new BusinessException(400, message);
        }
        return value;
    }

    private Integer requirePositive(Integer value, String message) {
        if (value == null || value <= 0) {
            throw new BusinessException(400, message);
        }
        return value;
    }

    private Session requireManageableSession(Long userId, Long sessionId) {
        InternalUserRefResponse user = userAccessService.requireAdminOrOrganizer(userId);
        String role = user.getRole();
        Session session = sessionMapper.selectById(sessionId);
        if (session == null) {
            throw new BusinessException(404, "场次不存在");
        }
        Activity activity = activityMapper.selectById(session.getActivityId());
        if (activity == null) {
            throw new BusinessException(404, "活动不存在");
        }
        if ("organizer".equals(role) && !userId.equals(activity.getOrganizerId())) {
            throw new BusinessException(403, "只能操作自己主办的场次");
        }
        return session;
    }

    private String seatLabel(Integer row, Integer col) {
        return row + "排" + col + "座";
    }

    public int countAvailableSeatsForSections(Long sessionId, List<Long> sectionIds) {
        if (sectionIds == null || sectionIds.isEmpty()) {
            return 0;
        }
        return sectionIds.stream()
                .map(sectionId -> sessionSeatMapper.countAvailableByLayoutSection(sessionId, sectionId))
                .filter(count -> count != null)
                .mapToInt(Long::intValue)
                .sum();
    }

    public static class TicketDraftInput {
        private Long ticketTypeId;
        private String name;
        private BigDecimal price;

        public Long getTicketTypeId() { return ticketTypeId; }
        public void setTicketTypeId(Long ticketTypeId) { this.ticketTypeId = ticketTypeId; }
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public BigDecimal getPrice() { return price; }
        public void setPrice(BigDecimal price) { this.price = price; }
    }

    public static class TicketBindingInput {
        private Long ticketTypeId;
        private List<String> blockKeys;

        public Long getTicketTypeId() { return ticketTypeId; }
        public void setTicketTypeId(Long ticketTypeId) { this.ticketTypeId = ticketTypeId; }
        public List<String> getBlockKeys() { return blockKeys; }
        public void setBlockKeys(List<String> blockKeys) { this.blockKeys = blockKeys; }
    }
}
