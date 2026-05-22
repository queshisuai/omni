package com.omni.ticket.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.omni.common.result.Result;
import com.omni.exception.BusinessException;
import com.omni.ticket.dto.SeatCraftLayoutDtos;
import com.omni.ticket.dto.SeatMapResponse;
import com.omni.ticket.entity.Activity;
import com.omni.ticket.entity.Session;
import com.omni.ticket.entity.SessionSeat;
import com.omni.ticket.entity.SessionSeatLayout;
import com.omni.ticket.entity.SessionSeatLayoutSection;
import com.omni.ticket.entity.TicketType;
import com.omni.ticket.entity.TicketTypeArea;
import com.omni.ticket.entity.VenueArea;
import com.omni.ticket.mapper.ActivityMapper;
import com.omni.ticket.mapper.SessionMapper;
import com.omni.ticket.mapper.SessionSeatLayoutMapper;
import com.omni.ticket.mapper.SessionSeatLayoutSectionMapper;
import com.omni.ticket.mapper.SessionSeatMapper;
import com.omni.ticket.mapper.TicketTypeAreaMapper;
import com.omni.ticket.mapper.TicketTypeMapper;
import com.omni.ticket.mapper.VenueAreaMapper;
import com.omni.ticket.service.SeatCraftBlockLayoutService;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/ticket")
public class SeatController {
    private final ActivityMapper activityMapper;
    private final SessionMapper sessionMapper;
    private final TicketTypeMapper ticketTypeMapper;
    private final TicketTypeAreaMapper ticketTypeAreaMapper;
    private final VenueAreaMapper venueAreaMapper;
    private final SessionSeatMapper sessionSeatMapper;
    private final SessionSeatLayoutMapper sessionSeatLayoutMapper;
    private final SessionSeatLayoutSectionMapper sessionSeatLayoutSectionMapper;
    private final SeatCraftBlockLayoutService seatCraftBlockLayoutService;

    public SeatController(ActivityMapper activityMapper,
                           SessionMapper sessionMapper,
                           TicketTypeMapper ticketTypeMapper,
                           TicketTypeAreaMapper ticketTypeAreaMapper,
                            VenueAreaMapper venueAreaMapper,
                            SessionSeatMapper sessionSeatMapper,
                            SessionSeatLayoutMapper sessionSeatLayoutMapper,
                            SessionSeatLayoutSectionMapper sessionSeatLayoutSectionMapper,
                            SeatCraftBlockLayoutService seatCraftBlockLayoutService) {
        this.activityMapper = activityMapper;
        this.sessionMapper = sessionMapper;
        this.ticketTypeMapper = ticketTypeMapper;
        this.ticketTypeAreaMapper = ticketTypeAreaMapper;
        this.venueAreaMapper = venueAreaMapper;
        this.sessionSeatMapper = sessionSeatMapper;
        this.sessionSeatLayoutMapper = sessionSeatLayoutMapper;
        this.sessionSeatLayoutSectionMapper = sessionSeatLayoutSectionMapper;
        this.seatCraftBlockLayoutService = seatCraftBlockLayoutService;
    }

    @GetMapping("/sessions/{sessionId}/ticket-types/{ticketTypeId}/seats")
    public Result<SeatMapResponse> getSeatMap(@PathVariable Long sessionId, @PathVariable Long ticketTypeId) {
        TicketType ticketType = ticketTypeMapper.selectById(ticketTypeId);
        if (ticketType == null || !sessionId.equals(ticketType.getSessionId())) {
            throw new BusinessException(404, "票档不存在");
        }
        if (isSeatMapHidden(sessionId)) {
            return Result.success(SeatMapResponse.of(sessionId, ticketType, Collections.emptyList(), Collections.emptyList()));
        }
        SessionSeatLayout layout = findActiveLayout(sessionId);
        if (layout != null) {
            return Result.success(buildSeatCraftSeatMap(sessionId, ticketType, layout));
        }
        List<TicketTypeArea> relations = ticketTypeAreaMapper.selectList(new LambdaQueryWrapper<TicketTypeArea>()
                .eq(TicketTypeArea::getSessionId, sessionId)
                .eq(TicketTypeArea::getTicketTypeId, ticketTypeId));
        List<Long> areaIds = relations.stream().map(TicketTypeArea::getAreaId).collect(Collectors.toList());
        if (areaIds.isEmpty()) {
            return Result.success(SeatMapResponse.of(sessionId, ticketType, Collections.emptyList(), Collections.emptyList()));
        }
        List<VenueArea> areas = venueAreaMapper.selectBatchIds(areaIds);
        List<SessionSeat> seats = sessionSeatMapper.selectList(new LambdaQueryWrapper<SessionSeat>()
                .eq(SessionSeat::getSessionId, sessionId)
                .in(SessionSeat::getAreaId, areaIds)
                .orderByAsc(SessionSeat::getAreaId)
                .orderByAsc(SessionSeat::getRowNo)
                .orderByAsc(SessionSeat::getSeatNo));
        return Result.success(SeatMapResponse.of(sessionId, ticketType, areas, seats));
    }

