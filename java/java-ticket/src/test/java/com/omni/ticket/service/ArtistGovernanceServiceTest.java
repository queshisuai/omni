package com.omni.ticket.service;

import com.baomidou.mybatisplus.core.conditions.Wrapper;
import com.omni.exception.BusinessException;
import com.omni.ticket.dto.ArtistReviewRequest;
import com.omni.ticket.dto.ArtistRiskRequest;
import com.omni.ticket.dto.ArtistSubmissionRequest;
import com.omni.ticket.dto.ArtistUpdateRequest;
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
        when(userAccessService.requireAdminOrOrganizerOrAnyPermission(2003L, "artist.manage", "activity.manage", "tour.manage")).thenReturn(user(2003L, "organizer"));
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
    void organizerAdminWithActivityPermissionCanSubmitArtist() {
        ArtistGovernanceService service = service();
        when(userAccessService.requireAdminOrOrganizerOrAnyPermission(2100L, "artist.manage", "activity.manage", "tour.manage")).thenReturn(user(2100L, "organizer_admin"));
        when(artistMapper.insert(any())).thenAnswer(invocation -> {
            Artist artist = invocation.getArgument(0);
            artist.setId(100L);
            return 1;
        });
        ArtistSubmissionRequest request = new ArtistSubmissionRequest();
        request.setUserId(2100L);
        request.setName("鏂拌壓浜?");

        Artist artist = service.submit(request);

        assertEquals(100L, artist.getId());
        assertEquals(2100L, artist.getSubmittedBy());
    }

    @Test
    void reviewArtistApprovesAndWritesAuditFields() {
        ArtistGovernanceService service = service();
        Artist artist = artist(99L);
        when(userAccessService.requirePlatformPermission(2002L, "artist.manage")).thenReturn(null);
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
    void artistManagerWithPlatformPermissionCanReviewArtist() {
        ArtistGovernanceService service = service();
        Artist artist = artist(99L);
        when(userAccessService.requirePlatformPermission(2100L, "artist.manage")).thenReturn(null);
        when(artistMapper.selectById(99L)).thenReturn(artist);
        ArtistReviewRequest request = new ArtistReviewRequest();
        request.setUserId(2100L);
        request.setAction("approve");
        request.setNote("资料完整");

        Artist reviewed = service.review(99L, request);

        assertEquals("approved", reviewed.getReviewStatus());
        assertEquals(2100L, reviewed.getReviewedBy());
        verify(userAccessService).requirePlatformPermission(2100L, "artist.manage");
    }

    @Test
    void reviewArtistRejectsAndWritesAuditFields() {
        ArtistGovernanceService service = service();
        Artist artist = artist(99L);
        when(userAccessService.requirePlatformPermission(2002L, "artist.manage")).thenReturn(null);
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
        when(userAccessService.requirePlatformPermission(2002L, "artist.manage")).thenReturn(null);
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
        when(userAccessService.requirePlatformPermission(2002L, "artist.manage")).thenReturn(null);
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
    void artistManagerWithPlatformPermissionCanListPendingArtists() {
        ArtistGovernanceService service = service();
        Artist artist = artist(99L);
        when(userAccessService.requirePlatformPermission(2100L, "artist.manage")).thenReturn(null);
        when(artistMapper.selectList(any())).thenReturn(Collections.singletonList(artist));

        assertEquals(1, service.listPending(2100L).size());

        verify(userAccessService).requirePlatformPermission(2100L, "artist.manage");
    }

    @Test
    void clearRiskWritesClearAuditFields() {
        ArtistGovernanceService service = service();
        Artist artist = artist(99L);
        artist.setRiskStatus("risky");
        artist.setRiskReason("风险原因");
        when(userAccessService.requirePlatformPermission(2002L, "artist.manage")).thenReturn(null);
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
    void listPendingRequiresArtistManagePermissionAndReturnsPendingArtists() {
        ArtistGovernanceService service = service();
        Artist artist = artist(99L);
        when(userAccessService.requirePlatformPermission(2002L, "artist.manage")).thenReturn(null);
        when(artistMapper.selectList(any())).thenReturn(Collections.singletonList(artist));

        assertEquals(1, service.listPending(2002L).size());

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Wrapper<Artist>> captor = ArgumentCaptor.forClass(Wrapper.class);
        verify(artistMapper).selectList(captor.capture());
    }

    @Test
    void adminCanUpdateAnyArtistProfile() {
        ArtistGovernanceService service = service();
        Artist artist = artist(99L);
        artist.setSubmittedBy(2003L);
        artist.setReviewStatus("approved");
        when(userAccessService.requireAdminOrOrganizerOrAnyPermission(2002L, "artist.manage")).thenReturn(user(2002L, "admin"));
        when(userAccessService.hasPlatformPermission(2002L, "artist.manage")).thenReturn(true);
        when(artistMapper.selectById(99L)).thenReturn(artist);
        ArtistUpdateRequest request = updateRequest(2002L);
        request.setName("更新艺人");
        request.setAvatar("/uploads/ticket/artist-avatar/2026/05/a.png");

        Artist updated = service.updateProfile(99L, request);

        assertEquals("更新艺人", updated.getName());
        assertEquals("/uploads/ticket/artist-avatar/2026/05/a.png", updated.getAvatar());
        assertEquals("歌手", updated.getArtistType());
        assertNotNull(updated.getUpdateTime());
        verify(artistMapper).updateById(artist);
    }

    @Test
    void platformScopedArtistManagerCanUpdateAnyArtistProfile() {
        ArtistGovernanceService service = service();
        Artist artist = artist(99L);
        artist.setSubmittedBy(2003L);
        artist.setReviewStatus("approved");
        when(userAccessService.requireAdminOrOrganizerOrAnyPermission(2100L, "artist.manage")).thenReturn(user(2100L, "organizer_admin"));
        when(userAccessService.hasPlatformPermission(2100L, "artist.manage")).thenReturn(true);
        when(artistMapper.selectById(99L)).thenReturn(artist);
        ArtistUpdateRequest request = updateRequest(2100L);
        request.setName("鏇存柊鑹轰汉");

        Artist updated = service.updateProfile(99L, request);

        assertEquals("鏇存柊鑹轰汉", updated.getName());
        verify(artistMapper).updateById(artist);
    }

    @Test
    void organizerCanUpdateOwnPendingArtistProfile() {
        ArtistGovernanceService service = service();
        Artist artist = artist(99L);
        artist.setSubmittedBy(2003L);
        artist.setReviewStatus("pending");
        when(userAccessService.requireAdminOrOrganizerOrAnyPermission(2003L, "artist.manage")).thenReturn(user(2003L, "organizer"));
        when(artistMapper.selectById(99L)).thenReturn(artist);
        ArtistUpdateRequest request = updateRequest(2003L);
        request.setName("主办方补充艺人");

        Artist updated = service.updateProfile(99L, request);

        assertEquals("主办方补充艺人", updated.getName());
        assertEquals(2003L, updated.getSubmittedBy());
        verify(artistMapper).updateById(artist);
    }

    @Test
    void organizerCannotUpdateApprovedArtistProfile() {
        ArtistGovernanceService service = service();
        Artist artist = artist(99L);
        artist.setSubmittedBy(2003L);
        artist.setReviewStatus("approved");
        when(userAccessService.requireAdminOrOrganizerOrAnyPermission(2003L, "artist.manage")).thenReturn(user(2003L, "organizer"));
        when(artistMapper.selectById(99L)).thenReturn(artist);
        ArtistUpdateRequest request = updateRequest(2003L);

        BusinessException exception = assertThrows(BusinessException.class, () -> service.updateProfile(99L, request));

        assertEquals("只能编辑自己提交且待审核的艺人档案", exception.getMessage());
    }

    @Test
    void organizerCannotUpdateOtherUsersPendingArtistProfile() {
        ArtistGovernanceService service = service();
        Artist artist = artist(99L);
        artist.setSubmittedBy(2004L);
        artist.setReviewStatus("pending");
        when(userAccessService.requireAdminOrOrganizerOrAnyPermission(2003L, "artist.manage")).thenReturn(user(2003L, "organizer"));
        when(artistMapper.selectById(99L)).thenReturn(artist);
        ArtistUpdateRequest request = updateRequest(2003L);

        BusinessException exception = assertThrows(BusinessException.class, () -> service.updateProfile(99L, request));

        assertEquals("只能编辑自己提交且待审核的艺人档案", exception.getMessage());
    }

    @Test
    void updateArtistProfileRequiresName() {
        ArtistGovernanceService service = service();
        ArtistUpdateRequest request = updateRequest(2002L);
        request.setName(" ");

        BusinessException exception = assertThrows(BusinessException.class, () -> service.updateProfile(99L, request));

        assertEquals("艺人/团队名称不能为空", exception.getMessage());
    }

    @Test
    void updateArtistProfileRequiresRequestAndUserId() {
        ArtistGovernanceService service = service();
        ArtistUpdateRequest request = updateRequest(null);

        BusinessException nullRequestException = assertThrows(BusinessException.class, () -> service.updateProfile(99L, null));
        BusinessException nullUserException = assertThrows(BusinessException.class, () -> service.updateProfile(99L, request));

        assertEquals("艺人更新参数不能为空", nullRequestException.getMessage());
        assertEquals("艺人更新参数不能为空", nullUserException.getMessage());
    }

    private ArtistGovernanceService service() {
        return new ArtistGovernanceService(artistMapper, userAccessService);
    }

    private ArtistUpdateRequest updateRequest(Long userId) {
        ArtistUpdateRequest request = new ArtistUpdateRequest();
        request.setUserId(userId);
        request.setName("测试艺人");
        request.setAlias("别名");
        request.setArtistType("歌手");
        request.setCountryOrRegion("中国");
        request.setAgency("经纪公司");
        request.setRepresentativeWorks("代表作");
        request.setCategoryTags("流行");
        request.setDescription("简介");
        request.setAvatar("/uploads/ticket/artist-avatar/2026/05/default.png");
        return request;
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
