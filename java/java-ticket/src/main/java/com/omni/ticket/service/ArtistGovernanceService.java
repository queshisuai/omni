package com.omni.ticket.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.omni.common.result.ResultCode;
import com.omni.exception.BusinessException;
import com.omni.ticket.dto.ArtistReviewRequest;
import com.omni.ticket.dto.ArtistRiskRequest;
import com.omni.ticket.dto.ArtistSubmissionRequest;
import com.omni.ticket.entity.Artist;
import com.omni.ticket.mapper.ArtistMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class ArtistGovernanceService {
    private static final String REVIEW_PENDING = "pending";
    private static final String REVIEW_APPROVED = "approved";
    private static final String REVIEW_REJECTED = "rejected";
    private static final String RISK_NORMAL = "normal";
    private static final String RISK_RISKY = "risky";

    private final ArtistMapper artistMapper;
    private final UserAccessService userAccessService;
    private final ActivityRiskResponseService activityRiskResponseService;

    public ArtistGovernanceService(ArtistMapper artistMapper, UserAccessService userAccessService) {
        this(artistMapper, userAccessService, null);
    }

    @Autowired
    public ArtistGovernanceService(ArtistMapper artistMapper, UserAccessService userAccessService,
                                    ActivityRiskResponseService activityRiskResponseService) {
        this.artistMapper = artistMapper;
        this.userAccessService = userAccessService;
        this.activityRiskResponseService = activityRiskResponseService;
    }

    public Artist submit(ArtistSubmissionRequest request) {
        if (request == null || request.getUserId() == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "艺人提交参数不能为空");
        }
        userAccessService.requireAdminOrOrganizer(request.getUserId());
        if (!StringUtils.hasText(request.getName())) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "艺人/团队名称不能为空");
        }
        LocalDateTime now = LocalDateTime.now();
        Artist artist = new Artist();
        artist.setName(request.getName().trim());
        artist.setAlias(trimToNull(request.getAlias()));
        artist.setArtistType(trimToNull(request.getArtistType()));
        artist.setCountryOrRegion(trimToNull(request.getCountryOrRegion()));
        artist.setAgency(trimToNull(request.getAgency()));
        artist.setRepresentativeWorks(trimToNull(request.getRepresentativeWorks()));
        artist.setCategoryTags(trimToNull(request.getCategoryTags()));
        artist.setDescription(trimToNull(request.getDescription()));
        artist.setSourceNote(trimToNull(request.getSourceNote()));
        artist.setStatus(1);
        artist.setReviewStatus(REVIEW_PENDING);
        artist.setRiskStatus(RISK_NORMAL);
        artist.setSubmittedBy(request.getUserId());
        artist.setCreateTime(now);
        artist.setUpdateTime(now);
        artistMapper.insert(artist);
        return artist;
    }

    public List<Artist> listPending(Long userId) {
        userAccessService.requireAdmin(userId);
        return artistMapper.selectList(new LambdaQueryWrapper<Artist>()
                .eq(Artist::getReviewStatus, REVIEW_PENDING)
                .orderByAsc(Artist::getName));
    }

    public Artist review(Long artistId, ArtistReviewRequest request) {
        if (request == null || request.getUserId() == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "艺人审核参数不能为空");
        }
        userAccessService.requireAdmin(request.getUserId());
        Artist artist = requireArtist(artistId);
        String status;
        if ("approve".equals(request.getAction())) {
            status = REVIEW_APPROVED;
        } else if ("reject".equals(request.getAction())) {
            status = REVIEW_REJECTED;
        } else {
            throw new BusinessException(ResultCode.BAD_REQUEST, "艺人审核动作不正确");
        }
        LocalDateTime now = LocalDateTime.now();
        artist.setReviewStatus(status);
        artist.setReviewNote(trimToNull(request.getNote()));
        artist.setReviewedBy(request.getUserId());
        artist.setReviewedAt(now);
        artist.setUpdateTime(now);
        artistMapper.updateById(artist);
        return artist;
    }

    public Artist updateRisk(Long artistId, ArtistRiskRequest request) {
        if (request == null || request.getUserId() == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "艺人风险参数不能为空");
        }
        userAccessService.requireAdmin(request.getUserId());
        if (RISK_RISKY.equals(request.getRiskStatus()) && !StringUtils.hasText(request.getReason())) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "标记风险艺人必须填写原因");
        }
        Artist artist = requireArtist(artistId);
        LocalDateTime now = LocalDateTime.now();
        if (RISK_RISKY.equals(request.getRiskStatus())) {
            artist.setRiskStatus(RISK_RISKY);
            artist.setRiskReason(request.getReason().trim());
            artist.setRiskMarkedBy(request.getUserId());
            artist.setRiskMarkedAt(now);
            if (activityRiskResponseService != null) {
                activityRiskResponseService.suspendPublishedActivitiesForRiskArtist(artistId, artist.getRiskReason());
            }
        } else if (RISK_NORMAL.equals(request.getRiskStatus())) {
            artist.setRiskStatus(RISK_NORMAL);
            artist.setRiskReason(null);
            artist.setRiskClearedBy(request.getUserId());
            artist.setRiskClearedAt(now);
        } else {
            throw new BusinessException(ResultCode.BAD_REQUEST, "艺人风险状态不正确");
        }
        artist.setUpdateTime(now);
        artistMapper.updateById(artist);
        return artist;
    }

    private Artist requireArtist(Long artistId) {
        if (artistId == null || artistId <= 0) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "艺人ID不正确");
        }
        Artist artist = artistMapper.selectById(artistId);
        if (artist == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "艺人不存在");
        }
        return artist;
    }

    private String trimToNull(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }
}