    private boolean isSeatMapHidden(Long sessionId) {
        Session session = sessionMapper.selectById(sessionId);
        if (session == null || session.getActivityId() == null) {
            return false;
        }
        Activity activity = activityMapper.selectById(session.getActivityId());
        return activity != null && "hidden".equals(activity.getSeatMapVisibility());
    }

    private SeatMapResponse buildSeatCraftSeatMap(Long sessionId, TicketType ticketType, SessionSeatLayout layout) {
        List<SessionSeatLayoutSection> sections = sessionSeatLayoutSectionMapper.selectList(new LambdaQueryWrapper<SessionSeatLayoutSection>()
                .eq(SessionSeatLayoutSection::getSessionLayoutId, layout.getId())
                .eq(SessionSeatLayoutSection::getStatus, 1)
                .orderByAsc(SessionSeatLayoutSection::getSort)
                .orderByAsc(SessionSeatLayoutSection::getId));
        if (sections == null) {
            sections = Collections.emptyList();
        }
        List<Long> sectionIds = sections.stream()
                .filter(section -> ticketType.getId().equals(section.getTicketTypeId()))
                .map(SessionSeatLayoutSection::getId)
                .collect(Collectors.toList());

        List<SessionSeat> seats = sectionIds.isEmpty()
                ? Collections.emptyList()
                : sessionSeatMapper.selectList(new LambdaQueryWrapper<SessionSeat>()
                .eq(SessionSeat::getSessionId, sessionId)
                .in(SessionSeat::getLayoutSectionId, sectionIds)
                .orderByAsc(SessionSeat::getLayoutSectionId)
                .orderByAsc(SessionSeat::getRowNo)
                .orderByAsc(SessionSeat::getSeatNo));

        SeatCraftLayoutDtos.LayoutResponse layoutResponse = toLayoutResponse(layout, sections);
        if (seatCraftBlockLayoutService != null) {
            layoutResponse.setBlockLayout(seatCraftBlockLayoutService.getLayout("session", sessionId));
        }
        if (layoutResponse.getBlockLayout() != null && layoutResponse.getBlockLayout().getBlocks() != null
                && !layoutResponse.getBlockLayout().getBlocks().isEmpty()) {
            seats = sessionSeatMapper.selectList(new LambdaQueryWrapper<SessionSeat>()
                    .eq(SessionSeat::getSessionId, sessionId)
                    .eq(SessionSeat::getTicketTypeId, ticketType.getId())
                    .isNotNull(SessionSeat::getSeatBlockId)
                    .orderByAsc(SessionSeat::getSeatBlockId)
                    .orderByAsc(SessionSeat::getGeneratedRowNo)
                    .orderByAsc(SessionSeat::getGeneratedSeatNo));
        }
        SeatMapResponse response = SeatMapResponse.of(sessionId, ticketType, Collections.emptyList(), seats);
        response.setLayout(layoutResponse);
        return response;
    }

    private SessionSeatLayout findActiveLayout(Long sessionId) {
        return sessionSeatLayoutMapper.selectOne(new LambdaQueryWrapper<SessionSeatLayout>()
                .eq(SessionSeatLayout::getSessionId, sessionId)
                .eq(SessionSeatLayout::getStatus, 1)
                .orderByDesc(SessionSeatLayout::getId)
                .last("LIMIT 1"));
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
        response.setSections(sections == null
                ? Collections.emptyList()
                : sections.stream().map(this::toSectionResponse).collect(Collectors.toList()));
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
        if (section.getRows() != null && section.getCols() != null) {
            response.setSeatCount(section.getRows() * section.getCols());
        }
        response.setTicketTypeId(section.getTicketTypeId());
        return response;
    }
}
