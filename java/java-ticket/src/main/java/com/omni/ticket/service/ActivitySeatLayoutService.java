package com.omni.ticket.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class ActivitySeatLayoutService {
    private static final String MODE_UNIFIED = "unified";
    private static final String MODE_PER_SESSION = "per_session";

    private final ActivityMapper activityMapper;
    private final UserRefMapper userRefMapper;
    private final VenueSeatLayoutTemplateMapper templateMapper;
    private final VenueSeatLayoutTemplateSectionMapper templateSectionMapper;
    private final ActivitySeatLayoutMapper activityLayoutMapper;
    private final ActivitySeatLayoutSectionMapper activitySectionMapper;

    public ActivitySeatLayoutService(ActivityMapper activityMapper,
                                     UserRefMapper userRefMapper,
                                     VenueSeatLayoutTemplateMapper templateMapper,
                                     VenueSeatLayoutTemplateSectionMapper templateSectionMapper,
                                     ActivitySeatLayoutMapper activityLayoutMapper,
                                     ActivitySeatLayoutSectionMapper activitySectionMapper) {
        this.activityMapper = activityMapper;
        this.userRefMapper = userRefMapper;
        this.templateMapper = templateMapper;
        this.templateSectionMapper = templateSectionMapper;
        this.activityLayoutMapper = activityLayoutMapper;
        this.activitySectionMapper = activitySectionMapper;
    }

    @Transactional
    public SeatCraftLayoutDtos.LayoutResponse copyFromTemplate(Long userId, Long activityId, Long templateId, String layoutMode) {
        String normalizedMode = normalizeLayoutMode(layoutMode);
        Activity activity = requireManageableActivity(userId, activityId);
        VenueSeatLayoutTemplate template = requireTemplate(templateId);
        List<VenueSeatLayoutTemplateSection> templateSections = templateSectionMapper.selectList(new LambdaQueryWrapper<VenueSeatLayoutTemplateSection>()
                .eq(VenueSeatLayoutTemplateSection::getTemplateId, templateId)
                .eq(VenueSeatLayoutTemplateSection::getStatus, 1)
                .orderByAsc(VenueSeatLayoutTemplateSection::getSort)
                .orderByAsc(VenueSeatLayoutTemplateSection::getId));

        LocalDateTime now = LocalDateTime.now();
        disableActiveLayouts(activity.getId(), now);

        ActivitySeatLayout layout = new ActivitySeatLayout();
        layout.setActivityId(activity.getId());
        layout.setSourceTemplateId(template.getId());
        layout.setLayoutMode(normalizedMode);
        layout.setName(template.getName());
        layout.setTemplateType(template.getTemplateType());
        layout.setStageTitle(template.getStageTitle());
        layout.setStageX(template.getStageX());
        layout.setStageY(template.getStageY());
        layout.setCanvasWidth(template.getCanvasWidth());
        layout.setCanvasHeight(template.getCanvasHeight());
        layout.setStatus(1);
        layout.setCreateTime(now);
        layout.setUpdateTime(now);
        activityLayoutMapper.insert(layout);

        List<ActivitySeatLayoutSection> sections = templateSections.stream()
                .map(section -> copySection(layout.getId(), section, now))
                .collect(Collectors.toList());
        sections.forEach(activitySectionMapper::insert);

        return toLayoutResponse(layout, sections);
    }

    public SeatCraftLayoutDtos.LayoutResponse getLayout(Long userId, Long activityId) {
        requireManageableActivity(userId, activityId);
        ActivitySeatLayout layout = activityLayoutMapper.selectOne(new LambdaQueryWrapper<ActivitySeatLayout>()
                .eq(ActivitySeatLayout::getActivityId, activityId)
                .eq(ActivitySeatLayout::getStatus, 1)
                .orderByDesc(ActivitySeatLayout::getId)
                .last("LIMIT 1"));
        if (layout == null) {
            throw new BusinessException(404, "活动座位图不存在");
        }
        List<ActivitySeatLayoutSection> sections = activitySectionMapper.selectList(new LambdaQueryWrapper<ActivitySeatLayoutSection>()
                .eq(ActivitySeatLayoutSection::getActivityLayoutId, layout.getId())
                .eq(ActivitySeatLayoutSection::getStatus, 1)
                .orderByAsc(ActivitySeatLayoutSection::getSort)
                .orderByAsc(ActivitySeatLayoutSection::getId));
        return toLayoutResponse(layout, sections);
    }

    @Transactional
    public SeatCraftLayoutDtos.LayoutResponse updateLayout(Long userId, Long activityId, SeatCraftLayoutDtos.LayoutResponse request) {
        requireManageableActivity(userId, activityId);
        if (request == null) {
            throw new BusinessException(400, "座位图参数不能为空");
        }
        ActivitySeatLayout layout = activityLayoutMapper.selectOne(new LambdaQueryWrapper<ActivitySeatLayout>()
                .eq(ActivitySeatLayout::getActivityId, activityId)
                .eq(ActivitySeatLayout::getStatus, 1)
                .orderByDesc(ActivitySeatLayout::getId)
                .last("LIMIT 1"));
        if (layout == null) {
            throw new BusinessException(404, "活动座位图不存在");
        }

        LocalDateTime now = LocalDateTime.now();
        layout.setName(requireText(request.getName(), "座位图名称不能为空"));
        layout.setTemplateType(requireText(request.getTemplateType(), "座位图类型不能为空"));
        layout.setLayoutMode(normalizeLayoutMode(request.getLayoutMode()));
        layout.setStageTitle(requireText(request.getStageTitle(), "舞台名称不能为空"));
        layout.setStageX(requireNumber(request.getStageX(), "舞台X坐标不能为空"));
        layout.setStageY(requireNumber(request.getStageY(), "舞台Y坐标不能为空"));
        layout.setCanvasWidth(requireNumber(request.getCanvasWidth(), "画布宽度不能为空"));
        layout.setCanvasHeight(requireNumber(request.getCanvasHeight(), "画布高度不能为空"));
        layout.setUpdateTime(now);
        activityLayoutMapper.updateById(layout);

        disableSections(layout.getId(), now);
        List<ActivitySeatLayoutSection> sections = request.getSections().stream()
                .map(section -> buildSection(layout.getId(), section, now))
                .collect(Collectors.toList());
        sections.forEach(activitySectionMapper::insert);
        return toLayoutResponse(layout, sections);
    }

    private void disableActiveLayouts(Long activityId, LocalDateTime now) {
        List<ActivitySeatLayout> activeLayouts = activityLayoutMapper.selectList(new LambdaQueryWrapper<ActivitySeatLayout>()
                .eq(ActivitySeatLayout::getActivityId, activityId)
                .eq(ActivitySeatLayout::getStatus, 1));
        activeLayouts.forEach(layout -> {
            layout.setStatus(0);
            layout.setUpdateTime(now);
            activityLayoutMapper.updateById(layout);
        });
    }

    private void disableSections(Long activityLayoutId, LocalDateTime now) {
        List<ActivitySeatLayoutSection> sections = activitySectionMapper.selectList(new LambdaQueryWrapper<ActivitySeatLayoutSection>()
                .eq(ActivitySeatLayoutSection::getActivityLayoutId, activityLayoutId)
                .eq(ActivitySeatLayoutSection::getStatus, 1));
        sections.forEach(section -> {
            section.setStatus(0);
            section.setUpdateTime(now);
            activitySectionMapper.updateById(section);
        });
    }

    private ActivitySeatLayoutSection buildSection(Long activityLayoutId, SeatCraftLayoutDtos.SectionResponse request, LocalDateTime now) {
        if (request == null) {
            throw new BusinessException(400, "座位图分区不能为空");
        }
        ActivitySeatLayoutSection section = new ActivitySeatLayoutSection();
        section.setActivityLayoutId(activityLayoutId);
        section.setSectionKey(requireText(request.getSectionKey(), "分区标识不能为空"));
        section.setName(requireText(request.getName(), "分区名称不能为空"));
        section.setRows(requirePositive(request.getRows(), "分区排数不正确"));
        section.setCols(requirePositive(request.getCols(), "分区座数不正确"));
        section.setX(requireNumber(request.getX(), "分区X坐标不能为空"));
        section.setY(requireNumber(request.getY(), "分区Y坐标不能为空"));
        section.setColor(requireText(request.getColor(), "分区颜色不能为空"));
        section.setType(requireText(request.getType(), "分区类型不能为空"));
        section.setLayout(requireText(request.getLayout(), "分区布局不能为空"));
        section.setRadius(request.getRadius());
        section.setArcSpan(request.getArcSpan());
        section.setRotation(request.getRotation());
        section.setPrimeRowStart(request.getPrimeRowStart());
        section.setPrimeRowEnd(request.getPrimeRowEnd());
        section.setPrimeColStart(request.getPrimeColStart());
        section.setPrimeColEnd(request.getPrimeColEnd());
        section.setSort(0);
        section.setStatus(1);
        section.setCreateTime(now);
        section.setUpdateTime(now);
        return section;
    }

    private ActivitySeatLayoutSection copySection(Long activityLayoutId, VenueSeatLayoutTemplateSection source, LocalDateTime now) {
        ActivitySeatLayoutSection section = new ActivitySeatLayoutSection();
        section.setActivityLayoutId(activityLayoutId);
        section.setSourceTemplateSectionId(source.getId());
        section.setSectionKey(source.getSectionKey());
        section.setName(source.getName());
        section.setRows(source.getRows());
        section.setCols(source.getCols());
        section.setX(source.getX());
        section.setY(source.getY());
        section.setColor(source.getColor());
        section.setType(source.getType());
        section.setLayout(source.getLayout());
        section.setRadius(source.getRadius());
        section.setArcSpan(source.getArcSpan());
        section.setRotation(source.getRotation());
        section.setPrimeRowStart(source.getPrimeRowStart());
        section.setPrimeRowEnd(source.getPrimeRowEnd());
        section.setPrimeColStart(source.getPrimeColStart());
        section.setPrimeColEnd(source.getPrimeColEnd());
        section.setSort(source.getSort());
        section.setStatus(1);
        section.setCreateTime(now);
        section.setUpdateTime(now);
        return section;
    }

    private SeatCraftLayoutDtos.LayoutResponse toLayoutResponse(ActivitySeatLayout layout, List<ActivitySeatLayoutSection> sections) {
        SeatCraftLayoutDtos.LayoutResponse response = new SeatCraftLayoutDtos.LayoutResponse();
        response.setId(layout.getId());
        response.setActivityId(layout.getActivityId());
        response.setLayoutMode(layout.getLayoutMode());
        response.setName(layout.getName());
        response.setTemplateType(layout.getTemplateType());
        response.setStageTitle(layout.getStageTitle());
        response.setStageX(layout.getStageX());
        response.setStageY(layout.getStageY());
        response.setCanvasWidth(layout.getCanvasWidth());
        response.setCanvasHeight(layout.getCanvasHeight());
        response.setSections(sections.stream().map(this::toSectionResponse).collect(Collectors.toList()));
        return response;
    }

    private SeatCraftLayoutDtos.SectionResponse toSectionResponse(ActivitySeatLayoutSection section) {
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
        return response;
    }

    private String normalizeLayoutMode(String layoutMode) {
        String value = layoutMode == null ? MODE_UNIFIED : layoutMode;
        if (!MODE_UNIFIED.equals(value) && !MODE_PER_SESSION.equals(value)) {
            throw new BusinessException(400, "座位图模式不正确");
        }
        return value;
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

    private Activity requireManageableActivity(Long userId, Long activityId) {
        UserRef user = userRefMapper.selectById(userId);
        if (user == null || (!"admin".equals(user.getRole()) && !"organizer".equals(user.getRole()))) {
            throw new BusinessException(403, "无权限");
        }
        Activity activity = activityMapper.selectById(activityId);
        if (activity == null) {
            throw new BusinessException(404, "活动不存在");
        }
        if ("organizer".equals(user.getRole()) && !userId.equals(activity.getOrganizerId())) {
            throw new BusinessException(403, "只能操作自己主办的活动");
        }
        return activity;
    }

    private VenueSeatLayoutTemplate requireTemplate(Long templateId) {
        VenueSeatLayoutTemplate template = templateMapper.selectById(templateId);
        if (template == null || !Integer.valueOf(1).equals(template.getStatus())) {
            throw new BusinessException(404, "座位图模板不存在");
        }
        return template;
    }
}
