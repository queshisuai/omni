package com.omni.ticket.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.omni.exception.BusinessException;
import com.omni.ticket.dto.SeatCraftLayoutDtos;
import com.omni.ticket.dto.InternalUserRefResponse;
import com.omni.ticket.entity.*;
import com.omni.ticket.mapper.*;
import com.omni.ticket.service.UserAccessService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class VenueDefaultLayoutService {

    private final VenueDefaultLayoutMapper layoutMapper;
    private final VenueDefaultLayoutSectionMapper sectionMapper;
    private final VenueMapper venueMapper;
    private final UserAccessService userAccessService;
    private final SeatCraftBlockLayoutService blockLayoutService;

    public VenueDefaultLayoutService(VenueDefaultLayoutMapper layoutMapper,
                                       VenueDefaultLayoutSectionMapper sectionMapper,
                                       VenueMapper venueMapper,
                                       UserAccessService userAccessService) {
        this(layoutMapper, sectionMapper, venueMapper, userAccessService, null);
    }

    @Autowired
    public VenueDefaultLayoutService(VenueDefaultLayoutMapper layoutMapper,
                                      VenueDefaultLayoutSectionMapper sectionMapper,
                                      VenueMapper venueMapper,
                                      UserAccessService userAccessService,
                                      SeatCraftBlockLayoutService blockLayoutService) {
        this.layoutMapper = layoutMapper;
        this.sectionMapper = sectionMapper;
        this.venueMapper = venueMapper;
        this.userAccessService = userAccessService;
        this.blockLayoutService = blockLayoutService;
    }

    @Transactional
    public SeatCraftLayoutDtos.LayoutResponse saveLayout(Long userId, Long venueId, SeatCraftLayoutDtos.LayoutResponse request) {
        requireAdminOrOrganizer(userId, venueId);
        boolean hasSections = request != null && request.getSections() != null && !request.getSections().isEmpty();
        boolean hasBlocks = request != null && request.getBlockLayout() != null
                && request.getBlockLayout().getBlocks() != null && !request.getBlockLayout().getBlocks().isEmpty();
        if (!hasSections && !hasBlocks) {
            throw new BusinessException(400, "请至少添加一个座位分区");
        }

        LocalDateTime now = LocalDateTime.now();

        VenueDefaultLayout layout = layoutMapper.selectOne(
                new LambdaQueryWrapper<VenueDefaultLayout>().eq(VenueDefaultLayout::getVenueId, venueId));
        boolean creating = layout == null;
        if (creating) {
            layout = new VenueDefaultLayout();
            layout.setVenueId(venueId);
            layout.setCreateTime(now);
        }
        layout.setName(request.getName() != null ? request.getName() : "默认布局");
        layout.setTemplateType(request.getTemplateType() != null ? request.getTemplateType() : "custom");
        layout.setStageTitle(request.getStageTitle());
        layout.setStageX(request.getStageX());
        layout.setStageY(request.getStageY());
        layout.setCanvasWidth(request.getCanvasWidth());
        layout.setCanvasHeight(request.getCanvasHeight());
        layout.setStatus(1);
        layout.setUpdateTime(now);
        if (creating) {
            layoutMapper.insert(layout);
        } else {
            layoutMapper.updateById(layout);
        }

        if (!creating) {
            List<VenueDefaultLayoutSection> oldSections = sectionMapper.selectList(
                    new LambdaQueryWrapper<VenueDefaultLayoutSection>().eq(VenueDefaultLayoutSection::getLayoutId, layout.getId()));
            for (VenueDefaultLayoutSection old : oldSections) {
                old.setStatus(0);
                old.setUpdateTime(now);
                sectionMapper.updateById(old);
            }
        }

        List<SeatCraftLayoutDtos.SectionResponse> requestSections = request.getSections() == null ? List.of() : request.getSections();
        for (int i = 0; i < requestSections.size(); i++) {
            SeatCraftLayoutDtos.SectionResponse s = requestSections.get(i);
            VenueDefaultLayoutSection section = new VenueDefaultLayoutSection();
            section.setLayoutId(layout.getId());
            section.setSectionKey(s.getSectionKey());
            section.setName(s.getName());
            section.setRows(s.getRows());
            section.setCols(s.getCols());
            section.setX(s.getX());
            section.setY(s.getY());
            section.setColor(s.getColor());
            section.setType(s.getType());
            section.setLayout(s.getLayout());
            section.setRadius(s.getRadius());
            section.setArcSpan(s.getArcSpan());
            section.setRotation(s.getRotation());
            section.setPrimeRowStart(s.getPrimeRowStart());
            section.setPrimeRowEnd(s.getPrimeRowEnd());
            section.setPrimeColStart(s.getPrimeColStart());
            section.setPrimeColEnd(s.getPrimeColEnd());
            section.setSort(s.getSort() != null ? s.getSort() : i);
            section.setStatus(1);
            section.setCreateTime(now);
            section.setUpdateTime(now);
            sectionMapper.insert(section);
        }

        if (hasBlocks && blockLayoutService != null) {
            blockLayoutService.replaceLayout("venue", venueId, request.getBlockLayout());
        }

        return getLayout(venueId);
    }

    public SeatCraftLayoutDtos.LayoutResponse getLayout(Long venueId) {
        VenueDefaultLayout layout = layoutMapper.selectOne(
                new LambdaQueryWrapper<VenueDefaultLayout>()
                        .eq(VenueDefaultLayout::getVenueId, venueId)
                        .eq(VenueDefaultLayout::getStatus, 1));
        if (layout == null) return null;

        List<VenueDefaultLayoutSection> sections = sectionMapper.selectList(
                new LambdaQueryWrapper<VenueDefaultLayoutSection>()
                        .eq(VenueDefaultLayoutSection::getLayoutId, layout.getId())
                        .eq(VenueDefaultLayoutSection::getStatus, 1)
                        .orderByAsc(VenueDefaultLayoutSection::getSort));
        return toLayoutResponse(layout, sections);
    }

    private SeatCraftLayoutDtos.LayoutResponse toLayoutResponse(VenueDefaultLayout layout, List<VenueDefaultLayoutSection> sections) {
        SeatCraftLayoutDtos.LayoutResponse response = new SeatCraftLayoutDtos.LayoutResponse();
        response.setId(layout.getId());
        response.setVenueId(layout.getVenueId());
        response.setName(layout.getName());
        response.setTemplateType(layout.getTemplateType());
        response.setStageTitle(layout.getStageTitle());
        response.setStageX(layout.getStageX());
        response.setStageY(layout.getStageY());
        response.setCanvasWidth(layout.getCanvasWidth());
        response.setCanvasHeight(layout.getCanvasHeight());
        response.setSections(sections.stream().map(this::toSectionResponse).collect(Collectors.toList()));
        if (blockLayoutService != null) {
            response.setBlockLayout(blockLayoutService.getLayout("venue", layout.getVenueId()));
        }
        return response;
    }

    private SeatCraftLayoutDtos.SectionResponse toSectionResponse(VenueDefaultLayoutSection section) {
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

    private void requireAdminOrOrganizer(Long userId, Long venueId) {
        userAccessService.requireAdminOrOrganizer(userId);
        Venue venue = venueMapper.selectById(venueId);
        if (venue == null) {
            throw new BusinessException(404, "场馆不存在");
        }
    }
}
