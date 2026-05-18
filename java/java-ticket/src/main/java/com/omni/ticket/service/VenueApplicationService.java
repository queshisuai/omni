package com.omni.ticket.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.omni.exception.BusinessException;
import com.omni.ticket.dto.VenueApplicationRequest;
import com.omni.ticket.dto.VenueApplicationResponse;
import com.omni.ticket.entity.UserRef;
import com.omni.ticket.entity.Venue;
import com.omni.ticket.entity.VenueApplication;
import com.omni.ticket.mapper.UserRefMapper;
import com.omni.ticket.mapper.VenueApplicationMapper;
import com.omni.ticket.mapper.VenueMapper;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class VenueApplicationService {

    private final VenueApplicationMapper venueApplicationMapper;
    private final VenueMapper venueMapper;
    private final UserRefMapper userRefMapper;

    public VenueApplicationService(VenueApplicationMapper venueApplicationMapper,
                                   VenueMapper venueMapper,
                                   UserRefMapper userRefMapper) {
        this.venueApplicationMapper = venueApplicationMapper;
        this.venueMapper = venueMapper;
        this.userRefMapper = userRefMapper;
    }

    public VenueApplication submit(VenueApplicationRequest request) {
        UserRef user = requireUser(request.getUserId());
        if (!"admin".equals(user.getRole()) && !"organizer".equals(user.getRole())) {
            throw new BusinessException(403, "无权限");
        }
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
        application.setStatus(0);
        application.setCreateTime(LocalDateTime.now());
        application.setUpdateTime(LocalDateTime.now());
        venueApplicationMapper.insert(application);
        return application;
    }

    public List<VenueApplicationResponse> listMine(Long userId) {
        requireUser(userId);
        return venueApplicationMapper.selectList(new LambdaQueryWrapper<VenueApplication>()
                        .eq(VenueApplication::getApplicantId, userId)
                        .orderByDesc(VenueApplication::getCreateTime))
                .stream().map(VenueApplicationResponse::from).collect(Collectors.toList());
    }

    public List<VenueApplicationResponse> listAdmin(Long userId, Integer status) {
        UserRef user = requireUser(userId);
        if (!"admin".equals(user.getRole())) {
            throw new BusinessException(403, "无权限");
        }
        LambdaQueryWrapper<VenueApplication> wrapper = new LambdaQueryWrapper<>();
        if (status != null) {
            wrapper.eq(VenueApplication::getStatus, status);
        }
        wrapper.orderByDesc(VenueApplication::getCreateTime);
        return venueApplicationMapper.selectList(wrapper).stream().map(VenueApplicationResponse::from).collect(Collectors.toList());
    }

    public VenueApplication approve(Long id, Long userId, String mode, Long venueId, String reviewNote) {
        UserRef reviewer = requireUser(userId);
        if (!"admin".equals(reviewer.getRole())) {
            throw new BusinessException(403, "无权限");
        }
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
        UserRef reviewer = requireUser(userId);
        if (!"admin".equals(reviewer.getRole())) {
            throw new BusinessException(403, "无权限");
        }
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

    private UserRef requireUser(Long userId) {
        UserRef user = userRefMapper.selectById(userId);
        if (user == null) {
            throw new BusinessException(401, "无权限");
        }
        return user;
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
