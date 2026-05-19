package com.omni.ticket.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.omni.exception.BusinessException;
import com.omni.ticket.dto.SeatCraftLayoutDtos;
import com.omni.ticket.entity.UserRef;
import com.omni.ticket.entity.Venue;
import com.omni.ticket.entity.VenueSeatLayoutTemplate;
import com.omni.ticket.entity.VenueSeatLayoutTemplateSection;
import com.omni.ticket.mapper.UserRefMapper;
import com.omni.ticket.mapper.VenueMapper;
import com.omni.ticket.mapper.VenueSeatLayoutTemplateMapper;
import com.omni.ticket.mapper.VenueSeatLayoutTemplateSectionMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class SeatCraftTemplateService {
    private static final String DEFAULT_STAGE_TITLE = "演出舞台 / STAGE";

    private final VenueMapper venueMapper;
    private final UserRefMapper userRefMapper;
    private final VenueSeatLayoutTemplateMapper templateMapper;
    private final VenueSeatLayoutTemplateSectionMapper sectionMapper;

    public SeatCraftTemplateService(VenueMapper venueMapper,
                                    UserRefMapper userRefMapper,
                                    VenueSeatLayoutTemplateMapper templateMapper,
                                    VenueSeatLayoutTemplateSectionMapper sectionMapper) {
        this.venueMapper = venueMapper;
        this.userRefMapper = userRefMapper;
        this.templateMapper = templateMapper;
        this.sectionMapper = sectionMapper;
    }

    @Transactional
    public List<VenueSeatLayoutTemplate> ensureDefaults(Long userId, Long venueId) {
        requireAdmin(userId);
        requireActiveVenue(venueId);
        List<VenueSeatLayoutTemplate> existing = findTemplates(venueId);
        if (!existing.isEmpty()) {
            return existing;
        }

        List<VenueSeatLayoutTemplate> templates = new ArrayList<>();
        VenueSeatLayoutTemplate concert = createTemplate(venueId, "演唱会默认模板", "concert");
        templates.add(concert);
        createSection(concert.getId(), "floor", "池座内场", 12, 24, 260, 180, "#ff1268", "core", "grid", null, null, 0, null, null, null, null, 1);
        createSection(concert.getId(), "stands", "环绕看台", 8, 48, 180, 420, "#7c3aed", "stand", "curved", 300, 180, 180, null, null, null, null, 2);

        VenueSeatLayoutTemplate cinema = createTemplate(venueId, "影院默认模板", "cinema");
        templates.add(cinema);
        createSection(cinema.getId(), "cinema-main", "观影大厅", 15, 30, 180, 180, "#0ea5e9", "core", "grid", null, null, 0, 6, 11, 11, 21, 1);

        templates.add(createTemplate(venueId, "自定义空白模板", "custom"));
        return templates;
    }

    public List<SeatCraftLayoutDtos.LayoutResponse> listTemplates(Long userId, Long venueId) {
        requireConsoleUser(userId);
        requireVenue(venueId);
        List<VenueSeatLayoutTemplate> templates = findTemplates(venueId);
        if (templates.isEmpty()) {
            return List.of();
        }
        List<Long> templateIds = templates.stream().map(VenueSeatLayoutTemplate::getId).collect(Collectors.toList());
        Map<Long, List<VenueSeatLayoutTemplateSection>> sectionsByTemplateId = sectionMapper.selectList(new LambdaQueryWrapper<VenueSeatLayoutTemplateSection>()
                        .in(VenueSeatLayoutTemplateSection::getTemplateId, templateIds)
                        .eq(VenueSeatLayoutTemplateSection::getStatus, 1)
                        .orderByAsc(VenueSeatLayoutTemplateSection::getSort)
                        .orderByAsc(VenueSeatLayoutTemplateSection::getId))
                .stream()
                .collect(Collectors.groupingBy(VenueSeatLayoutTemplateSection::getTemplateId));

        return templates.stream()
                .map(template -> toLayoutResponse(template, sectionsByTemplateId.getOrDefault(template.getId(), List.of())))
                .collect(Collectors.toList());
    }

    private VenueSeatLayoutTemplate createTemplate(Long venueId, String name, String templateType) {
        LocalDateTime now = LocalDateTime.now();
        VenueSeatLayoutTemplate template = new VenueSeatLayoutTemplate();
        template.setVenueId(venueId);
        template.setName(name);
        template.setTemplateType(templateType);
        template.setStageTitle(DEFAULT_STAGE_TITLE);
        template.setStageX(500);
        template.setStageY(50);
        template.setCanvasWidth(1000);
        template.setCanvasHeight(800);
        template.setStatus(1);
        template.setCreateTime(now);
        template.setUpdateTime(now);
        templateMapper.insert(template);
        return template;
    }

    private void createSection(Long templateId, String sectionKey, String name, Integer rows, Integer cols,
                               Integer x, Integer y, String color, String type, String layout,
                               Integer radius, Integer arcSpan, Integer rotation,
                               Integer primeRowStart, Integer primeRowEnd, Integer primeColStart, Integer primeColEnd,
                               Integer sort) {
        LocalDateTime now = LocalDateTime.now();
        VenueSeatLayoutTemplateSection section = new VenueSeatLayoutTemplateSection();
        section.setTemplateId(templateId);
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
        section.setSort(sort);
        section.setStatus(1);
        section.setCreateTime(now);
        section.setUpdateTime(now);
        sectionMapper.insert(section);
    }

    private List<VenueSeatLayoutTemplate> findTemplates(Long venueId) {
        return templateMapper.selectList(new LambdaQueryWrapper<VenueSeatLayoutTemplate>()
                .eq(VenueSeatLayoutTemplate::getVenueId, venueId)
                .eq(VenueSeatLayoutTemplate::getStatus, 1)
                .orderByAsc(VenueSeatLayoutTemplate::getId));
    }

    private SeatCraftLayoutDtos.LayoutResponse toLayoutResponse(VenueSeatLayoutTemplate template,
                                                                List<VenueSeatLayoutTemplateSection> sections) {
        SeatCraftLayoutDtos.LayoutResponse response = new SeatCraftLayoutDtos.LayoutResponse();
        response.setId(template.getId());
        response.setVenueId(template.getVenueId());
        response.setName(template.getName());
        response.setTemplateType(template.getTemplateType());
        response.setStageTitle(template.getStageTitle());
        response.setStageX(template.getStageX());
        response.setStageY(template.getStageY());
        response.setCanvasWidth(template.getCanvasWidth());
        response.setCanvasHeight(template.getCanvasHeight());
        response.setSections(sections.stream().map(this::toSectionResponse).collect(Collectors.toList()));
        return response;
    }

    private SeatCraftLayoutDtos.SectionResponse toSectionResponse(VenueSeatLayoutTemplateSection section) {
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

    private void requireAdmin(Long userId) {
        UserRef user = userRefMapper.selectById(userId);
        if (user == null || !"admin".equals(user.getRole())) {
            throw new BusinessException(403, "仅平台管理员可配置座位图模板");
        }
    }

    private void requireConsoleUser(Long userId) {
        UserRef user = userRefMapper.selectById(userId);
        if (user == null || (!"admin".equals(user.getRole()) && !"organizer".equals(user.getRole()))) {
            throw new BusinessException(403, "无权限");
        }
    }

    private void requireActiveVenue(Long venueId) {
        Venue venue = requireVenue(venueId);
        if (!Integer.valueOf(1).equals(venue.getStatus())) {
            throw new BusinessException(400, "场馆不存在或已停用");
        }
    }

    private Venue requireVenue(Long venueId) {
        Venue venue = venueMapper.selectById(venueId);
        if (venue == null) {
            throw new BusinessException(404, "场馆不存在");
        }
        return venue;
    }
}
