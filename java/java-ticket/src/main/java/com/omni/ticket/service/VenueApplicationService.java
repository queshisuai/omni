package com.omni.ticket.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.omni.exception.BusinessException;
import com.omni.ticket.dto.SeatCraftBlockDtos;
import com.omni.ticket.dto.VenueApplicationRequest;
import com.omni.ticket.dto.VenueApplicationResponse;
import com.omni.ticket.dto.InternalUserRefResponse;
import com.omni.ticket.entity.Venue;
import com.omni.ticket.entity.VenueApplication;
import com.omni.ticket.mapper.VenueApplicationMapper;
import com.omni.ticket.service.UserAccessService;
import com.omni.ticket.mapper.VenueMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Collectors;

@Service
public class VenueApplicationService {

    private final VenueApplicationMapper venueApplicationMapper;
    private final VenueMapper venueMapper;
    private final UserAccessService userAccessService;
    private final SeatCraftBlockLayoutService blockLayoutService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public VenueApplicationService(VenueApplicationMapper venueApplicationMapper,
                                    VenueMapper venueMapper,
                                    UserAccessService userAccessService) {
        this(venueApplicationMapper, venueMapper, userAccessService, null);
    }

    @Autowired
    public VenueApplicationService(VenueApplicationMapper venueApplicationMapper,
                                   VenueMapper venueMapper,
                                   UserAccessService userAccessService,
                                   SeatCraftBlockLayoutService blockLayoutService) {
        this.venueApplicationMapper = venueApplicationMapper;
        this.venueMapper = venueMapper;
        this.userAccessService = userAccessService;
        this.blockLayoutService = blockLayoutService;
    }

    public VenueApplication submit(VenueApplicationRequest request) {
        userAccessService.requireAdminOrOrganizer(request.getUserId());
        validateUsageProof(request);
        LocalDateTime now = LocalDateTime.now();
        VenueApplication application = new VenueApplication();
        application.setApplicantId(request.getUserId());
        application.setVenueName(trim(request.getVenueName()));
        application.setCity(trim(request.getCity()));
        application.setAddress(trim(request.getAddress()));
        application.setCapacity(request.getCapacity());
        application.setContactName(trim(request.getContactName()));
        application.setContactPhone(trim(request.getContactPhone()));
        application.setQualificationNo(trim(request.getQualificationNo()));
        application.setBusinessScope(trim(request.getBusinessScope()));
        application.setDescription(trim(request.getDescription()));
        application.setValidFrom(request.getValidFrom());
        application.setValidTo(request.getValidTo());
        application.setProofNote(trim(request.getProofNote()));
        application.setProofFileUrl(trim(request.getProofFileUrl()));
        application.setLayoutSnapshot(resolveLayoutSnapshot(request));
        application.setSetAsRecommendedLayout(Boolean.TRUE.equals(request.getSetAsRecommendedLayout()));
        application.setStatus(0);
        application.setCreateTime(now);
        application.setUpdateTime(now);
        venueApplicationMapper.insert(application);
        if (request.getLayout() != null && blockLayoutService != null) {
            blockLayoutService.replaceLayout("venue_application", application.getId(), request.getLayout());
        }
        return application;
    }

    private void validateUsageProof(VenueApplicationRequest request) {
        if (request.getValidFrom() == null) {
            throw new BusinessException(400, "场地使用开始时间不能为空");
        }
        if (request.getValidTo() == null || !request.getValidTo().isAfter(request.getValidFrom())) {
            throw new BusinessException(400, "场地使用结束时间必须晚于开始时间");
        }
        if (trim(request.getProofNote()) == null && trim(request.getProofFileUrl()) == null) {
            throw new BusinessException(400, "请填写场地使用证明说明或上传附件");
        }
        validateLayout(request);
    }

    private void validateLayout(VenueApplicationRequest request) {
        if (trim(request.getLayoutSnapshot()) != null) {
            return;
        }
        SeatCraftBlockDtos.LayoutRequest layout = request.getLayout();
        if (layout == null) {
            throw new BusinessException(400, "请提交场地座位图快照");
        }
        List<SeatCraftBlockDtos.BlockRequest> blocks = layout.getBlocks();
        if (blocks == null || blocks.isEmpty()) {
            throw new BusinessException(400, "请至少添加一个座位块");
        }
        List<SeatCraftBlockDtos.TicketGroupRequest> ticketGroups = layout.getTicketGroups();
        if (ticketGroups == null || ticketGroups.isEmpty()) {
            throw new BusinessException(400, "请至少配置一个票档组");
        }
        Set<String> groupKeys = ticketGroups.stream()
                .map(SeatCraftBlockDtos.TicketGroupRequest::getGroupKey)
                .map(this::trim)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        if (groupKeys.isEmpty()) {
            throw new BusinessException(400, "请至少配置一个票档组");
        }
        for (SeatCraftBlockDtos.BlockRequest block : blocks) {
            if (trim(block.getBlockKey()) == null) {
                throw new BusinessException(400, "座位块标识不能为空");
            }
            if (!groupKeys.contains(trim(block.getTicketGroupKey()))) {
                throw new BusinessException(400, "座位块必须绑定有效票档组");
            }
        }
    }

