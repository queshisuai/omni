package com.omni.ticket.service;

import com.omni.exception.BusinessException;
import com.omni.ticket.dto.SeatCraftBlockDtos;
import com.omni.ticket.dto.SeatCraftLayoutDtos;
import com.omni.ticket.entity.Activity;
import com.omni.ticket.entity.Session;
import com.omni.ticket.entity.SeatBlock;
import com.omni.ticket.entity.SessionSeatLayout;
import com.omni.ticket.entity.SessionSeat;
import com.omni.ticket.entity.SessionSeatLayoutSection;
import com.omni.ticket.entity.TicketType;
import com.omni.ticket.dto.InternalUserRefResponse;
import com.omni.ticket.entity.VenueArea;
import com.omni.ticket.entity.VenueSeat;
import com.omni.ticket.mapper.ActivityMapper;
import com.omni.ticket.mapper.ActivitySeatLayoutMapper;
import com.omni.ticket.mapper.ActivitySeatLayoutSectionMapper;
import com.omni.ticket.mapper.SessionMapper;
import com.omni.ticket.mapper.SeatBlockMapper;
import com.omni.ticket.mapper.SessionSeatLayoutMapper;
import com.omni.ticket.mapper.SessionSeatLayoutSectionMapper;
import com.omni.ticket.mapper.SessionSeatMapper;
import com.omni.ticket.mapper.TicketTypeMapper;
import com.omni.ticket.service.UserAccessService;
import com.omni.ticket.mapper.VenueAreaMapper;
import com.omni.ticket.mapper.VenueSeatMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.same;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SessionSeatLayoutServiceTest {

    @Mock
    private SessionMapper sessionMapper;
    @Mock
    private ActivityMapper activityMapper;
    @Mock
    private UserAccessService userAccessService;
    @Mock
    private ActivitySeatLayoutMapper activityLayoutMapper;
    @Mock
    private ActivitySeatLayoutSectionMapper activitySectionMapper;
    @Mock
    private SessionSeatLayoutMapper sessionLayoutMapper;
    @Mock
    private SessionSeatLayoutSectionMapper sessionSectionMapper;
    @Mock
    private SessionSeatMapper sessionSeatMapper;
    @Mock
    private TicketTypeMapper ticketTypeMapper;
    @Mock
    private VenueAreaMapper venueAreaMapper;
    @Mock
    private VenueSeatMapper venueSeatMapper;
    @Mock
    private SeatCraftBlockLayoutService blockLayoutService;
    @Mock
    private SessionBlockTicketStockService blockTicketStockService;
    @Mock
    private SeatBlockMapper seatBlockMapper;
    @Mock
    private SessionSeatProtectionService sessionSeatProtectionService;
    @Mock
    private TicketTypeStockRecalculationService stockRecalculationService;

    private SessionSeatLayoutService service;

    @BeforeEach
    void setUp() {
        service = new SessionSeatLayoutService(sessionMapper, activityMapper, userAccessService,
                activityLayoutMapper, activitySectionMapper, sessionLayoutMapper,
                sessionSectionMapper, sessionSeatMapper, ticketTypeMapper, venueAreaMapper, venueSeatMapper,
                blockLayoutService, blockTicketStockService, seatBlockMapper, sessionSeatProtectionService,
                stockRecalculationService);
    }

    @Test
    void deleteBySessionIdDeletesLayoutSectionsAndBlockLayout() {
        when(sessionLayoutMapper.selectList(any())).thenReturn(List.of(layout(55L, 99L), layout(56L, 99L)));

        service.deleteBySessionId(99L);

        verify(sessionSectionMapper).delete(any());
        verify(sessionLayoutMapper).delete(any());
        verify(blockLayoutService).deleteLayout("session", 99L);
    }

    @Test
    void generateSessionSeatsDelegatesToBlockStockServiceWhenBlockLayoutExists() {
        SeatCraftBlockDtos.LayoutRequest blockLayout = new SeatCraftBlockDtos.LayoutRequest();
        when(sessionMapper.selectById(99L)).thenReturn(session(99L, 10L, 1L));
        when(sessionSeatMapper.selectCount(any())).thenReturn(0L);
        when(sessionLayoutMapper.selectOne(any())).thenReturn(layout(55L, 99L));
        when(blockLayoutService.getLayout("session", 99L)).thenReturn(blockLayout);
        when(blockTicketStockService.generateForSession(99L)).thenReturn(8);

        int generated = service.generateSessionSeats(99L);

        assertEquals(8, generated);
        verify(blockTicketStockService).generateForSession(99L);
        verify(sessionSectionMapper, never()).selectList(any());
    }

    @Test
    void copyFromActivityLayoutCopiesBlockLayoutToSession() {
        SeatCraftBlockDtos.LayoutRequest blockLayout = new SeatCraftBlockDtos.LayoutRequest();
        allowSessionManager(2003L, "organizer");
        when(sessionMapper.selectById(99L)).thenReturn(session(99L, 10L, 1L));
        when(activityMapper.selectById(10L)).thenReturn(activity(10L, 2003L));
        com.omni.ticket.entity.ActivitySeatLayout activityLayout = new com.omni.ticket.entity.ActivitySeatLayout();
        activityLayout.setId(55L);
        activityLayout.setActivityId(10L);
        activityLayout.setStatus(1);
        activityLayout.setName("活动座位图");
        activityLayout.setTemplateType("concert");
        activityLayout.setStageTitle("舞台");
        activityLayout.setStageX(0);
        activityLayout.setStageY(0);
        activityLayout.setCanvasWidth(1000);
        activityLayout.setCanvasHeight(800);
        when(activityLayoutMapper.selectById(55L)).thenReturn(activityLayout);
        when(activitySectionMapper.selectList(any())).thenReturn(List.of());
        when(sessionSeatMapper.selectCount(any())).thenReturn(0L);
        when(sessionLayoutMapper.selectList(any())).thenReturn(List.of());
        doAnswer(invocation -> {
            SessionSeatLayout layout = invocation.getArgument(0);
            layout.setId(66L);
            return 1;
        }).when(sessionLayoutMapper).insert(any(SessionSeatLayout.class));
        when(blockLayoutService.getLayout("activity", 10L)).thenReturn(blockLayout);
        when(blockLayoutService.getLayout("session", 99L)).thenReturn(blockLayout);

        SeatCraftLayoutDtos.LayoutResponse response = service.copyFromActivityLayout(2003L, 99L, 55L);

        verify(blockLayoutService).getLayout("activity", 10L);
        verify(blockLayoutService).replaceLayout(eq("session"), eq(99L), same(blockLayout));
        assertSame(blockLayout, response.getBlockLayout());
    }

    @Test
    void createBlankLayoutDoesNotPersistInvalidEmptyBlockLayout() {
        allowSessionManager(2003L, "organizer");
        when(sessionMapper.selectById(99L)).thenReturn(session(99L, 10L, 1L));
        when(activityMapper.selectById(10L)).thenReturn(activity(10L, 2003L));
        when(sessionSeatMapper.selectCount(any())).thenReturn(0L);
        when(sessionLayoutMapper.selectList(any())).thenReturn(List.of());
        doAnswer(invocation -> {
            SessionSeatLayout layout = invocation.getArgument(0);
            layout.setId(66L);
            return 1;
        }).when(sessionLayoutMapper).insert(any(SessionSeatLayout.class));

        SeatCraftLayoutDtos.LayoutResponse response = service.createBlankLayout(2003L, 99L);

        assertEquals(66L, response.getId());
        assertEquals(99L, response.getSessionId());
        assertEquals(0, response.getSections().size());
        verify(blockLayoutService, never()).replaceLayout(eq("session"), eq(99L), any());
    }

    @Test
    void getLayoutIncludesBlockLayout() {
        SeatCraftBlockDtos.LayoutRequest blockLayout = new SeatCraftBlockDtos.LayoutRequest();
        SessionSeat soldSeat = sessionSeat(701L, 501L, 7L, 1, 1);
        soldSeat.setStatus(3);
        soldSeat.setOrderId(9001L);
        allowSessionManager(2003L, "organizer");
        when(sessionMapper.selectById(99L)).thenReturn(session(99L, 10L, 1L));
        when(activityMapper.selectById(10L)).thenReturn(activity(10L, 2003L));
        when(sessionLayoutMapper.selectOne(any())).thenReturn(layout(55L, 99L));
        when(sessionSectionMapper.selectList(any())).thenReturn(List.of());
        when(blockLayoutService.getLayout("session", 99L)).thenReturn(blockLayout);
        when(sessionSeatMapper.selectList(any())).thenReturn(List.of(soldSeat));

        SeatCraftLayoutDtos.LayoutResponse response = service.getLayout(2003L, 99L);

        assertSame(blockLayout, response.getBlockLayout());
        assertEquals(List.of(soldSeat), response.getSeats());
    }

    @Test
    void updateLayoutAcceptsBlockOnlyLayoutAndPersistsBlocks() {
        SeatCraftBlockDtos.LayoutRequest blockLayout = new SeatCraftBlockDtos.LayoutRequest();
        SeatCraftLayoutDtos.LayoutResponse request = new SeatCraftLayoutDtos.LayoutResponse();
        request.setName("场次 SeatCraft 座位图");
        request.setTemplateType("concert");
        request.setStageTitle("舞台");
        request.setStageX(80);
        request.setStageY(40);
        request.setCanvasWidth(960);
        request.setCanvasHeight(720);
        request.setSections(List.of());
        request.setBlockLayout(blockLayout);
        allowSessionManager(2003L, "organizer");
        when(sessionMapper.selectById(99L)).thenReturn(session(99L, 10L, 1L));
        when(activityMapper.selectById(10L)).thenReturn(activity(10L, 2003L));
        when(sessionLayoutMapper.selectOne(any())).thenReturn(layout(55L, 99L));
        when(sessionSectionMapper.selectList(any())).thenReturn(List.of());
        when(blockLayoutService.getLayout("session", 99L)).thenReturn(blockLayout);

        SeatCraftLayoutDtos.LayoutResponse response = service.updateLayout(2003L, 99L, request);

        assertEquals("场次 SeatCraft 座位图", response.getName());
        assertEquals(0, response.getSections().size());
        verify(sessionLayoutMapper).updateById(argThat(layout -> "场次 SeatCraft 座位图".equals(layout.getName())));
        verify(blockLayoutService).replaceLayout(eq("session"), eq(99L), same(blockLayout));
    }

    @Test
    void updateLayoutTreatsNullSectionsAsEmptyList() {
        SeatCraftLayoutDtos.LayoutResponse request = new SeatCraftLayoutDtos.LayoutResponse();
        request.setName("场次 SeatCraft 座位图");
        request.setTemplateType("concert");
        request.setStageTitle("舞台");
        request.setStageX(80);
        request.setStageY(40);
        request.setCanvasWidth(960);
        request.setCanvasHeight(720);
        request.setSections(null);
        allowSessionManager(2003L, "organizer");
        when(sessionMapper.selectById(99L)).thenReturn(session(99L, 10L, 1L));
        when(activityMapper.selectById(10L)).thenReturn(activity(10L, 2003L));
        when(sessionLayoutMapper.selectOne(any())).thenReturn(layout(55L, 99L));

        SeatCraftLayoutDtos.LayoutResponse response = service.updateLayout(2003L, 99L, request);

        assertEquals(0, response.getSections().size());
        verify(sessionSectionMapper, never()).insert(any());
    }

    @Test
    void updateLayoutReusesExistingSectionKeyInsteadOfInsertingDuplicate() {
        SeatCraftLayoutDtos.LayoutResponse request = new SeatCraftLayoutDtos.LayoutResponse();
        request.setName("场次 SeatCraft 座位图");
        request.setTemplateType("concert");
        request.setStageTitle("舞台");
        request.setStageX(80);
        request.setStageY(40);
        request.setCanvasWidth(960);
        request.setCanvasHeight(720);
        SeatCraftLayoutDtos.SectionResponse section = new SeatCraftLayoutDtos.SectionResponse();
        section.setSectionKey("area-1");
        section.setName("A区");
        section.setRows(10);
        section.setCols(20);
        section.setX(120);
        section.setY(160);
        section.setColor("#ff1268");
        section.setType("core");
        section.setLayout("grid");
        section.setSort(0);
        section.setTicketTypeId(900L);
        request.setSections(List.of(section));

        SessionSeatLayoutSection existing = sessionSection(11L, "area-1", "旧A区", 8, 18);
        existing.setSessionLayoutId(55L);
        allowSessionManager(2003L, "organizer");
        when(sessionMapper.selectById(99L)).thenReturn(session(99L, 10L, 1L));
        when(activityMapper.selectById(10L)).thenReturn(activity(10L, 2003L));
        when(sessionLayoutMapper.selectOne(any())).thenReturn(layout(55L, 99L));
        when(sessionSectionMapper.selectList(any())).thenReturn(List.of(existing));

        SeatCraftLayoutDtos.LayoutResponse response = service.updateLayout(2003L, 99L, request);

        assertEquals(1, response.getSections().size());
        assertEquals(11L, response.getSections().get(0).getId());
        verify(sessionSectionMapper, never()).insert(any());
        verify(sessionSectionMapper, times(2)).updateById(any(SessionSeatLayoutSection.class));
        verify(sessionSectionMapper).updateById(argThat(updated -> Long.valueOf(11L).equals(updated.getId())
                && "area-1".equals(updated.getSectionKey())
                && "A区".equals(updated.getName())
                && Long.valueOf(900L).equals(updated.getTicketTypeId())
                && Integer.valueOf(1).equals(updated.getStatus())));
    }

    @Test
    void updateLayoutDisablesUnprotectedSeatsWhenBlockRemovedAndRecalculatesStock() {
        SeatCraftBlockDtos.LayoutRequest blockLayout = blockLayout("A");
        SeatCraftLayoutDtos.LayoutResponse request = layoutUpdateRequest(blockLayout);
        allowSessionManager(2003L, "organizer");
        when(sessionMapper.selectById(99L)).thenReturn(session(99L, 10L, 1L));
        when(activityMapper.selectById(10L)).thenReturn(activity(10L, 2003L));
        when(sessionLayoutMapper.selectOne(any())).thenReturn(layout(55L, 99L));
        when(sessionSectionMapper.selectList(any())).thenReturn(List.of());
        when(seatBlockMapper.selectList(any())).thenReturn(List.of(seatBlock(500L, "A"), seatBlock(501L, "B")));
        SessionSeat b1 = sessionSeat(7003L, 501L, 800L);
        SessionSeat b2 = sessionSeat(7004L, 501L, 800L);
        when(sessionSeatMapper.selectList(any())).thenReturn(List.of(b1, b2));
        when(sessionSeatProtectionService.findProtectedSeatIds(99L)).thenReturn(java.util.Set.of());
        when(blockLayoutService.getLayout("session", 99L)).thenReturn(blockLayout);

        service.updateLayout(2003L, 99L, request);

        verify(sessionSeatMapper, times(2)).updateById(argThat(seat -> Long.valueOf(501L).equals(seat.getSeatBlockId())
                && Integer.valueOf(4).equals(seat.getStatus())
                && seat.getUpdateTime() != null));
        verify(blockLayoutService).replaceLayout(eq("session"), eq(99L), same(blockLayout));
        verify(blockTicketStockService).generateForSession(99L);
        verify(stockRecalculationService).recalculateForSession(99L);
    }

    @Test
    void updateLayoutRejectsRemovedBlockWhenSeatProtected() {
        SeatCraftBlockDtos.LayoutRequest blockLayout = blockLayout("A");
        SeatCraftLayoutDtos.LayoutResponse request = layoutUpdateRequest(blockLayout);
        allowSessionManager(2003L, "organizer");
        when(sessionMapper.selectById(99L)).thenReturn(session(99L, 10L, 1L));
        when(activityMapper.selectById(10L)).thenReturn(activity(10L, 2003L));
        when(sessionLayoutMapper.selectOne(any())).thenReturn(layout(55L, 99L));
        when(seatBlockMapper.selectList(any())).thenReturn(List.of(seatBlock(500L, "A"), seatBlock(501L, "B")));
        SessionSeat protectedSeat = sessionSeat(99L, 501L, 800L);
        protectedSeat.setStatus(3);
        when(sessionSeatMapper.selectList(any())).thenReturn(List.of(protectedSeat));
        when(sessionSeatProtectionService.findProtectedSeatIds(99L)).thenReturn(java.util.Set.of(99L));

        BusinessException error = assertThrows(BusinessException.class, () -> service.updateLayout(2003L, 99L, request));

        assertEquals("该座位区域已有购票订单，请先完成退款后再调整或删除。", error.getMessage());
        verify(blockLayoutService, never()).replaceLayout(any(), any(), any());
        verify(sessionSeatMapper, never()).updateById(any());
        verify(stockRecalculationService, never()).recalculateForSession(any());
    }

    @Test
    void updateLayoutDisablesUnprotectedSeatsWhenGridBlockShrinks() {
        SeatCraftBlockDtos.LayoutRequest blockLayout = gridBlockLayout("A", 1, 1);
        SeatCraftLayoutDtos.LayoutResponse request = layoutUpdateRequest(blockLayout);
        allowSessionManager(2003L, "organizer");
        when(sessionMapper.selectById(99L)).thenReturn(session(99L, 10L, 1L));
        when(activityMapper.selectById(10L)).thenReturn(activity(10L, 2003L));
        when(sessionLayoutMapper.selectOne(any())).thenReturn(layout(55L, 99L));
        when(sessionSectionMapper.selectList(any())).thenReturn(List.of());
        when(seatBlockMapper.selectList(any())).thenReturn(List.of(seatBlock(500L, "A")));
        SessionSeat a11 = sessionSeat(7001L, 500L, 800L, 1, 1);
        SessionSeat a12 = sessionSeat(7002L, 500L, 800L, 1, 2);
        SessionSeat a21 = sessionSeat(7003L, 500L, 800L, 2, 1);
        SessionSeat a22 = sessionSeat(7004L, 500L, 800L, 2, 2);
        when(sessionSeatMapper.selectList(any())).thenReturn(List.of(a11, a12, a21, a22));
        when(sessionSeatProtectionService.findProtectedSeatIds(99L)).thenReturn(java.util.Set.of());
        when(blockLayoutService.getLayout("session", 99L)).thenReturn(blockLayout);

        service.updateLayout(2003L, 99L, request);

        verify(sessionSeatMapper, never()).updateById(argThat(seat -> Long.valueOf(7001L).equals(seat.getId())));
        verify(sessionSeatMapper, times(3)).updateById(argThat(seat -> Long.valueOf(500L).equals(seat.getSeatBlockId())
                && Integer.valueOf(4).equals(seat.getStatus())
                && seat.getUpdateTime() != null));
        verify(stockRecalculationService).recalculateForSession(99L);
    }

    @Test
    void updateLayoutRejectsGridShrinkWhenRemovedCoordinateProtected() {
        SeatCraftBlockDtos.LayoutRequest blockLayout = gridBlockLayout("A", 1, 1);
        SeatCraftLayoutDtos.LayoutResponse request = layoutUpdateRequest(blockLayout);
        allowSessionManager(2003L, "organizer");
        when(sessionMapper.selectById(99L)).thenReturn(session(99L, 10L, 1L));
        when(activityMapper.selectById(10L)).thenReturn(activity(10L, 2003L));
        when(sessionLayoutMapper.selectOne(any())).thenReturn(layout(55L, 99L));
        when(seatBlockMapper.selectList(any())).thenReturn(List.of(seatBlock(500L, "A")));
        SessionSeat a11 = sessionSeat(7001L, 500L, 800L, 1, 1);
        SessionSeat a12 = sessionSeat(7002L, 500L, 800L, 1, 2);
        when(sessionSeatMapper.selectList(any())).thenReturn(List.of(a11, a12));
        when(sessionSeatProtectionService.findProtectedSeatIds(99L)).thenReturn(java.util.Set.of(7002L));

        BusinessException error = assertThrows(BusinessException.class, () -> service.updateLayout(2003L, 99L, request));

        assertEquals("该座位区域已有购票订单，请先完成退款后再调整或删除。", error.getMessage());
        assertEquals(400, error.getCode());
        verify(blockLayoutService, never()).replaceLayout(any(), any(), any());
        verify(sessionLayoutMapper, never()).updateById(any());
        verify(sessionSeatMapper, never()).updateById(any());
    }

    @Test
    void updateLayoutDisablesUnprotectedSeatsWhenSeatBlockBecomesStandingBlock() {
        SeatCraftBlockDtos.LayoutRequest blockLayout = standingBlockLayout("A", 300);
        SeatCraftLayoutDtos.LayoutResponse request = layoutUpdateRequest(blockLayout);
        allowSessionManager(2003L, "organizer");
        when(sessionMapper.selectById(99L)).thenReturn(session(99L, 10L, 1L));
        when(activityMapper.selectById(10L)).thenReturn(activity(10L, 2003L));
        when(sessionLayoutMapper.selectOne(any())).thenReturn(layout(55L, 99L));
        when(sessionSectionMapper.selectList(any())).thenReturn(List.of());
        when(seatBlockMapper.selectList(any())).thenReturn(List.of(seatBlock(500L, "A")));
        SessionSeat a11 = sessionSeat(7001L, 500L, 800L, 1, 1);
        SessionSeat a12 = sessionSeat(7002L, 500L, 800L, 1, 2);
        when(sessionSeatMapper.selectList(any())).thenReturn(List.of(a11, a12));
        when(sessionSeatProtectionService.findProtectedSeatIds(99L)).thenReturn(java.util.Set.of());
        when(blockLayoutService.getLayout("session", 99L)).thenReturn(blockLayout);

        service.updateLayout(2003L, 99L, request);

        verify(sessionSeatMapper, times(2)).updateById(argThat(seat -> Long.valueOf(500L).equals(seat.getSeatBlockId())
                && Integer.valueOf(4).equals(seat.getStatus())));
        verify(blockLayoutService).replaceLayout(eq("session"), eq(99L), same(blockLayout));
    }

    @Test
    void createTicketDraftsFromSectionsUsesSectionNameAndSeatCount() {
        SessionSeatLayoutSection floor = sessionSection(1L, "floor", "池座内场", 12, 24);
        SessionSeatLayoutSection stand = sessionSection(2L, "stands", "环绕看台", 8, 48);
        when(sessionSectionMapper.selectList(any())).thenReturn(List.of(floor, stand));

        List<SeatCraftLayoutDtos.SectionResponse> drafts = service.buildTicketDrafts(99L);

        assertEquals(2, drafts.size());
        assertEquals("池座内场", drafts.get(0).getName());
        assertEquals(288, drafts.get(0).getSeatCount());
        assertEquals(384, drafts.get(1).getSeatCount());
    }

    @Test
    void generateSeatsCreatesSessionSeatForEachSectionSeat() {
        Session session = new Session();
        session.setId(99L);
        session.setVenueId(1L);
        when(sessionMapper.selectById(99L)).thenReturn(session);
        SessionSeatLayout layout = new SessionSeatLayout();
        layout.setId(55L);
        layout.setSessionId(99L);
        layout.setStatus(1);
        when(sessionLayoutMapper.selectOne(any())).thenReturn(layout);
        when(sessionSectionMapper.selectList(any())).thenReturn(List.of(sessionSectionWithTicket(10L, 900L, 2, 3)));
        when(sessionSeatMapper.selectCount(any())).thenReturn(0L);
        doAnswer(invocation -> {
            VenueArea area = invocation.getArgument(0);
            area.setId(700L);
            return 1;
        }).when(venueAreaMapper).insert(any());
        doAnswer(invocation -> {
            VenueSeat seat = invocation.getArgument(0);
            seat.setId(800L + seat.getRowNo() * 10L + seat.getSeatNo());
            return 1;
        }).when(venueSeatMapper).insert(any());

        int generated = service.generateSessionSeats(99L);

        assertEquals(6, generated);
        verify(venueAreaMapper).insert(argThat(area -> Long.valueOf(1L).equals(area.getVenueId())
                && "池座内场".equals(area.getName())
                && Integer.valueOf(2).equals(area.getRowCount())
                && Integer.valueOf(3).equals(area.getSeatsPerRow())
                && Integer.valueOf(0).equals(area.getStatus())));
        verify(venueSeatMapper, times(6)).insert(argThat(seat -> Long.valueOf(1L).equals(seat.getVenueId())
                && Long.valueOf(700L).equals(seat.getAreaId())
                && Integer.valueOf(0).equals(seat.getStatus())
                && assertSeatLabel(seat)));
        verify(sessionSeatMapper, times(6)).insert(argThat(seat -> Long.valueOf(99L).equals(seat.getSessionId())
                && Long.valueOf(1L).equals(seat.getVenueId())
                && Long.valueOf(700L).equals(seat.getAreaId())
                && Long.valueOf(10L).equals(seat.getLayoutSectionId())
                && Long.valueOf(900L).equals(seat.getTicketTypeId())
                && Integer.valueOf(1).equals(seat.getStatus())
                && seat.getVenueSeatId() != null
                && seat.getCreateTime() != null
                && seat.getUpdateTime() != null));
    }

    @Test
    void generateSeatsRejectsLegacySnapshotWhenSeatCraftLayoutExists() {
        Session session = new Session();
        session.setId(99L);
        session.setVenueId(1L);
        when(sessionMapper.selectById(99L)).thenReturn(session);
        SessionSeatLayout layout = new SessionSeatLayout();
        layout.setId(55L);
        layout.setSessionId(99L);
        layout.setStatus(1);
        when(sessionLayoutMapper.selectOne(any())).thenReturn(layout);
        SessionSeat oldSeat = new SessionSeat();
        oldSeat.setSessionId(99L);
        oldSeat.setLayoutSectionId(null);
        when(sessionSeatMapper.selectCount(any())).thenReturn(1L);
        when(sessionSeatMapper.selectList(any())).thenReturn(List.of(oldSeat));

        BusinessException error = assertThrows(BusinessException.class, () -> service.generateSessionSeats(99L));

        assertEquals("场次已有旧版座位快照，不能直接生成SeatCraft座位", error.getMessage());
    }

    @Test
    void bindTicketTypesRejectsSectionOutsideActiveLayout() {
        allowSessionManager(2003L, "organizer");
        when(sessionMapper.selectById(99L)).thenReturn(session(99L, 10L, 1L));
        when(activityMapper.selectById(10L)).thenReturn(activity(10L, 2003L));
        when(sessionLayoutMapper.selectOne(any())).thenReturn(layout(55L, 99L));
        SessionSeatLayoutSection section = sessionSectionWithTicket(10L, null, 1, 1);
        section.setSessionLayoutId(77L);
        when(sessionSectionMapper.selectById(10L)).thenReturn(section);
        SessionSeatLayoutService.TicketDraftInput draft = new SessionSeatLayoutService.TicketDraftInput();
        draft.setTicketTypeId(900L);

        BusinessException error = assertThrows(BusinessException.class,
                () -> service.bindTicketTypesAndGenerateSeats(2003L, 99L, Map.of(10L, draft)));

        assertEquals("票档草稿分区不属于当前场次座位图", error.getMessage());
        verify(sessionSectionMapper, never()).updateById(any());
    }

    @Test
    void bindTicketTypesRejectsTicketTypeFromOtherSession() {
        allowSessionManager(2003L, "organizer");
        when(sessionMapper.selectById(99L)).thenReturn(session(99L, 10L, 1L));
        when(activityMapper.selectById(10L)).thenReturn(activity(10L, 2003L));
        when(sessionLayoutMapper.selectOne(any())).thenReturn(layout(55L, 99L));
        SessionSeatLayoutSection section = sessionSectionWithTicket(10L, null, 1, 1);
        section.setSessionLayoutId(55L);
        when(sessionSectionMapper.selectById(10L)).thenReturn(section);
        TicketType ticketType = new TicketType();
        ticketType.setId(900L);
        ticketType.setSessionId(100L);
        when(ticketTypeMapper.selectById(900L)).thenReturn(ticketType);
        SessionSeatLayoutService.TicketDraftInput draft = new SessionSeatLayoutService.TicketDraftInput();
        draft.setTicketTypeId(900L);

        BusinessException error = assertThrows(BusinessException.class,
                () -> service.bindTicketTypesAndGenerateSeats(2003L, 99L, Map.of(10L, draft)));

        assertEquals("票档不属于当前场次", error.getMessage());
        verify(sessionSectionMapper, never()).updateById(any());
    }

    @Test
    void bindTicketTypeUpdatesSectionAndExistingSectionSeats() {
        allowSessionManager(2003L, "organizer");
        when(sessionMapper.selectById(99L)).thenReturn(session(99L, 10L, 1L));
        when(activityMapper.selectById(10L)).thenReturn(activity(10L, 2003L));
        when(sessionLayoutMapper.selectOne(any())).thenReturn(layout(55L, 99L));
        SessionSeatLayoutSection section = sessionSectionWithTicket(10L, null, 2, 3);
        section.setSessionLayoutId(55L);
        when(sessionSectionMapper.selectById(10L)).thenReturn(section);
        TicketType ticketType = new TicketType();
        ticketType.setId(900L);
        ticketType.setSessionId(99L);
        when(ticketTypeMapper.selectById(900L)).thenReturn(ticketType);
        when(sessionSeatMapper.selectCount(any())).thenReturn(6L);
        SessionSeat existingSeat = new SessionSeat();
        existingSeat.setSessionId(99L);
        existingSeat.setLayoutSectionId(10L);
        when(sessionSeatMapper.selectList(any())).thenReturn(List.of(existingSeat));
        SessionSeatLayoutService.TicketDraftInput draft = new SessionSeatLayoutService.TicketDraftInput();
        draft.setTicketTypeId(900L);

        int generated = service.bindTicketTypesAndGenerateSeats(2003L, 99L, Map.of(10L, draft));

        assertEquals(0, generated);
        verify(sessionSectionMapper).updateById(argThat(updated -> Long.valueOf(10L).equals(updated.getId())
                && Long.valueOf(900L).equals(updated.getTicketTypeId())));
        verify(sessionSeatMapper).updateTicketTypeByLayoutSection(99L, 10L, 900L);
    }

    @Test
    void bindTicketTypesRejectsSectionAlreadyBoundToAnotherTicketType() {
        allowSessionManager(2003L, "organizer");
        when(sessionMapper.selectById(99L)).thenReturn(session(99L, 10L, 1L));
        when(activityMapper.selectById(10L)).thenReturn(activity(10L, 2003L));
        when(sessionLayoutMapper.selectOne(any())).thenReturn(layout(55L, 99L));
        SessionSeatLayoutSection section = sessionSectionWithTicket(10L, 800L, 2, 3);
        section.setSessionLayoutId(55L);
        when(sessionSectionMapper.selectById(10L)).thenReturn(section);
        TicketType ticketType = new TicketType();
        ticketType.setId(900L);
        ticketType.setSessionId(99L);
        when(ticketTypeMapper.selectById(900L)).thenReturn(ticketType);
        SessionSeatLayoutService.TicketDraftInput draft = new SessionSeatLayoutService.TicketDraftInput();
        draft.setTicketTypeId(900L);

        BusinessException error = assertThrows(BusinessException.class,
                () -> service.bindTicketTypesAndGenerateSeats(2003L, 99L, Map.of(10L, draft)));

        assertEquals("分区已绑定其他票档", error.getMessage());
        verify(sessionSeatMapper, never()).updateTicketTypeByLayoutSection(any(), any(), any());
    }

    @Test
    void generateSeatsRejectsExistingLegacySnapshotForSeatCraftLayout() {
        when(sessionMapper.selectById(99L)).thenReturn(session(99L, 10L, 1L));
        when(sessionSeatMapper.selectCount(any())).thenReturn(1L);
        when(sessionLayoutMapper.selectOne(any())).thenReturn(layout(55L, 99L));
        SessionSeat oldSeat = new SessionSeat();
        oldSeat.setSessionId(99L);
        oldSeat.setLayoutSectionId(null);
        when(sessionSeatMapper.selectList(any())).thenReturn(List.of(oldSeat));

        BusinessException error = assertThrows(BusinessException.class, () -> service.generateSessionSeats(99L));

        assertEquals("场次已有旧版座位快照，不能直接生成SeatCraft座位", error.getMessage());
    }

    @Test
    void updateTicketBindingsRejectsProtectedSeatWhenTicketTypeChanges() {
        allowSessionManager(2003L, "organizer");
        when(sessionMapper.selectById(99L)).thenReturn(session(99L, 10L, 1L));
        when(activityMapper.selectById(10L)).thenReturn(activity(10L, 2003L));
        TicketType ticketType = new TicketType();
        ticketType.setId(900L);
        ticketType.setSessionId(99L);
        when(ticketTypeMapper.selectById(900L)).thenReturn(ticketType);
        when(seatBlockMapper.selectList(any())).thenReturn(List.of(seatBlock(500L, "floor")));
        SessionSeat seat = sessionSeat(7001L, 500L, 800L);
        when(sessionSeatMapper.selectList(any())).thenReturn(List.of(seat));
        when(sessionSeatProtectionService.findProtectedSeatIds(99L)).thenReturn(java.util.Set.of(7001L));
        SessionSeatLayoutService.TicketBindingInput binding = new SessionSeatLayoutService.TicketBindingInput();
        binding.setTicketTypeId(900L);
        binding.setBlockKeys(List.of("floor"));

        BusinessException error = assertThrows(BusinessException.class,
                () -> service.updateTicketBindings(2003L, 99L, List.of(binding)));

        assertEquals("该座位区域已有购票订单，请先完成退款后再调整或删除。", error.getMessage());
        verify(sessionSeatMapper, never()).updateById(any());
        verify(stockRecalculationService, never()).recalculateForSession(any());
    }

    @Test
    void updateTicketBindingsUpdatesUnprotectedSeatsAndRecalculatesStock() {
        allowSessionManager(2003L, "organizer");
        when(sessionMapper.selectById(99L)).thenReturn(session(99L, 10L, 1L));
        when(activityMapper.selectById(10L)).thenReturn(activity(10L, 2003L));
        TicketType ticketType = new TicketType();
        ticketType.setId(900L);
        ticketType.setSessionId(99L);
        when(ticketTypeMapper.selectById(900L)).thenReturn(ticketType);
        when(seatBlockMapper.selectList(any())).thenReturn(List.of(seatBlock(500L, "floor")));
        SessionSeat seat = sessionSeat(7001L, 500L, 800L);
        when(sessionSeatMapper.selectList(any())).thenReturn(List.of(seat));
        when(sessionSeatProtectionService.findProtectedSeatIds(99L)).thenReturn(java.util.Set.of());
        SessionSeatLayoutService.TicketBindingInput binding = new SessionSeatLayoutService.TicketBindingInput();
        binding.setTicketTypeId(900L);
        binding.setBlockKeys(List.of("floor"));

        service.updateTicketBindings(2003L, 99L, List.of(binding));

        verify(sessionSeatMapper).updateById(argThat(updated -> Long.valueOf(7001L).equals(updated.getId())
                && Long.valueOf(900L).equals(updated.getTicketTypeId())
                && updated.getUpdateTime() != null));
        verify(stockRecalculationService).recalculateForSession(99L);
    }

    @Test
    void updateTicketBindingsRejectsTicketTypeFromOtherSession() {
        allowSessionManager(2003L, "organizer");
        when(sessionMapper.selectById(99L)).thenReturn(session(99L, 10L, 1L));
        when(activityMapper.selectById(10L)).thenReturn(activity(10L, 2003L));
        TicketType ticketType = new TicketType();
        ticketType.setId(900L);
        ticketType.setSessionId(100L);
        when(ticketTypeMapper.selectById(900L)).thenReturn(ticketType);
        SessionSeatLayoutService.TicketBindingInput binding = new SessionSeatLayoutService.TicketBindingInput();
        binding.setTicketTypeId(900L);
        binding.setBlockKeys(List.of("floor"));

        BusinessException error = assertThrows(BusinessException.class,
                () -> service.updateTicketBindings(2003L, 99L, List.of(binding)));

        assertEquals("票档不属于当前场次", error.getMessage());
        verify(sessionSeatMapper, never()).updateById(any());
        verify(stockRecalculationService, never()).recalculateForSession(any());
    }

    @Test
    void updateTicketBindingsRejectsDuplicateBlockAcrossTicketTypes() {
        allowSessionManager(2003L, "organizer");
        when(sessionMapper.selectById(99L)).thenReturn(session(99L, 10L, 1L));
        when(activityMapper.selectById(10L)).thenReturn(activity(10L, 2003L));
        TicketType vip = new TicketType();
        vip.setId(900L);
        vip.setSessionId(99L);
        TicketType normal = new TicketType();
        normal.setId(901L);
        normal.setSessionId(99L);
        when(ticketTypeMapper.selectById(900L)).thenReturn(vip);
        when(ticketTypeMapper.selectById(901L)).thenReturn(normal);
        SessionSeatLayoutService.TicketBindingInput first = new SessionSeatLayoutService.TicketBindingInput();
        first.setTicketTypeId(900L);
        first.setBlockKeys(List.of("floor"));
        SessionSeatLayoutService.TicketBindingInput second = new SessionSeatLayoutService.TicketBindingInput();
        second.setTicketTypeId(901L);
        second.setBlockKeys(List.of("floor"));

        BusinessException error = assertThrows(BusinessException.class,
                () -> service.updateTicketBindings(2003L, 99L, List.of(first, second)));

        assertEquals("同一座位区域不能绑定多个票档", error.getMessage());
        verify(sessionSeatMapper, never()).updateById(any());
        verify(stockRecalculationService, never()).recalculateForSession(any());
    }

    private SessionSeatLayoutSection sessionSection(Long id, String sectionKey, String name, int rows, int cols) {
        SessionSeatLayoutSection section = new SessionSeatLayoutSection();
        section.setId(id);
        section.setSessionLayoutId(99L);
        section.setSectionKey(sectionKey);
        section.setName(name);
        section.setRows(rows);
        section.setCols(cols);
        section.setX(100);
        section.setY(200);
        section.setColor("#ff1268");
        section.setType("core");
        section.setLayout("grid");
        section.setSort(1);
        section.setStatus(1);
        return section;
    }

    private SessionSeatLayoutSection sessionSectionWithTicket(Long id, Long ticketTypeId, int rows, int cols) {
        SessionSeatLayoutSection section = sessionSection(id, "floor", "池座内场", rows, cols);
        section.setTicketTypeId(ticketTypeId);
        return section;
    }

    private SeatBlock seatBlock(Long id, String blockKey) {
        SeatBlock block = new SeatBlock();
        block.setId(id);
        block.setOwnerType("session");
        block.setOwnerId(99L);
        block.setBlockKey(blockKey);
        block.setStatus(1);
        return block;
    }

    private SessionSeat sessionSeat(Long id, Long blockId, Long ticketTypeId) {
        SessionSeat seat = new SessionSeat();
        seat.setId(id);
        seat.setSessionId(99L);
        seat.setSeatBlockId(blockId);
        seat.setTicketTypeId(ticketTypeId);
        seat.setStatus(1);
        return seat;
    }

    private SessionSeat sessionSeat(Long id, Long blockId, Long ticketTypeId, Integer rowNo, Integer seatNo) {
        SessionSeat seat = sessionSeat(id, blockId, ticketTypeId);
        seat.setGeneratedRowNo(rowNo);
        seat.setGeneratedSeatNo(seatNo);
        seat.setRowNo(rowNo);
        seat.setSeatNo(seatNo);
        return seat;
    }

    private SeatCraftLayoutDtos.LayoutResponse layoutUpdateRequest(SeatCraftBlockDtos.LayoutRequest blockLayout) {
        SeatCraftLayoutDtos.LayoutResponse request = new SeatCraftLayoutDtos.LayoutResponse();
        request.setName("场次 SeatCraft 座位图");
        request.setTemplateType("concert");
        request.setStageTitle("舞台");
        request.setStageX(80);
        request.setStageY(40);
        request.setCanvasWidth(960);
        request.setCanvasHeight(720);
        request.setSections(List.of());
        request.setBlockLayout(blockLayout);
        return request;
    }

    private SeatCraftBlockDtos.LayoutRequest blockLayout(String... blockKeys) {
        SeatCraftBlockDtos.LayoutRequest layout = new SeatCraftBlockDtos.LayoutRequest();
        layout.setBlocks(java.util.Arrays.stream(blockKeys).map(this::blockRequest).collect(java.util.stream.Collectors.toList()));
        SeatCraftBlockDtos.TicketGroupRequest group = new SeatCraftBlockDtos.TicketGroupRequest();
        group.setGroupKey("G");
        group.setName("票档组");
        group.setSourceBlockKeys(java.util.Arrays.asList(blockKeys));
        layout.setTicketGroups(List.of(group));
        return layout;
    }

    private SeatCraftBlockDtos.LayoutRequest gridBlockLayout(String blockKey, int rows, int cols) {
        SeatCraftBlockDtos.LayoutRequest layout = blockLayout(blockKey);
        SeatCraftBlockDtos.BlockRequest block = layout.getBlocks().get(0);
        block.setBlockType("gridBlock");
        block.setRows(rows);
        block.setCols(cols);
        block.setX(BigDecimal.ZERO);
        block.setY(BigDecimal.ZERO);
        return layout;
    }

    private SeatCraftBlockDtos.LayoutRequest standingBlockLayout(String blockKey, int capacity) {
        SeatCraftBlockDtos.LayoutRequest layout = blockLayout(blockKey);
        SeatCraftBlockDtos.BlockRequest block = layout.getBlocks().get(0);
        block.setBlockType("standingBlock");
        block.setCapacity(capacity);
        return layout;
    }

    private SeatCraftBlockDtos.BlockRequest blockRequest(String blockKey) {
        SeatCraftBlockDtos.BlockRequest block = new SeatCraftBlockDtos.BlockRequest();
        block.setBlockKey(blockKey);
        block.setName(blockKey);
        block.setBlockType("gridBlock");
        block.setTicketGroupKey("G");
        block.setRows(2);
        block.setCols(2);
        return block;
    }

    private boolean assertSeatLabel(VenueSeat seat) {
        assertNotNull(seat.getSeatLabel());
        return seat.getSeatLabel().equals(seat.getRowNo() + "排" + seat.getSeatNo() + "座");
    }

    private Session session(Long id, Long activityId, Long venueId) {
        Session session = new Session();
        session.setId(id);
        session.setActivityId(activityId);
        session.setVenueId(venueId);
        return session;
    }

    private SessionSeatLayout layout(Long id, Long sessionId) {
        SessionSeatLayout layout = new SessionSeatLayout();
        layout.setId(id);
        layout.setSessionId(sessionId);
        layout.setStatus(1);
        return layout;
    }

    private InternalUserRefResponse user(Long id, String role) {
        InternalUserRefResponse user = new InternalUserRefResponse();
        user.setId(id);
        user.setRole(role);
        return user;
    }

    private void allowSessionManager(Long userId, String role) {
        InternalUserRefResponse user = user(userId, role);
        when(userAccessService.requireAdminOrOrganizerOrAnyPermission(userId, "session.manage"))
                .thenReturn(user);
        when(userAccessService.isOrganizer(user)).thenReturn("organizer".equals(role));
    }

    private Activity activity(Long id, Long organizerId) {
        Activity activity = new Activity();
        activity.setId(id);
        activity.setOrganizerId(organizerId);
        return activity;
    }
}
