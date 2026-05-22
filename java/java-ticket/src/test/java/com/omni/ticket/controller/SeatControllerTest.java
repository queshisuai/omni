package com.omni.ticket.controller;

import com.omni.common.result.Result;
import com.omni.ticket.dto.SeatMapResponse;
import com.omni.ticket.entity.Activity;
import com.omni.ticket.entity.SeatBlock;
import com.omni.ticket.entity.Session;
import com.omni.ticket.entity.SessionSeat;
import com.omni.ticket.entity.SessionSeatLayout;
import com.omni.ticket.entity.SessionSeatLayoutSection;
import com.omni.ticket.entity.TicketType;
import com.omni.ticket.entity.TicketTypeArea;
import com.omni.ticket.entity.VenueArea;
import com.omni.ticket.mapper.ActivityMapper;
import com.omni.ticket.mapper.SessionSeatLayoutMapper;
import com.omni.ticket.mapper.SessionSeatLayoutSectionMapper;
import com.omni.ticket.mapper.SessionSeatMapper;
import com.omni.ticket.mapper.SessionMapper;
import com.omni.ticket.mapper.TicketTypeAreaMapper;
import com.omni.ticket.mapper.TicketTypeMapper;
import com.omni.ticket.mapper.VenueAreaMapper;
import com.omni.ticket.service.SeatCraftBlockLayoutService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SeatControllerTest {

    @Mock
    private ActivityMapper activityMapper;
    @Mock
    private SessionMapper sessionMapper;
    @Mock
    private TicketTypeMapper ticketTypeMapper;
    @Mock
    private TicketTypeAreaMapper ticketTypeAreaMapper;
    @Mock
    private VenueAreaMapper venueAreaMapper;
    @Mock
    private SessionSeatMapper sessionSeatMapper;
    @Mock
    private SessionSeatLayoutMapper sessionSeatLayoutMapper;
    @Mock
    private SessionSeatLayoutSectionMapper sessionSeatLayoutSectionMapper;
    @Mock
    private SeatCraftBlockLayoutService seatCraftBlockLayoutService;

    @Test
    void getSeatMapUsesLegacyAreaMappingWhenNoSeatCraftLayout() {
        SeatController controller = controller();
        TicketType ticketType = ticketType(7L, 99L);
        TicketTypeArea relation = new TicketTypeArea();
        relation.setAreaId(3L);
        VenueArea area = new VenueArea();
        area.setId(3L);
        SessionSeat seat = new SessionSeat();
        seat.setId(101L);

        when(ticketTypeMapper.selectById(7L)).thenReturn(ticketType);
        when(sessionSeatLayoutMapper.selectOne(any())).thenReturn(null);
        when(ticketTypeAreaMapper.selectList(any())).thenReturn(List.of(relation));
        when(venueAreaMapper.selectBatchIds(List.of(3L))).thenReturn(List.of(area));
        when(sessionSeatMapper.selectList(any())).thenReturn(List.of(seat));

        Result<SeatMapResponse> result = controller.getSeatMap(99L, 7L);

        assertEquals(200, result.getCode());
        assertNull(result.getData().getLayout());
        assertEquals(List.of(area), result.getData().getAreas());
        assertEquals(List.of(seat), result.getData().getSeats());
    }

    @Test
    void getSeatMapIncludesSeatCraftLayoutAndFiltersByLayoutSectionTicketType() {
        SeatController controller = controller();
        TicketType ticketType = ticketType(7L, 99L);
        SessionSeatLayout layout = layout(11L, 99L);
        SessionSeatLayoutSection vip = section(21L, 11L, 7L, "VIP区", 2, 3);
        SessionSeatLayoutSection normal = section(22L, 11L, 8L, "普通区", 4, 5);
        SessionSeat seat = new SessionSeat();
        seat.setId(301L);
        seat.setLayoutSectionId(21L);

        when(ticketTypeMapper.selectById(7L)).thenReturn(ticketType);
        when(sessionSeatLayoutMapper.selectOne(any())).thenReturn(layout);
        when(sessionSeatLayoutSectionMapper.selectList(any())).thenReturn(List.of(vip, normal));
        when(sessionSeatMapper.selectList(any())).thenReturn(List.of(seat));

        Result<SeatMapResponse> result = controller.getSeatMap(99L, 7L);

        assertEquals(200, result.getCode());
        assertNotNull(result.getData().getLayout());
        assertEquals(11L, result.getData().getLayout().getId());
        assertEquals(99L, result.getData().getLayout().getSessionId());
        assertEquals(2, result.getData().getLayout().getSections().size());
        assertEquals("VIP区", result.getData().getLayout().getSections().get(0).getName());
        assertEquals(Integer.valueOf(6), result.getData().getLayout().getSections().get(0).getSeatCount());
        assertEquals(List.of(seat), result.getData().getSeats());
        assertEquals(List.of(), result.getData().getAreas());
        verify(ticketTypeAreaMapper, never()).selectList(any());
        verify(venueAreaMapper, never()).selectBatchIds(any());
    }

    @Test
    void getSeatMapHandlesSeatCraftLayoutWithNoSections() {
        SeatController controller = controller();
        TicketType ticketType = ticketType(7L, 99L);
        SessionSeatLayout layout = layout(11L, 99L);

        when(ticketTypeMapper.selectById(7L)).thenReturn(ticketType);
        when(sessionSeatLayoutMapper.selectOne(any())).thenReturn(layout);
        when(sessionSeatLayoutSectionMapper.selectList(any())).thenReturn(null);

        Result<SeatMapResponse> result = controller.getSeatMap(99L, 7L);

        assertEquals(200, result.getCode());
        assertNotNull(result.getData().getLayout());
        assertEquals(List.of(), result.getData().getLayout().getSections());
        assertEquals(List.of(), result.getData().getSeats());
        verify(sessionSeatMapper, never()).selectList(any());
    }

    @Test
    void getSeatMapHandlesSeatCraftSectionWithoutSize() {
        SeatController controller = controller();
        TicketType ticketType = ticketType(7L, 99L);
        SessionSeatLayout layout = layout(11L, 99L);
        SessionSeatLayoutSection section = section(21L, 11L, 7L, "未配置区", 1, 1);
        section.setRows(null);
        section.setCols(null);

        when(ticketTypeMapper.selectById(7L)).thenReturn(ticketType);
        when(sessionSeatLayoutMapper.selectOne(any())).thenReturn(layout);
        when(sessionSeatLayoutSectionMapper.selectList(any())).thenReturn(List.of(section));
        when(sessionSeatMapper.selectList(any())).thenReturn(List.of());

        Result<SeatMapResponse> result = controller.getSeatMap(99L, 7L);

        assertEquals(200, result.getCode());
        assertNull(result.getData().getLayout().getSections().get(0).getSeatCount());
    }

    @Test
    void getSeatMapReturnsTicketTypeOnlyWhenActivitySeatMapIsHidden() {
        SeatController controller = controller();
        TicketType ticketType = ticketType(7L, 99L);
        Session session = session(99L, 5L);
        Activity activity = activity(5L, "hidden");

        when(ticketTypeMapper.selectById(7L)).thenReturn(ticketType);
        when(sessionMapper.selectById(99L)).thenReturn(session);
        when(activityMapper.selectById(5L)).thenReturn(activity);

        Result<SeatMapResponse> result = controller.getSeatMap(99L, 7L);

        assertEquals(200, result.getCode());
        assertEquals(99L, result.getData().getSessionId());
        assertEquals(7L, result.getData().getTicketTypeId());
        assertEquals("票档", result.getData().getTicketTypeName());
        assertNull(result.getData().getLayout());
        assertEquals(List.of(), result.getData().getAreas());
        assertEquals(List.of(), result.getData().getSeats());
        verify(sessionSeatLayoutMapper, never()).selectOne(any());
        verify(sessionSeatLayoutSectionMapper, never()).selectList(any());
        verify(sessionSeatMapper, never()).selectList(any());
        verify(ticketTypeAreaMapper, never()).selectList(any());
        verify(venueAreaMapper, never()).selectBatchIds(any());
    }

    @Test
    void getSeatMapIncludesSeatCraftLayoutWhenActivitySeatMapIsPublished() {
        SeatController controller = controller();
        TicketType ticketType = ticketType(7L, 99L);
        Session session = session(99L, 5L);
        Activity activity = activity(5L, "published");
        SessionSeatLayout layout = layout(11L, 99L);
        SessionSeatLayoutSection vip = section(21L, 11L, 7L, "VIP区", 2, 3);
        SessionSeat seat = new SessionSeat();
        seat.setId(301L);
        seat.setLayoutSectionId(21L);

        when(ticketTypeMapper.selectById(7L)).thenReturn(ticketType);
        when(sessionMapper.selectById(99L)).thenReturn(session);
        when(activityMapper.selectById(5L)).thenReturn(activity);
        when(sessionSeatLayoutMapper.selectOne(any())).thenReturn(layout);
        when(sessionSeatLayoutSectionMapper.selectList(any())).thenReturn(List.of(vip));
        when(sessionSeatMapper.selectList(any())).thenReturn(List.of(seat));

        Result<SeatMapResponse> result = controller.getSeatMap(99L, 7L);

        assertEquals(200, result.getCode());
        assertNotNull(result.getData().getLayout());
        assertEquals(11L, result.getData().getLayout().getId());
        assertEquals(List.of(seat), result.getData().getSeats());
    }

    @Test
    void getSeatMapIncludesSeatCraftBlockLayoutAndBlockSeatsWhenPublished() {
        SeatController controller = controller();
        TicketType ticketType = ticketType(7L, 99L);
        Session session = session(99L, 5L);
        Activity activity = activity(5L, "published");
        SessionSeatLayout layout = layout(11L, 99L);
        com.omni.ticket.dto.SeatCraftBlockDtos.LayoutRequest blockLayout = new com.omni.ticket.dto.SeatCraftBlockDtos.LayoutRequest();
        com.omni.ticket.dto.SeatCraftBlockDtos.BlockRequest block = new com.omni.ticket.dto.SeatCraftBlockDtos.BlockRequest();
        block.setBlockKey("floor");
        block.setName("池座");
        block.setBlockType("gridBlock");
        block.setTicketGroupKey("vip");
        blockLayout.setBlocks(List.of(block));
        SessionSeat seat = new SessionSeat();
        seat.setId(401L);
        seat.setSeatBlockId(501L);
        seat.setTicketTypeId(7L);

        when(ticketTypeMapper.selectById(7L)).thenReturn(ticketType);
        when(sessionMapper.selectById(99L)).thenReturn(session);
        when(activityMapper.selectById(5L)).thenReturn(activity);
        when(sessionSeatLayoutMapper.selectOne(any())).thenReturn(layout);
        when(sessionSeatLayoutSectionMapper.selectList(any())).thenReturn(List.of());
        when(seatCraftBlockLayoutService.getLayout("session", 99L)).thenReturn(blockLayout);
        when(sessionSeatMapper.selectList(any())).thenReturn(List.of(seat));

        Result<SeatMapResponse> result = controller.getSeatMap(99L, 7L);

        assertEquals(200, result.getCode());
        assertNotNull(result.getData().getLayout());
        assertNotNull(result.getData().getLayout().getBlockLayout());
        assertEquals(1, result.getData().getLayout().getBlockLayout().getBlocks().size());
        assertEquals(List.of(seat), result.getData().getSeats());
    }

    private SeatController controller() {
        return new SeatController(activityMapper, sessionMapper, ticketTypeMapper, ticketTypeAreaMapper, venueAreaMapper, sessionSeatMapper,
                sessionSeatLayoutMapper, sessionSeatLayoutSectionMapper, seatCraftBlockLayoutService);
    }

    private Activity activity(Long id, String seatMapVisibility) {
        Activity activity = new Activity();
        activity.setId(id);
        activity.setSeatMapVisibility(seatMapVisibility);
        return activity;
    }

    private Session session(Long id, Long activityId) {
        Session session = new Session();
        session.setId(id);
        session.setActivityId(activityId);
        return session;
    }

    private TicketType ticketType(Long id, Long sessionId) {
        TicketType ticketType = new TicketType();
        ticketType.setId(id);
        ticketType.setSessionId(sessionId);
        ticketType.setName("票档");
        ticketType.setPrice(new BigDecimal("199.00"));
        return ticketType;
    }

    private SessionSeatLayout layout(Long id, Long sessionId) {
        SessionSeatLayout layout = new SessionSeatLayout();
        layout.setId(id);
        layout.setSessionId(sessionId);
        layout.setName("演唱会座位图");
        layout.setTemplateType("concert");
        layout.setStageTitle("舞台");
        layout.setStageX(500);
        layout.setStageY(50);
        layout.setCanvasWidth(1000);
        layout.setCanvasHeight(800);
        return layout;
    }

    private SessionSeatLayoutSection section(Long id, Long layoutId, Long ticketTypeId, String name, int rows, int cols) {
        SessionSeatLayoutSection section = new SessionSeatLayoutSection();
        section.setId(id);
        section.setSessionLayoutId(layoutId);
        section.setTicketTypeId(ticketTypeId);
        section.setSectionKey("section-" + id);
        section.setName(name);
        section.setRows(rows);
        section.setCols(cols);
        section.setX(100);
        section.setY(200);
        section.setColor("#ff1268");
        section.setType("core");
        section.setLayout("grid");
        return section;
    }
}
