package com.omni.ticket.service;

import com.omni.exception.BusinessException;
import com.omni.ticket.dto.SeatCraftLayoutDtos;
import com.omni.ticket.entity.Activity;
import com.omni.ticket.entity.ActivitySeatLayout;
import com.omni.ticket.entity.ActivitySeatLayoutSection;
import com.omni.ticket.entity.UserRef;
import com.omni.ticket.entity.VenueSeatLayoutTemplate;
import com.omni.ticket.entity.VenueSeatLayoutTemplateSection;
import com.omni.ticket.mapper.ActivityMapper;
import com.omni.ticket.mapper.ActivitySeatLayoutMapper;
import com.omni.ticket.mapper.ActivitySeatLayoutSectionMapper;
import com.omni.ticket.mapper.UserRefMapper;
import com.omni.ticket.mapper.VenueSeatLayoutTemplateMapper;
import com.omni.ticket.mapper.VenueSeatLayoutTemplateSectionMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ActivitySeatLayoutServiceTest {

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

    private ActivitySeatLayoutService service;

    @BeforeEach
    void setUp() {
        service = new ActivitySeatLayoutService(activityMapper, userRefMapper, templateMapper, templateSectionMapper,
                activityLayoutMapper, activitySectionMapper);
    }

    @Test
    void organizerCopiesTemplateToOwnActivityLayout() {
        when(userRefMapper.selectById(2003L)).thenReturn(user(2003L, "organizer"));
        when(activityMapper.selectById(10L)).thenReturn(activity(10L, 2003L));
        when(templateMapper.selectById(7L)).thenReturn(template(7L, 1L, "concert"));
        when(activityLayoutMapper.selectList(any())).thenReturn(List.of());
        when(templateSectionMapper.selectList(any())).thenReturn(List.of(section(70L, "floor", "池座内场", 12, 24)));

        SeatCraftLayoutDtos.LayoutResponse layout = service.copyFromTemplate(2003L, 10L, 7L, "unified");

        assertEquals(10L, layout.getActivityId());
        assertEquals("unified", layout.getLayoutMode());
        assertEquals(1, layout.getSections().size());

        ArgumentCaptor<ActivitySeatLayout> layoutCaptor = ArgumentCaptor.forClass(ActivitySeatLayout.class);
        verify(activityLayoutMapper).insert(layoutCaptor.capture());
        assertEquals(10L, layoutCaptor.getValue().getActivityId());
        assertEquals("unified", layoutCaptor.getValue().getLayoutMode());

        ArgumentCaptor<ActivitySeatLayoutSection> sectionCaptor = ArgumentCaptor.forClass(ActivitySeatLayoutSection.class);
        verify(activitySectionMapper).insert(sectionCaptor.capture());
        assertEquals("floor", sectionCaptor.getValue().getSectionKey());
        assertEquals(70L, sectionCaptor.getValue().getSourceTemplateSectionId());
    }

    @Test
    void copyFromTemplateDisablesExistingActiveLayoutsBeforeInsertingNewLayout() {
        ActivitySeatLayout oldLayout = activeLayout(99L, 10L);
        when(userRefMapper.selectById(2003L)).thenReturn(user(2003L, "organizer"));
        when(activityMapper.selectById(10L)).thenReturn(activity(10L, 2003L));
        when(templateMapper.selectById(7L)).thenReturn(template(7L, 1L, "concert"));
        when(activityLayoutMapper.selectList(any())).thenReturn(List.of(oldLayout));
        when(templateSectionMapper.selectList(any())).thenReturn(List.of(section(70L, "floor", "池座内场", 12, 24)));

        SeatCraftLayoutDtos.LayoutResponse layout = service.copyFromTemplate(2003L, 10L, 7L, "unified");

        assertEquals(10L, layout.getActivityId());
        assertEquals("unified", layout.getLayoutMode());

        ArgumentCaptor<ActivitySeatLayout> updateCaptor = ArgumentCaptor.forClass(ActivitySeatLayout.class);
        verify(activityLayoutMapper).updateById(updateCaptor.capture());
        assertEquals(99L, updateCaptor.getValue().getId());
        assertEquals(0, updateCaptor.getValue().getStatus());

        verify(activityLayoutMapper).insert(any(ActivitySeatLayout.class));
    }

    @Test
    void copyFromTemplateDisablesAllExistingActiveLayoutsAndInsertsOneActiveLayout() {
        ActivitySeatLayout firstOldLayout = activeLayout(99L, 10L);
        ActivitySeatLayout secondOldLayout = activeLayout(100L, 10L);
        when(userRefMapper.selectById(2003L)).thenReturn(user(2003L, "organizer"));
        when(activityMapper.selectById(10L)).thenReturn(activity(10L, 2003L));
        when(templateMapper.selectById(7L)).thenReturn(template(7L, 1L, "concert"));
        when(activityLayoutMapper.selectList(any())).thenReturn(List.of(firstOldLayout, secondOldLayout));
        when(templateSectionMapper.selectList(any())).thenReturn(List.of(section(70L, "floor", "池座内场", 12, 24)));

        service.copyFromTemplate(2003L, 10L, 7L, "unified");

        ArgumentCaptor<ActivitySeatLayout> updateCaptor = ArgumentCaptor.forClass(ActivitySeatLayout.class);
        verify(activityLayoutMapper, times(2)).updateById(updateCaptor.capture());
        assertEquals(List.of(99L, 100L), updateCaptor.getAllValues().stream().map(ActivitySeatLayout::getId).toList());
        assertEquals(List.of(0, 0), updateCaptor.getAllValues().stream().map(ActivitySeatLayout::getStatus).toList());

        ArgumentCaptor<ActivitySeatLayout> insertCaptor = ArgumentCaptor.forClass(ActivitySeatLayout.class);
        verify(activityLayoutMapper).insert(insertCaptor.capture());
        assertEquals(1, insertCaptor.getValue().getStatus());
    }

    @Test
    void organizerCannotCopyTemplateToOthersActivity() {
        when(userRefMapper.selectById(2003L)).thenReturn(user(2003L, "organizer"));
        when(activityMapper.selectById(10L)).thenReturn(activity(10L, 9999L));

        BusinessException error = assertThrows(BusinessException.class,
                () -> service.copyFromTemplate(2003L, 10L, 7L, "unified"));

        assertEquals(403, error.getCode());
        verify(activityLayoutMapper, never()).insert(any());
        verify(activitySectionMapper, never()).insert(any());
    }

    @Test
    void updateLayoutReplacesExistingSectionsWithRequestSections() {
        ActivitySeatLayout existingLayout = activeLayout(88L, 10L);
        existingLayout.setLayoutMode("unified");
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
        requestLayout.setLayoutMode("unified");
        requestLayout.setSections(List.of(sectionRequest("floor", "池座", 12, 24)));

        when(userRefMapper.selectById(2003L)).thenReturn(user(2003L, "organizer"));
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

    private VenueSeatLayoutTemplate template(Long id, Long venueId, String templateType) {
        VenueSeatLayoutTemplate template = new VenueSeatLayoutTemplate();
        template.setId(id);
        template.setVenueId(venueId);
        template.setName("默认模板");
        template.setTemplateType(templateType);
        template.setStageTitle("演出舞台 / STAGE");
        template.setStageX(500);
        template.setStageY(50);
        template.setCanvasWidth(1000);
        template.setCanvasHeight(800);
        template.setStatus(1);
        return template;
    }

    private VenueSeatLayoutTemplateSection section(Long id, String key, String name, Integer rows, Integer cols) {
        VenueSeatLayoutTemplateSection section = new VenueSeatLayoutTemplateSection();
        section.setId(id);
        section.setTemplateId(7L);
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
}
