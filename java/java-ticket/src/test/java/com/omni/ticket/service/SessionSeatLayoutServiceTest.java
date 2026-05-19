package com.omni.ticket.service;

import com.omni.exception.BusinessException;
import com.omni.ticket.dto.SeatCraftLayoutDtos;
import com.omni.ticket.entity.Activity;
import com.omni.ticket.entity.Session;
import com.omni.ticket.entity.SessionSeatLayout;
import com.omni.ticket.entity.SessionSeat;
import com.omni.ticket.entity.SessionSeatLayoutSection;
import com.omni.ticket.entity.TicketType;
import com.omni.ticket.entity.UserRef;
import com.omni.ticket.entity.VenueArea;
import com.omni.ticket.entity.VenueSeat;
import com.omni.ticket.entity.VenueSeatLayoutTemplate;
import com.omni.ticket.mapper.ActivityMapper;
import com.omni.ticket.mapper.ActivitySeatLayoutMapper;
import com.omni.ticket.mapper.ActivitySeatLayoutSectionMapper;
import com.omni.ticket.mapper.SessionMapper;
import com.omni.ticket.mapper.SessionSeatLayoutMapper;
import com.omni.ticket.mapper.SessionSeatLayoutSectionMapper;
import com.omni.ticket.mapper.SessionSeatMapper;
import com.omni.ticket.mapper.TicketTypeMapper;
import com.omni.ticket.mapper.UserRefMapper;
import com.omni.ticket.mapper.VenueAreaMapper;
import com.omni.ticket.mapper.VenueSeatLayoutTemplateMapper;
import com.omni.ticket.mapper.VenueSeatLayoutTemplateSectionMapper;
import com.omni.ticket.mapper.VenueSeatMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
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
    private UserRefMapper userRefMapper;
    @Mock
    private VenueSeatLayoutTemplateMapper templateMapper;
    @Mock
    private VenueSeatLayoutTemplateSectionMapper templateSectionMapper;
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

    private SessionSeatLayoutService service;

    @BeforeEach
    void setUp() {
        service = new SessionSeatLayoutService(sessionMapper, activityMapper, userRefMapper, templateMapper,
                templateSectionMapper, activityLayoutMapper, activitySectionMapper, sessionLayoutMapper,
                sessionSectionMapper, sessionSeatMapper, ticketTypeMapper, venueAreaMapper, venueSeatMapper);
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
        when(userRefMapper.selectById(2003L)).thenReturn(user(2003L, "organizer"));
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
        when(userRefMapper.selectById(2003L)).thenReturn(user(2003L, "organizer"));
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
        when(userRefMapper.selectById(2003L)).thenReturn(user(2003L, "organizer"));
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
        when(userRefMapper.selectById(2003L)).thenReturn(user(2003L, "organizer"));
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
    void copyFromTemplateDisablesExtraActiveLayoutsForSameSession() {
        when(userRefMapper.selectById(2002L)).thenReturn(user(2002L, "admin"));
        when(sessionMapper.selectById(99L)).thenReturn(session(99L, 10L, 1L));
        when(activityMapper.selectById(10L)).thenReturn(activity(10L, 2003L));
        VenueSeatLayoutTemplate template = new VenueSeatLayoutTemplate();
        template.setId(88L);
        template.setVenueId(1L);
        template.setName("演唱会默认模板");
        template.setTemplateType("concert");
        template.setStageTitle("演出舞台 / STAGE");
        template.setStageX(500);
        template.setStageY(50);
        template.setCanvasWidth(1000);
        template.setCanvasHeight(800);
        template.setStatus(1);
        when(templateMapper.selectById(88L)).thenReturn(template);
        SessionSeatLayout current = layout(55L, 99L);
        SessionSeatLayout stale = layout(56L, 99L);
        when(sessionLayoutMapper.selectList(any())).thenReturn(List.of(current, stale));
        when(templateSectionMapper.selectList(any())).thenReturn(List.of());

        service.copyFromTemplate(2002L, 99L, 88L);

        verify(sessionLayoutMapper).updateById(argThat(updated -> Long.valueOf(56L).equals(updated.getId())
                && Integer.valueOf(0).equals(updated.getStatus())));
    }

    @Test
    void copyFromTemplateRejectsExistingLegacySnapshot() {
        when(userRefMapper.selectById(2002L)).thenReturn(user(2002L, "admin"));
        when(sessionMapper.selectById(99L)).thenReturn(session(99L, 10L, 1L));
        when(activityMapper.selectById(10L)).thenReturn(activity(10L, 2003L));
        when(sessionSeatMapper.selectCount(any())).thenReturn(1L);
        SessionSeat oldSeat = new SessionSeat();
        oldSeat.setSessionId(99L);
        oldSeat.setLayoutSectionId(null);
        when(sessionSeatMapper.selectList(any())).thenReturn(List.of(oldSeat));

        BusinessException error = assertThrows(BusinessException.class,
                () -> service.copyFromTemplate(2002L, 99L, 88L));

        assertEquals("场次已有旧版座位快照，不能直接复制SeatCraft座位图", error.getMessage());
        verify(sessionLayoutMapper, never()).insert(any());
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

    private UserRef user(Long id, String role) {
        UserRef user = new UserRef();
        user.setId(id);
        user.setRole(role);
        return user;
    }

    private Activity activity(Long id, Long organizerId) {
        Activity activity = new Activity();
        activity.setId(id);
        activity.setOrganizerId(organizerId);
        return activity;
    }
}
