package com.omni.ticket.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.omni.exception.BusinessException;
import com.omni.ticket.dto.SeatCraftBlockDtos;
import com.omni.ticket.dto.SeatCraftLayoutDtos;
import com.omni.ticket.entity.Activity;
import com.omni.ticket.entity.ActivitySeatLayout;
import com.omni.ticket.entity.ActivitySeatLayoutSection;
import com.omni.ticket.dto.InternalUserRefResponse;
import com.omni.ticket.entity.VenueApplication;
import com.omni.ticket.entity.VenueDefaultLayout;
import com.omni.ticket.entity.VenueDefaultLayoutSection;
import com.omni.ticket.mapper.ActivityMapper;
import com.omni.ticket.mapper.ActivitySeatLayoutMapper;
import com.omni.ticket.mapper.ActivitySeatLayoutSectionMapper;
import com.omni.ticket.mapper.VenueApplicationMapper;
import com.omni.ticket.service.UserAccessService;
import com.omni.ticket.mapper.VenueDefaultLayoutMapper;
import com.omni.ticket.mapper.VenueDefaultLayoutSectionMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class ActivitySeatLayoutService {

    private final ActivityMapper activityMapper;
    private final UserAccessService userAccessService;
    private final VenueDefaultLayoutMapper venueDefaultLayoutMapper;
    private final VenueDefaultLayoutSectionMapper venueSectionMapper;
    private final ActivitySeatLayoutMapper activityLayoutMapper;
    private final ActivitySeatLayoutSectionMapper activitySectionMapper;
    private final SeatCraftBlockLayoutService blockLayoutService;
    private final VenueApplicationMapper venueApplicationMapper;

    public ActivitySeatLayoutService(ActivityMapper activityMapper,
                                      UserAccessService userAccessService,
                                      VenueDefaultLayoutMapper venueDefaultLayoutMapper,
                                      VenueDefaultLayoutSectionMapper venueSectionMapper,
                                      ActivitySeatLayoutMapper activityLayoutMapper,
                                      ActivitySeatLayoutSectionMapper activitySectionMapper) {
        this(activityMapper, userAccessService, venueDefaultLayoutMapper, venueSectionMapper,
                activityLayoutMapper, activitySectionMapper, null, null);
    }

    public ActivitySeatLayoutService(ActivityMapper activityMapper,
                                     UserAccessService userAccessService,
                                     VenueDefaultLayoutMapper venueDefaultLayoutMapper,
                                     VenueDefaultLayoutSectionMapper venueSectionMapper,
                                     ActivitySeatLayoutMapper activityLayoutMapper,
                                     ActivitySeatLayoutSectionMapper activitySectionMapper,
                                     SeatCraftBlockLayoutService blockLayoutService) {
        this(activityMapper, userAccessService, venueDefaultLayoutMapper, venueSectionMapper,
                activityLayoutMapper, activitySectionMapper, blockLayoutService, null);
    }

    @Autowired
    public ActivitySeatLayoutService(ActivityMapper activityMapper,
                                     UserAccessService userAccessService,
                                     VenueDefaultLayoutMapper venueDefaultLayoutMapper,
                                     VenueDefaultLayoutSectionMapper venueSectionMapper,
                                     ActivitySeatLayoutMapper activityLayoutMapper,
                                     ActivitySeatLayoutSectionMapper activitySectionMapper,
                                     SeatCraftBlockLayoutService blockLayoutService,
                                     VenueApplicationMapper venueApplicationMapper) {
        this.activityMapper = activityMapper;
        this.userAccessService = userAccessService;
        this.venueDefaultLayoutMapper = venueDefaultLayoutMapper;
        this.venueSectionMapper = venueSectionMapper;
        this.activityLayoutMapper = activityLayoutMapper;
        this.activitySectionMapper = activitySectionMapper;
        this.blockLayoutService = blockLayoutService;
        this.venueApplicationMapper = venueApplicationMapper;
    }

    @Transactional
    public SeatCraftLayoutDtos.LayoutResponse createFromVenueDefault(Long userId, Long activityId, Long venueLayoutId) {
        Activity activity = requireManageableActivity(userId, activityId);
        VenueDefaultLayout venueLayout = venueDefaultLayoutMapper.selectById(venueLayoutId);
        if (venueLayout == null || !Integer.valueOf(1).equals(venueLayout.getStatus())) {
            throw new BusinessException(404, "历史地点模板不存在");
        }
        List<VenueDefaultLayoutSection> venueSections = venueSectionMapper.selectList(new LambdaQueryWrapper<VenueDefaultLayoutSection>()
                .eq(VenueDefaultLayoutSection::getLayoutId, venueLayoutId)
                .eq(VenueDefaultLayoutSection::getStatus, 1)
                .orderByAsc(VenueDefaultLayoutSection::getSort)
                .orderByAsc(VenueDefaultLayoutSection::getId));

        LocalDateTime now = LocalDateTime.now();
        disableActiveLayouts(activity.getId(), now);
        ActivitySeatLayout layout = new ActivitySeatLayout();
        layout.setActivityId(activity.getId());
        layout.setSourceVenueLayoutId(venueLayout.getId());
        layout.setName(venueLayout.getName());
        layout.setTemplateType(venueLayout.getTemplateType());
        layout.setStageTitle(venueLayout.getStageTitle());
        layout.setStageX(venueLayout.getStageX());
        layout.setStageY(venueLayout.getStageY());
        layout.setCanvasWidth(venueLayout.getCanvasWidth());
        layout.setCanvasHeight(venueLayout.getCanvasHeight());
        layout.setStatus(1);
        layout.setCreateTime(now);
        layout.setUpdateTime(now);
        activityLayoutMapper.insert(layout);
        List<ActivitySeatLayoutSection> sections = venueSections.stream()
                .map(section -> copySection(layout.getId(), section, now))
                .collect(Collectors.toList());
        sections.forEach(activitySectionMapper::insert);
        if (blockLayoutService != null) {
            SeatCraftBlockDtos.LayoutRequest blockLayout = blockLayoutService.getLayout("venue", venueLayout.getVenueId());
            if (blockLayout != null) {
                blockLayoutService.replaceLayout("activity", activity.getId(), blockLayout);
            }
        }

        return toLayoutResponse(layout, sections);
    }

    @Transactional
    public SeatCraftLayoutDtos.LayoutResponse copyFromVenueApplication(Long userId, Long activityId, Long venueApplicationId) {
        Activity activity = requireManageableActivity(userId, activityId);
        if (venueApplicationMapper != null) {
            VenueApplication application = venueApplicationMapper.selectById(venueApplicationId);
            if (application == null || !Integer.valueOf(1).equals(application.getStatus())) {
                throw new BusinessException(404, "场馆审核资料未通过");
            }
        }
        LocalDateTime now = LocalDateTime.now();
        disableActiveLayouts(activity.getId(), now);
        ActivitySeatLayout layout = new ActivitySeatLayout();
        layout.setActivityId(activity.getId());
        layout.setName(defaultText(activity.getName(), "活动座位图"));
        layout.setTemplateType("concert");
        layout.setStageTitle("舞台");
        layout.setStageX(0);
        layout.setStageY(0);
        layout.setCanvasWidth(800);
        layout.setCanvasHeight(600);
        layout.setStatus(1);
        layout.setCreateTime(now);
        layout.setUpdateTime(now);
        activityLayoutMapper.insert(layout);
        if (blockLayoutService != null) {
            SeatCraftBlockDtos.LayoutRequest blockLayout = blockLayoutService.getLayout("venue_application", venueApplicationId);
            if (blockLayout == null) {
                throw new BusinessException(400, "场馆审核资料缺少SeatCraft座位图");
            }
            blockLayoutService.replaceLayout("activity", activity.getId(), blockLayout);
        }
        return toLayoutResponse(layout, java.util.Collections.emptyList());
    }

    public boolean hasBlockLayout(String ownerType, Long ownerId) {
        return blockLayoutService != null && blockLayoutService.getLayout(ownerType, ownerId) != null;
    }

    @Transactional
    public SeatCraftLayoutDtos.LayoutResponse copyFromSeatCraftOwner(Long userId, Long activityId,
                                                                      String sourceOwnerType, Long sourceOwnerId) {
        Activity activity = requireManageableActivity(userId, activityId);
        if (blockLayoutService == null) {
            throw new BusinessException(500, "SeatCraft服务暂不可用");
        }
        SeatCraftBlockDtos.LayoutRequest blockLayout = blockLayoutService.getLayout(sourceOwnerType, sourceOwnerId);
        if (blockLayout == null) {
            throw new BusinessException(400, "SeatCraft座位图不存在");
        }
        LocalDateTime now = LocalDateTime.now();
        disableActiveLayouts(activity.getId(), now);
        ActivitySeatLayout layout = new ActivitySeatLayout();
        layout.setActivityId(activity.getId());
        layout.setName(defaultText(blockLayout.getName(), defaultText(activity.getName(), "活动SeatCraft座位图")));
        layout.setTemplateType(defaultText(blockLayout.getTemplateType(), "concert"));
        layout.setStageTitle(defaultText(blockLayout.getStageTitle(), "舞台"));
        layout.setStageX(blockLayout.getStageX() == null ? 0 : blockLayout.getStageX());
        layout.setStageY(blockLayout.getStageY() == null ? 0 : blockLayout.getStageY());
        layout.setCanvasWidth(blockLayout.getCanvasWidth() == null ? 800 : blockLayout.getCanvasWidth());
        layout.setCanvasHeight(blockLayout.getCanvasHeight() == null ? 600 : blockLayout.getCanvasHeight());
        layout.setStatus(1);
        layout.setCreateTime(now);
        layout.setUpdateTime(now);
        activityLayoutMapper.insert(layout);
        blockLayoutService.replaceLayout("activity", activity.getId(), blockLayout);
        return toLayoutResponse(layout, java.util.Collections.emptyList());
    }

    @Transactional
    public SeatCraftLayoutDtos.LayoutResponse createBlankLayout(Long userId, Long activityId) {
        Activity activity = requireManageableActivity(userId, activityId);
        LocalDateTime now = LocalDateTime.now();
        disableActiveLayouts(activity.getId(), now);

        ActivitySeatLayout layout = new ActivitySeatLayout();
        layout.setActivityId(activity.getId());
        layout.setName(defaultText(activity.getName(), "活动座位图"));
        layout.setTemplateType("concert");
        layout.setStageTitle("舞台");
        layout.setStageX(0);
        layout.setStageY(0);
        layout.setCanvasWidth(800);
        layout.setCanvasHeight(600);
        layout.setStatus(1);
        layout.setCreateTime(now);
        layout.setUpdateTime(now);
        activityLayoutMapper.insert(layout);

        return toLayoutResponse(layout, java.util.Collections.emptyList());
    }

    public SeatCraftLayoutDtos.LayoutResponse getLayout(Long userId, Long activityId) {
        requireManageableActivity(userId, activityId);
        ActivitySeatLayout layout = activityLayoutMapper.selectOne(new LambdaQueryWrapper<ActivitySeatLayout>()
                .eq(ActivitySeatLayout::getActivityId, activityId)
                .eq(ActivitySeatLayout::getStatus, 1)
                .orderByDesc(ActivitySeatLayout::getId)
                .last("LIMIT 1"));
        if (layout == null) {
            return null;
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
            layout = new ActivitySeatLayout();
            layout.setActivityId(activityId);
            layout.setStatus(1);
            layout.setCreateTime(LocalDateTime.now());
        }

        LocalDateTime now = LocalDateTime.now();
        layout.setName(requireText(request.getName(), "座位图名称不能为空"));
        layout.setTemplateType(requireText(request.getTemplateType(), "座位图类型不能为空"));
        layout.setStageTitle(requireText(request.getStageTitle(), "舞台名称不能为空"));
        layout.setStageX(requireNumber(request.getStageX(), "舞台X坐标不能为空"));
        layout.setStageY(requireNumber(request.getStageY(), "舞台Y坐标不能为空"));
        layout.setCanvasWidth(requireNumber(request.getCanvasWidth(), "画布宽度不能为空"));
        layout.setCanvasHeight(requireNumber(request.getCanvasHeight(), "画布高度不能为空"));
        layout.setUpdateTime(now);
        if (layout.getId() == null) {
            activityLayoutMapper.insert(layout);
        } else {
            activityLayoutMapper.updateById(layout);
        }

        Long layoutId = layout.getId();
        disableSections(layoutId, now);
        List<ActivitySeatLayoutSection> sections = request.getSections().stream()
                .map(section -> buildSection(layoutId, section, now))
                .collect(Collectors.toList());
        sections.forEach(activitySectionMapper::insert);
        if (request.getBlockLayout() != null && blockLayoutService != null) {
            blockLayoutService.replaceLayout("activity", activityId, request.getBlockLayout());
        }
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

    private ActivitySeatLayoutSection copySection(Long activityLayoutId, VenueDefaultLayoutSection source, LocalDateTime now) {
        ActivitySeatLayoutSection section = new ActivitySeatLayoutSection();
        section.setActivityLayoutId(activityLayoutId);
        section.setSourceTemplateSectionId(null);
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
        response.setName(layout.getName());
        response.setTemplateType(layout.getTemplateType());
        response.setStageTitle(layout.getStageTitle());
        response.setStageX(layout.getStageX());
        response.setStageY(layout.getStageY());
        response.setCanvasWidth(layout.getCanvasWidth());
        response.setCanvasHeight(layout.getCanvasHeight());
        response.setSections(sections.stream().map(this::toSectionResponse).collect(Collectors.toList()));
        if (blockLayoutService != null) {
            response.setBlockLayout(blockLayoutService.getLayout("activity", layout.getActivityId()));
        }
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

    private String requireText(String value, String message) {
        if (value == null || value.trim().isEmpty()) {
            throw new BusinessException(400, message);
        }
        return value.trim();
    }

    private String defaultText(String value, String fallback) {
        return value == null || value.trim().isEmpty() ? fallback : value.trim();
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
        InternalUserRefResponse user = userAccessService.requireAdminOrOrganizer(userId);
        String role = user.getRole();
        Activity activity = activityMapper.selectById(activityId);
        if (activity == null) {
            throw new BusinessException(404, "活动不存在");
        }
        if ("organizer".equals(role) && !userId.equals(activity.getOrganizerId())) {
            throw new BusinessException(403, "只能操作自己主办的活动");
        }
        return activity;
    }
}
