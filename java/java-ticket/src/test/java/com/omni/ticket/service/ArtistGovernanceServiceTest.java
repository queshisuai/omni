package com.omni.ticket.service;

import com.baomidou.mybatisplus.core.conditions.Wrapper;
import com.omni.exception.BusinessException;
import com.omni.ticket.dto.ArtistReviewRequest;
import com.omni.ticket.dto.ArtistRiskRequest;
import com.omni.ticket.dto.ArtistSubmissionRequest;
import com.omni.ticket.dto.InternalUserRefResponse;
import com.omni.ticket.entity.Artist;
import com.omni.ticket.mapper.ArtistMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.annotation.AutowiredAnnotationBeanPostProcessor;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;

import java.util.Collections;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ArtistGovernanceServiceTest {
    @Mock
    private ArtistMapper artistMapper;
    @Mock
    private UserAccessService userAccessService;

    @Test
    void springCanCreateArtistGovernanceServiceWithConstructorInjection() {
        try (AnnotationConfigApplicationContext context = new AnnotationConfigApplicationContext()) {
            context.registerBean(AutowiredAnnotationBeanPostProcessor.class);
            context.registerBean(ArtistMapper.class, () -> mock(ArtistMapper.class));
            context.registerBean(UserAccessService.class, () -> mock(UserAccessService.class));
            context.registerBean(ActivityRiskResponseService.class, () -> mock(ActivityRiskResponseService.class));
            context.registerBean(ArtistGovernanceService.class);

            context.refresh();

            assertNotNull(context.getBean(ArtistGovernanceService.class));
        }
    }

    @Test
    void submitArtistCreatesPendingArtist() {
        ArtistGovernanceService service = service();
        when(userAccessService.requireAdminOrOrganizer(2003L)).thenReturn(user(2003L, "organizer"));
        when(artistMapper.insert(any())).thenAnswer(invocation -> {
            Artist artist = invocation.getArgument(0);
            artist.setId(99L);
            return 1;
        });
        ArtistSubmissionRequest request = new ArtistSubmissionRequest();
        request.setUserId(2003L);
        request.setName("新艺人");
        request.setArtistType("歌手");

        Artist artist = service.submit(request);

        assertEquals(99L, artist.getId());
        assertEquals("pending", artist.getReviewStatus());
        assertEquals("normal", artist.getRiskStatus());
        assertEquals(1, artist.getStatus());
        assertEquals(2003L, artist.getSubmittedBy());
        assertNotNull(artist.getCreateTime());
        assertNotNull(artist.getUpdateTime());
    }

    @Test
    void reviewArtistApprovesAndWritesAuditFields() {
        ArtistGovernanceService service = service();
        Artist artist = artist(99L);
        when(userAccessService.requireAdmin(2002L)).thenReturn(user(2002L, "admin"));
        when(artistMapper.selectById(99L)).thenReturn(artist);
        ArtistReviewRequest request = new ArtistReviewRequest();
        request.setUserId(2002L);
        request.setAction("approve");
        request.setNote("资料完整");

        Artist reviewed = service.review(99L, request);

        assertEquals("approved", reviewed.getReviewStatus());
        assertEquals("资料完整", reviewed.getReviewNote());
        assertEquals(2002L, reviewed.getReviewedBy());
        assertNotNull(reviewed.getReviewedAt());
        verify(artistMapper).updateById(artist);
    }

    @Test
    void reviewArtistRejectsAndWritesAuditFields() {
        ArtistGovernanceService service = service();
        Artist artist = artist(99L);
        when(userAccessService.requireAdmin(2002L)).thenReturn(user(2002L, "admin"));
        when(artistMapper.selectById(99L)).thenReturn(artist);
        ArtistReviewRequest request = new ArtistReviewRequest();
        request.setUserId(2002L);
        request.setAction("reject");
        request.setNote("资料不足");

        Artist reviewed = service.review(99L, request);

        assertEquals("rejected", reviewed.getReviewStatus());
        assertEquals("资料不足", reviewed.getReviewNote());
        assertEquals(2002L, reviewed.getReviewedBy());
        assertNotNull(reviewed.getReviewedAt());
    }

    @Test
    void markRiskRequiresReason() {
        ArtistGovernanceService service = service();
        when(userAccessService.requireAdmin(2002L)).thenReturn(user(2002L, "admin"));
        ArtistRiskRequest request = new ArtistRiskRequest();
        request.setUserId(2002L);
        request.setRiskStatus("risky");

        BusinessException exception = assertThrows(BusinessException.class, () -> service.updateRisk(99L, request));

        assertEquals("标记风险艺人必须填写原因", exception.getMessage());
    }

    @Test
    void markRiskWritesRiskAuditFields() {
        ArtistGovernanceService service = service();
        Artist artist = artist(99L);
        when(userAccessService.requireAdmin(2002L)).thenReturn(user(2002L, "admin"));
        when(artistMapper.selectById(99L)).thenReturn(artist);
        ArtistRiskRequest request = new ArtistRiskRequest();
        request.setUserId(2002L);
        request.setRiskStatus("risky");
        request.setReason("风险原因");

        Artist updated = service.updateRisk(99L, request);

        assertEquals("risky", updated.getRiskStatus());
        assertEquals("风险原因", updated.getRiskReason());
        assertEquals(2002L, updated.getRiskMarkedBy());
        assertNotNull(updated.getRiskMarkedAt());
        verify(artistMapper).updateById(artist);
    }

    @Test
    void clearRiskWritesClearAuditFields() {
        ArtistGovernanceService service = service();
        Artist artist = artist(99L);
        artist.setRiskStatus("risky");
        artist.setRiskReason("风险原因");
        when(userAccessService.requireAdmin(2002L)).thenReturn(user(2002L, "admin"));
        when(artistMapper.selectById(99L)).thenReturn(artist);
        ArtistRiskRequest request = new ArtistRiskRequest();
        request.setUserId(2002L);
        request.setRiskStatus("normal");

        Artist updated = service.updateRisk(99L, request);

        assertEquals("normal", updated.getRiskStatus());
        assertEquals(null, updated.getRiskReason());
        assertEquals(2002L, updated.getRiskClearedBy());
        assertNotNull(updated.getRiskClearedAt());
    }

    @Test
    void listPendingRequiresAdminAndReturnsPendingArtists() {
        ArtistGovernanceService service = service();
        Artist artist = artist(99L);
        when(userAccessService.requireAdmin(2002L)).thenReturn(user(2002L, "admin"));
        when(artistMapper.selectList(any())).thenReturn(Collections.singletonList(artist));

        assertEquals(1, service.listPending(2002L).size());

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Wrapper<Artist>> captor = ArgumentCaptor.forClass(Wrapper.class);
        verify(artistMapper).selectList(captor.capture());
    }

    private ArtistGovernanceService service() {
        return new ArtistGovernanceService(artistMapper, userAccessService);
    }

    private InternalUserRefResponse user(Long id, String role) {
        InternalUserRefResponse user = new InternalUserRefResponse();
        user.setId(id);
        user.setRole(role);
        return user;
    }

    private Artist artist(Long id) {
        Artist artist = new Artist();
        artist.setId(id);
        artist.setName("测试艺人");
        artist.setStatus(1);
        artist.setReviewStatus("pending");
        artist.setRiskStatus("normal");
        return artist;
    }
}
