package com.omni.ticket.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.omni.ticket.dto.ArtistSearchResponse;
import com.omni.ticket.entity.Artist;
import com.omni.ticket.mapper.ArtistMapper;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class ArtistAdminService {
    private final ArtistMapper artistMapper;

    public ArtistAdminService(ArtistMapper artistMapper) {
        this.artistMapper = artistMapper;
    }

    public List<ArtistSearchResponse> search(String keyword) {
        String term = keyword == null ? "" : keyword.trim();
        LambdaQueryWrapper<Artist> wrapper = new LambdaQueryWrapper<Artist>()
                .eq(Artist::getStatus, 1)
                .orderByAsc(Artist::getName)
                .last("LIMIT 20");
        if (StringUtils.hasText(term)) {
            wrapper.and(w -> w.like(Artist::getName, term)
                    .or().like(Artist::getAlias, term)
                    .or().like(Artist::getCategoryTags, term)
                    .or().like(Artist::getRepresentativeWorks, term));
        }
        return artistMapper.selectList(wrapper).stream().map(this::toResponse).collect(Collectors.toList());
    }

    public Artist getById(Long id) {
        return id == null || id <= 0 ? null : artistMapper.selectById(id);
    }

    public Page<Artist> listManageable(Long operatorId, String role, long page, long size,
                                       String keyword, String reviewStatus, String riskStatus) {
        long current = Math.max(1, page);
        long pageSize = Math.min(50, Math.max(1, size));
        String term = keyword == null ? "" : keyword.trim();
        LambdaQueryWrapper<Artist> wrapper = new LambdaQueryWrapper<Artist>()
                .eq(Artist::getStatus, 1)
                .orderByDesc(Artist::getUpdateTime)
                .orderByDesc(Artist::getCreateTime)
                .orderByAsc(Artist::getName);
        if ("organizer".equals(role)) {
            wrapper.eq(Artist::getSubmittedBy, operatorId);
        }
        if (StringUtils.hasText(term)) {
            wrapper.and(w -> w.like(Artist::getName, term)
                    .or().like(Artist::getAlias, term)
                    .or().like(Artist::getCategoryTags, term)
                    .or().like(Artist::getRepresentativeWorks, term));
        }
        if (StringUtils.hasText(reviewStatus)) {
            wrapper.eq(Artist::getReviewStatus, reviewStatus.trim());
        }
        if (StringUtils.hasText(riskStatus)) {
            wrapper.eq(Artist::getRiskStatus, riskStatus.trim());
        }
        return artistMapper.selectPage(new Page<>(current, pageSize), wrapper);
    }

    private ArtistSearchResponse toResponse(Artist artist) {
        ArtistSearchResponse response = new ArtistSearchResponse();
        response.setId(artist.getId());
        response.setName(artist.getName());
        response.setAlias(artist.getAlias());
        response.setArtistType(artist.getArtistType());
        response.setCountryOrRegion(artist.getCountryOrRegion());
        response.setCategoryTags(artist.getCategoryTags());
        response.setAvatar(artist.getAvatar());
        response.setRepresentativeWorks(artist.getRepresentativeWorks());
        response.setRiskStatus(artist.getRiskStatus());
        response.setReviewStatus(artist.getReviewStatus());
        return response;
    }
}