    private String resolveLayoutSnapshot(VenueApplicationRequest request) {
        String snapshot = trim(request.getLayoutSnapshot());
        if (snapshot != null) {
            return snapshot;
        }
        try {
            return objectMapper.writeValueAsString(request.getLayout());
        } catch (JsonProcessingException e) {
            throw new BusinessException(400, "场地座位图快照格式不正确");
        }
    }

    public List<VenueApplicationResponse> listMine(Long userId) {
        userAccessService.requireUser(userId);
        return venueApplicationMapper.selectList(new LambdaQueryWrapper<VenueApplication>()
                        .eq(VenueApplication::getApplicantId, userId)
                        .orderByDesc(VenueApplication::getCreateTime))
                .stream().map(VenueApplicationResponse::from).collect(Collectors.toList());
    }

    public List<VenueApplicationResponse> listAdmin(Long userId, Integer status) {
        userAccessService.requireAdmin(userId);
        LambdaQueryWrapper<VenueApplication> wrapper = new LambdaQueryWrapper<>();
        if (status != null) {
            wrapper.eq(VenueApplication::getStatus, status);
        }
        wrapper.orderByDesc(VenueApplication::getCreateTime);
        return venueApplicationMapper.selectList(wrapper).stream().map(VenueApplicationResponse::from).collect(Collectors.toList());
    }

    public VenueApplication approve(Long id, Long userId, String mode, Long venueId, String reviewNote) {
        userAccessService.requireAdmin(userId);
        VenueApplication application = requirePendingApplication(id);
        Long approvedVenueId;
        if ("create".equals(mode)) {
            Venue venue = new Venue();
            venue.setName(application.getVenueName());
            venue.setCity(application.getCity());
            venue.setAddress(application.getAddress());
            venue.setCapacity(application.getCapacity());
            venue.setStatus(1);
            venueMapper.insert(venue);
            approvedVenueId = venue.getId();
        } else if ("link".equals(mode)) {
            Venue venue = venueMapper.selectById(venueId);
            if (venue == null || !Integer.valueOf(1).equals(venue.getStatus())) {
                throw new BusinessException(400, "关联场馆不存在或已停用");
            }
            approvedVenueId = venueId;
        } else {
            throw new BusinessException(400, "审核通过方式不正确");
        }
        application.setVenueId(approvedVenueId);
        application.setStatus(1);
        application.setReviewerId(userId);
        application.setReviewNote(trim(reviewNote));
        application.setReviewTime(LocalDateTime.now());
        application.setUpdateTime(LocalDateTime.now());
        venueApplicationMapper.updateById(application);
        return application;
    }

    public VenueApplication reject(Long id, Long userId, String reviewNote) {
        userAccessService.requireAdmin(userId);
        if (trim(reviewNote) == null || trim(reviewNote).isEmpty()) {
            throw new BusinessException(400, "驳回原因不能为空");
        }
        VenueApplication application = requirePendingApplication(id);
        application.setStatus(2);
        application.setReviewerId(userId);
        application.setReviewNote(trim(reviewNote));
        application.setReviewTime(LocalDateTime.now());
        application.setUpdateTime(LocalDateTime.now());
        venueApplicationMapper.updateById(application);
        return application;
    }

    private InternalUserRefResponse requireUser(Long userId) {
        return userAccessService.requireUser(userId);
    }

    private VenueApplication requirePendingApplication(Long id) {
        VenueApplication application = venueApplicationMapper.selectById(id);
        if (application == null) {
            throw new BusinessException(404, "场馆申请不存在");
        }
        if (!Integer.valueOf(0).equals(application.getStatus())) {
            throw new BusinessException(400, "只能审核待审核申请");
        }
        return application;
    }

    private String trim(String value) {
        return value == null ? null : value.trim();
    }
}
