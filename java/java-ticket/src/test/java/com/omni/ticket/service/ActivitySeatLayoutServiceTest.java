package com.omni.ticket.service;

import com.omni.exception.BusinessException;
import com.omni.ticket.dto.SeatCraftBlockDtos;
import com.omni.ticket.dto.SeatCraftLayoutDtos;
import com.omni.ticket.entity.Activity;
import com.omni.ticket.entity.ActivitySeatLayout;
import com.omni.ticket.entity.ActivitySeatLayoutSection;
import com.omni.ticket.dto.InternalUserRefResponse;
import com.omni.ticket.entity.VenueDefaultLayout;
import com.omni.ticket.entity.VenueDefaultLayoutSection;
import com.omni.ticket.mapper.ActivityMapper;
import com.omni.ticket.mapper.ActivitySeatLayoutMapper;
import com.omni.ticket.mapper.ActivitySeatLayoutSectionMapper;
import com.omni.ticket.mapper.VenueDefaultLayoutMapper;
import com.omni.ticket.mapper.VenueDefaultLayoutSectionMapper;
import com.omni.ticket.service.UserAccessService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.same;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ActivitySeatLayoutServiceTest {

    @Mock
    private ActivityMapper activityMapper;

    @Mock
    private UserAccessService userAccessService;

    @Mock
    private VenueDefaultLayoutMapper venueDefaultLayoutMapper;

    @Mock
    private VenueDefaultLayoutSectionMapper venueSectionMapper;

    @Mock
    private ActivitySeatLayoutMapper activityLayoutMapper;

    @Mock
    private ActivitySeatLayoutSectionMapper activitySectionMapper;

    @Mock
    private SeatCraftBlockLayoutService blockLayoutService;

    private ActivitySeatLayoutService service;

    @BeforeEach
    void setUp() {
        service = new ActivitySeatLayoutService(activityMapper, userAccessService, venueDefaultLayoutMapper, venueSectionMapper,
                activityLayoutMapper, activitySectionMapper, blockLayoutService);
    }

    @Test
    void organizerCreatesFromVenueDefaultForOwnActivity() {
        when(userAccessService.requireAdminOrOrganizer(2003L)).thenReturn(user(2003L, "organizer"));
        when(activityMapper.selectById(10L)).thenReturn(activity(10L, 2003L));
        when(venueDefaultLayoutMapper.selectById(7L)).thenReturn(venueLayout(7L, 1L, "concert"));
        when(activityLayoutMapper.selectList(any())).thenReturn(List.of());
        when(venueSectionMapper.selectList(any())).thenReturn(List.of(venueSection(70L, "floor", "池座内场", 12, 24)));

        SeatCraftLayoutDtos.LayoutResponse layout = service.createFromVenueDefault(2003L, 10L, 7L);

        assertEquals(10L, layout.getActivityId());
        assertEquals(1, layout.getSections().size());

        ArgumentCaptor<ActivitySeatLayout> layoutCaptor = ArgumentCaptor.forClass(ActivitySeatLayout.class);
        verify(activityLayoutMapper).insert(layoutCaptor.capture());
        assertEquals(10L, layoutCaptor.getValue().getActivityId());
        assertEquals(7L, layoutCaptor.getValue().getSourceVenueLayoutId());

        ArgumentCaptor<ActivitySeatLayoutSection> sectionCaptor = ArgumentCaptor.forClass(ActivitySeatLayoutSection.class);
        verify(activitySectionMapper).insert(sectionCaptor.capture());
        assertEquals("floor", sectionCaptor.getValue().getSectionKey());
    }

    @Test
    void createFromVenueDefaultDisablesExistingActiveLayoutsBeforeInsertingNewLayout() {
        ActivitySeatLayout oldLayout = activeLayout(99L, 10L);
        when(userAccessService.requireAdminOrOrganizer(2003L)).thenReturn(user(2003L, "organizer"));
        when(activityMapper.selectById(10L)).thenReturn(activity(10L, 2003L));
        when(venueDefaultLayoutMapper.selectById(7L)).thenReturn(venueLayout(7L, 1L, "concert"));
        when(activityLayoutMapper.selectList(any())).thenReturn(List.of(oldLayout));
        when(venueSectionMapper.selectList(any())).thenReturn(List.of(venueSection(70L, "floor", "池座内场", 12, 24)));

        SeatCraftLayoutDtos.LayoutResponse layout = service.createFromVenueDefault(2003L, 10L, 7L);

        assertEquals(10L, layout.getActivityId());

        ArgumentCaptor<ActivitySeatLayout> updateCaptor = ArgumentCaptor.forClass(ActivitySeatLayout.class);
        verify(activityLayoutMapper).updateById(updateCaptor.capture());
        assertEquals(99L, updateCaptor.getValue().getId());
        assertEquals(0, updateCaptor.getValue().getStatus());

        verify(activityLayoutMapper).insert(any(ActivitySeatLayout.class));
    }

    @Test
    void createFromVenueDefaultDisablesAllExistingActiveLayoutsAndInsertsOneActiveLayout() {
        ActivitySeatLayout firstOldLayout = activeLayout(99L, 10L);
        ActivitySeatLayout secondOldLayout = activeLayout(100L, 10L);
        when(userAccessService.requireAdminOrOrganizer(2003L)).thenReturn(user(2003L, "organizer"));
        when(activityMapper.selectById(10L)).thenReturn(activity(10L, 2003L));
        when(venueDefaultLayoutMapper.selectById(7L)).thenReturn(venueLayout(7L, 1L, "concert"));
        when(activityLayoutMapper.selectList(any())).thenReturn(List.of(firstOldLayout, secondOldLayout));
        when(venueSectionMapper.selectList(any())).thenReturn(List.of(venueSection(70L, "floor", "池座内场", 12, 24)));

        service.createFromVenueDefault(2003L, 10L, 7L);

        ArgumentCaptor<ActivitySeatLayout> updateCaptor = ArgumentCaptor.forClass(ActivitySeatLayout.class);
        verify(activityLayoutMapper, times(2)).updateById(updateCaptor.capture());
        assertEquals(List.of(99L, 100L), updateCaptor.getAllValues().stream().map(ActivitySeatLayout::getId).toList());
        assertEquals(List.of(0, 0), updateCaptor.getAllValues().stream().map(ActivitySeatLayout::getStatus).toList());

        ArgumentCaptor<ActivitySeatLayout> insertCaptor = ArgumentCaptor.forClass(ActivitySeatLayout.class);
        verify(activityLayoutMapper).insert(insertCaptor.capture());
        assertEquals(1, insertCaptor.getValue().getStatus());
    }

    @Test
    void createFromVenueDefaultCopiesVenueBlockLayoutToActivity() {
        SeatCraftBlockDtos.LayoutRequest blockLayout = new SeatCraftBlockDtos.LayoutRequest();
        when(userAccessService.requireAdminOrOrganizer(2003L)).thenReturn(user(2003L, "organizer"));
        when(activityMapper.selectById(10L)).thenReturn(activity(10L, 2003L));
        when(venueDefaultLayoutMapper.selectById(7L)).thenReturn(venueLayout(7L, 1L, "concert"));
        when(activityLayoutMapper.selectList(any())).thenReturn(List.of());
        when(venueSectionMapper.selectList(any())).thenReturn(List.of());
        when(blockLayoutService.getLayout("venue", 1L)).thenReturn(blockLayout);
        when(blockLayoutService.getLayout("activity", 10L)).thenReturn(blockLayout);

        SeatCraftLayoutDtos.LayoutResponse response = service.createFromVenueDefault(2003L, 10L, 7L);

        verify(blockLayoutService).getLayout("venue", 1L);
        verify(blockLayoutService).replaceLayout(eq("activity"), eq(10L), same(blockLayout));
        assertSame(blockLayout, response.getBlockLayout());
    }

    @Test
    void organizerCannotCreateFromVenueDefaultForOthersActivity() {
        when(userAccessService.requireAdminOrOrganizer(2003L)).thenReturn(user(2003L, "organizer"));
        when(activityMapper.selectById(10L)).thenReturn(activity(10L, 9999L));

        BusinessException error = assertThrows(BusinessException.class,
                () -> service.createFromVenueDefault(2003L, 10L, 7L));

        assertEquals(403, error.getCode());
        verify(activityLayoutMapper, never()).insert(any());
        verify(activitySectionMapper, never()).insert(any());
    }

    @Test
    void updateLayoutReplacesExistingSectionsWithRequestSections() {
        ActivitySeatLayout existingLayout = activeLayout(88L, 10L);
        existingLayout.setName("旧座位图");
        existingLayout.setTemplateType("concert");
        existingLayout.setStageTitle("旧舞台");
        existingLayout.setStageX(100);
        existingLayout.setStageY(50);
        existingLayout.setCanvasWidth(1000);
        existingLayout.setCanvasHeight(800);
        ActivitySeatLayoutSection oldSection = activitySection(901L, 88L, "old", "旧分区", 1, 1);
        SeatCraftLayoutDtos.LayoutResponse requestLayout = new SeatCraftLayoutDtos.LayoutResponse();
        requestLayout.setName("新座位图");
        requestLayout.setTemplateType("concert");
        requestLayout.setStageTitle("新舞台");
        requestLayout.setStageX(500);
        requestLayout.setStageY(80);
        requestLayout.setCanvasWidth(1200);
        requestLayout.setCanvasHeight(900);
        requestLayout.setSections(List.of(sectionRequest("floor", "池座", 12, 24)));

        when(userAccessService.requireAdminOrOrganizer(2003L)).thenReturn(user(2003L, "organizer"));
        when(activityMapper.selectById(10L)).thenReturn(activity(10L, 2003L));
        when(activityLayoutMapper.selectOne(any())).thenReturn(existingLayout);
        when(activitySectionMapper.selectList(any())).thenReturn(List.of(oldSection));

        SeatCraftLayoutDtos.LayoutResponse response = service.updateLayout(2003L, 10L, requestLayout);

        assertEquals(88L, response.getId());
        assertEquals("新座位图", response.getName());
        assertEquals("新舞台", response.getStageTitle());
        assertEquals(1, response.getSections().size());
        assertEquals("floor", response.getSections().get(0).getSectionKey());

        ArgumentCaptor<ActivitySeatLayout> layoutCaptor = ArgumentCaptor.forClass(ActivitySeatLayout.class);
        verify(activityLayoutMapper).updateById(layoutCaptor.capture());
        assertEquals(88L, layoutCaptor.getValue().getId());
        assertEquals("新座位图", layoutCaptor.getValue().getName());
        assertEquals(500, layoutCaptor.getValue().getStageX());

        ArgumentCaptor<ActivitySeatLayoutSection> sectionCaptor = ArgumentCaptor.forClass(ActivitySeatLayoutSection.class);
        verify(activitySectionMapper).updateById(sectionCaptor.capture());
        assertEquals(0, sectionCaptor.getValue().getStatus());

        ArgumentCaptor<ActivitySeatLayoutSection> insertCaptor = ArgumentCaptor.forClass(ActivitySeatLayoutSection.class);
        verify(activitySectionMapper).insert(insertCaptor.capture());
        assertEquals("floor", insertCaptor.getValue().getSectionKey());
        assertEquals(1, insertCaptor.getValue().getStatus());
    }

    @Test
    void updateLayoutPersistsBlockLayoutForActivity() {
        ActivitySeatLayout existingLayout = activeLayout(88L, 10L);
        SeatCraftLayoutDtos.LayoutResponse requestLayout = baseLayoutRequest();
        SeatCraftBlockDtos.LayoutRequest blockLayout = new SeatCraftBlockDtos.LayoutRequest();
        requestLayout.setBlockLayout(blockLayout);

        when(userAccessService.requireAdminOrOrganizer(2003L)).thenReturn(user(2003L, "organizer"));
        when(activityMapper.selectById(10L)).thenReturn(activity(10L, 2003L));
        when(activityLayoutMapper.selectOne(any())).thenReturn(existingLayout);
        when(activitySectionMapper.selectList(any())).thenReturn(List.of());

        service.updateLayout(2003L, 10L, requestLayout);

        verify(blockLayoutService).replaceLayout(eq("activity"), eq(10L), same(blockLayout));
    }

    @Test
    void updateLayoutCreatesActivityLayoutWhenMissing() {
        SeatCraftLayoutDtos.LayoutResponse requestLayout = baseLayoutRequest();
        when(userAccessService.requireAdminOrOrganizer(2003L)).thenReturn(user(2003L, "organizer"));
        when(activityMapper.selectById(10L)).thenReturn(activity(10L, 2003L));
        when(activityLayoutMapper.selectOne(any())).thenReturn(null);
        doAnswer(invocation -> {
            ActivitySeatLayout layout = invocation.getArgument(0);
            layout.setId(88L);
            return 1;
        }).when(activityLayoutMapper).insert(any(ActivitySeatLayout.class));
        when(activitySectionMapper.selectList(any())).thenReturn(List.of());

        SeatCraftLayoutDtos.LayoutResponse response = service.updateLayout(2003L, 10L, requestLayout);

        assertEquals(88L, response.getId());
        assertEquals("新座位图", response.getName());
        verify(activityLayoutMapper).insert(argThat(layout -> Long.valueOf(10L).equals(layout.getActivityId())
                && Integer.valueOf(1).equals(layout.getStatus())));
    }

    @Test
    void getLayoutIncludesBlockLayout() {
        ActivitySeatLayout existingLayout = activeLayout(88L, 10L);
        SeatCraftBlockDtos.LayoutRequest blockLayout = new SeatCraftBlockDtos.LayoutRequest();
        when(userAccessService.requireAdminOrOrganizer(2003L)).thenReturn(user(2003L, "organizer"));
        when(activityMapper.selectById(10L)).thenReturn(activity(10L, 2003L));
        when(activityLayoutMapper.selectOne(any())).thenReturn(existingLayout);
        when(activitySectionMapper.selectList(any())).thenReturn(List.of());
        when(blockLayoutService.getLayout("activity", 10L)).thenReturn(blockLayout);

        SeatCraftLayoutDtos.LayoutResponse response = service.getLayout(2003L, 10L);

        assertSame(blockLayout, response.getBlockLayout());
    }

    @Test
    void getLayoutReturnsNullWhenActivityHasNoLayout() {
        when(userAccessService.requireAdminOrOrganizer(2003L)).thenReturn(user(2003L, "organizer"));
        when(activityMapper.selectById(10L)).thenReturn(activity(10L, 2003L));
        when(activityLayoutMapper.selectOne(any())).thenReturn(null);

        SeatCraftLayoutDtos.LayoutResponse response = service.getLayout(2003L, 10L);

        assertEquals(null, response);
    }

    private InternalUserRefResponse user(Long id, String role) {
        InternalUserRefResponse user = new InternalUserRefResponse();
        user.setId(id);
        user.setRole(role);
        return user;
    }

    private Activity activity(Long id, Long organizerId) {
        Activity activity = new Activity();
        activity.setId(id);
        activity.setOrganizerId(organizerId);
        activity.setStatus(1);
        return activity;
    }

    private ActivitySeatLayout activeLayout(Long id, Long activityId) {
        ActivitySeatLayout layout = new ActivitySeatLayout();
        layout.setId(id);
        layout.setActivityId(activityId);
        layout.setStatus(1);
        return layout;
    }

    private VenueDefaultLayout venueLayout(Long id, Long venueId, String templateType) {
        VenueDefaultLayout layout = new VenueDefaultLayout();
        layout.setId(id);
        layout.setVenueId(venueId);
        layout.setName("默认布局");
        layout.setTemplateType(templateType);
        layout.setStageTitle("演出舞台 / STAGE");
        layout.setStageX(500);
        layout.setStageY(50);
        layout.setCanvasWidth(1000);
        layout.setCanvasHeight(800);
        layout.setStatus(1);
        return layout;
    }

    private VenueDefaultLayoutSection venueSection(Long id, String key, String name, Integer rows, Integer cols) {
        VenueDefaultLayoutSection section = new VenueDefaultLayoutSection();
        section.setId(id);
        section.setLayoutId(7L);
        section.setSectionKey(key);
        section.setName(name);
        section.setRows(rows);
        section.setCols(cols);
        section.setX(260);
        section.setY(180);
        section.setColor("#ff1268");
        section.setType("core");
        section.setLayout("grid");
        section.setRotation(0);
        section.setSort(1);
        section.setStatus(1);
        return section;
    }

    private ActivitySeatLayoutSection activitySection(Long id, Long layoutId, String key, String name, Integer rows, Integer cols) {
        ActivitySeatLayoutSection section = new ActivitySeatLayoutSection();
        section.setId(id);
        section.setActivityLayoutId(layoutId);
        section.setSectionKey(key);
        section.setName(name);
        section.setRows(rows);
        section.setCols(cols);
        section.setX(100);
        section.setY(100);
        section.setColor("#999999");
        section.setType("core");
        section.setLayout("grid");
        section.setSort(1);
        section.setStatus(1);
        return section;
    }

    private SeatCraftLayoutDtos.SectionResponse sectionRequest(String key, String name, Integer rows, Integer cols) {
        SeatCraftLayoutDtos.SectionResponse section = new SeatCraftLayoutDtos.SectionResponse();
        section.setSectionKey(key);
        section.setName(name);
        section.setRows(rows);
        section.setCols(cols);
        section.setX(260);
        section.setY(180);
        section.setColor("#ff1268");
        section.setType("core");
        section.setLayout("grid");
        section.setRotation(0);
        return section;
    }

    private SeatCraftLayoutDtos.LayoutResponse baseLayoutRequest() {
        SeatCraftLayoutDtos.LayoutResponse requestLayout = new SeatCraftLayoutDtos.LayoutResponse();
        requestLayout.setName("新座位图");
        requestLayout.setTemplateType("concert");
        requestLayout.setStageTitle("新舞台");
        requestLayout.setStageX(500);
        requestLayout.setStageY(80);
        requestLayout.setCanvasWidth(1200);
        requestLayout.setCanvasHeight(900);
        requestLayout.setSections(List.of());
        return requestLayout;
    }
}
