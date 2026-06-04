package com.omni.ticket.service;

import com.omni.exception.BusinessException;
import com.omni.ticket.dto.SeatCraftBlockDtos;
import com.omni.ticket.dto.SeatCraftLayoutDtos;
import com.omni.ticket.dto.SeatLayoutTemplateCandidateResponse;
import com.omni.ticket.dto.PrivateAssetResponse;
import com.omni.ticket.dto.VenueApplicationRequest;
import com.omni.ticket.dto.VenueApplicationResponse;
import com.omni.ticket.entity.Venue;
import com.omni.ticket.dto.InternalUserRefResponse;
import com.omni.ticket.entity.VenueApplication;
import com.omni.ticket.mapper.VenueApplicationMapper;
import com.omni.ticket.service.UserAccessService;
import com.omni.ticket.mapper.VenueMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.annotation.Transactional;

import java.lang.reflect.Method;
import java.time.LocalDateTime;
import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class VenueApplicationServiceTest {

    @Mock
    private VenueApplicationMapper venueApplicationMapper;
    @Mock
    private VenueMapper venueMapper;
    @Mock
    private UserAccessService userAccessService;
    @Mock
    private SeatCraftBlockLayoutService blockLayoutService;
    @Mock
    private VenueDefaultLayoutService venueDefaultLayoutService;
    @Mock
    private PrivateAssetService privateAssetService;

    private VenueApplicationService service;

    @BeforeEach
    void setUp() {
        service = new VenueApplicationService(venueApplicationMapper, venueMapper, userAccessService,
                blockLayoutService, venueDefaultLayoutService, privateAssetService);
    }

    @Test
    void organizerSubmitCreatesPendingApplication() {
        when(userAccessService.requireAdminOrOrganizerOrAnyPermission(2003L, "activity.manage", "tour.manage")).thenReturn(user(2003L, "organizer"));

        VenueApplication result = service.submit(request());

        ArgumentCaptor<VenueApplication> captor = ArgumentCaptor.forClass(VenueApplication.class);
        verify(venueApplicationMapper).insert(captor.capture());
        VenueApplication saved = captor.getValue();
        assertEquals(2003L, saved.getApplicantId());
        assertEquals("国家体育馆", saved.getVenueName());
        assertEquals("北京", saved.getCity());
        assertEquals("北京市朝阳区", saved.getAddress());
        assertEquals(18000, saved.getCapacity());
        assertEquals("张三", saved.getContactName());
        assertEquals("13800000002", saved.getContactPhone());
        assertEquals(LocalDateTime.parse("2026-06-01T00:00:00"), saved.getValidFrom());
        assertEquals(LocalDateTime.parse("2026-06-30T23:59:00"), saved.getValidTo());
        assertEquals("已取得场地授权", saved.getProofNote());
        assertEquals("https://example.com/proof.pdf", saved.getProofFileUrl());
        assertTrue(saved.getLayoutSnapshot().contains("\"blockKey\":\"block-a\""));
        assertTrue(saved.getLayoutSnapshot().contains("\"groupKey\":\"vip\""));
        assertEquals(Boolean.TRUE, saved.getSetAsRecommendedLayout());
        assertEquals(0, saved.getStatus());
        assertNull(saved.getVenueId());
        assertEquals(saved, result);
    }

    @Test
    void adminSubmitCreatesApprovedApplicationWithoutReviewQueue() {
        when(userAccessService.requireAdminOrOrganizerOrAnyPermission(2002L, "activity.manage", "tour.manage")).thenReturn(user(2002L, "admin"));
        when(userAccessService.isAdmin(any())).thenReturn(true);
        doAnswer(invocation -> {
            Venue venue = invocation.getArgument(0);
            venue.setId(77L);
            return 1;
        }).when(venueMapper).insert(any(Venue.class));
        VenueApplicationRequest request = request();
        request.setUserId(2002L);

        VenueApplication result = service.submit(request);

        ArgumentCaptor<VenueApplication> captor = ArgumentCaptor.forClass(VenueApplication.class);
        verify(venueApplicationMapper).insert(captor.capture());
        VenueApplication saved = captor.getValue();
        assertEquals(77L, saved.getVenueId());
        assertEquals(1, saved.getStatus());
        assertEquals(2002L, saved.getReviewerId());
        assertEquals("管理员直接添加场馆", saved.getReviewNote());
        assertNotNull(saved.getReviewTime());
        assertEquals(saved, result);
    }

    @Test
    void submitCanAttachApprovalMaterialToExistingVenue() {
        when(userAccessService.requireAdminOrOrganizerOrAnyPermission(2003L, "activity.manage", "tour.manage")).thenReturn(user(2003L, "organizer"));
        Venue venue = new Venue();
        venue.setId(66L);
        venue.setName("国家体育馆");
        venue.setCity("北京");
        venue.setAddress("天辰东路9号");
        venue.setStatus(1);
        when(venueMapper.selectById(66L)).thenReturn(venue);
        doAnswer(invocation -> {
            VenueApplication application = invocation.getArgument(0);
            application.setId(88L);
            return 1;
        }).when(venueApplicationMapper).insert(any(VenueApplication.class));

        VenueApplicationRequest request = request();
        request.setVenueId(66L);
        request.setVenueName("国家体育馆");
        request.setCity("北京");
        request.setAddress("天辰东路9号");

        VenueApplication result = service.submit(request);

        assertEquals(88L, result.getId());
        verify(venueApplicationMapper).insert(argThat(application ->
                Long.valueOf(66L).equals(application.getVenueId())
                        && Integer.valueOf(0).equals(application.getStatus())
                        && Long.valueOf(2003L).equals(application.getApplicantId())));
    }

    @Test
    void submitRejectsMissingUsageProof() {
        when(userAccessService.requireAdminOrOrganizerOrAnyPermission(2003L, "activity.manage", "tour.manage")).thenReturn(user(2003L, "organizer"));
        VenueApplicationRequest request = request();
        request.setProofNote(null);
        request.setProofFileUrl(null);

        BusinessException error = assertThrows(BusinessException.class, () -> service.submit(request));

        assertEquals(400, error.getCode());
    }

    @Test
    void submitBindsProofAssetAfterCreatingApplication() {
        when(userAccessService.requireAdminOrOrganizerOrAnyPermission(2003L, "activity.manage", "tour.manage")).thenReturn(user(2003L, "organizer"));
        when(venueApplicationMapper.insert(any())).thenAnswer(invocation -> {
            VenueApplication application = invocation.getArgument(0);
            application.setId(99L);
            return 1;
        });
        VenueApplicationRequest request = request();
        request.setProofFileUrl(null);
        request.setProofAssetId(10L);

        VenueApplication result = service.submit(request);

        assertEquals(10L, result.getProofAssetId());
        verify(privateAssetService).bindVenueProof(10L, 99L, 2003L);
    }

    @Test
    void submitAllowsOnlyProofAssetAsUsageProof() {
        when(userAccessService.requireAdminOrOrganizerOrAnyPermission(2003L, "activity.manage", "tour.manage")).thenReturn(user(2003L, "organizer"));
        when(venueApplicationMapper.insert(any())).thenAnswer(invocation -> {
            VenueApplication application = invocation.getArgument(0);
            application.setId(99L);
            return 1;
        });
        VenueApplicationRequest request = request();
        request.setProofNote(null);
        request.setProofFileUrl(null);
        request.setProofAssetId(10L);

        VenueApplication result = service.submit(request);

        assertNull(result.getProofNote());
        assertNull(result.getProofFileUrl());
        assertEquals(10L, result.getProofAssetId());
        verify(privateAssetService).bindVenueProof(10L, 99L, 2003L);
    }

    @Test
    void submitRejectsProofAssetWhenPrivateAssetServiceUnavailableBeforeInsert() {
        VenueApplicationService shortConstructorService = new VenueApplicationService(
                venueApplicationMapper, venueMapper, userAccessService);
        when(userAccessService.requireAdminOrOrganizerOrAnyPermission(2003L, "activity.manage", "tour.manage")).thenReturn(user(2003L, "organizer"));
        VenueApplicationRequest request = request();
        request.setProofAssetId(10L);

        BusinessException error = assertThrows(BusinessException.class,
                () -> shortConstructorService.submit(request));

        assertEquals(500, error.getCode());
        assertEquals("私有附件服务不可用", error.getMessage());
        verify(venueApplicationMapper, never()).insert(any());
    }

    @Test
    void submitPropagatesBindVenueProofExceptionAfterInsert() {
        when(userAccessService.requireAdminOrOrganizerOrAnyPermission(2003L, "activity.manage", "tour.manage")).thenReturn(user(2003L, "organizer"));
        when(venueApplicationMapper.insert(any())).thenAnswer(invocation -> {
            VenueApplication application = invocation.getArgument(0);
            application.setId(99L);
            return 1;
        });
        BusinessException bindError = new BusinessException(400, "附件不可用");
        doThrow(bindError).when(privateAssetService).bindVenueProof(10L, 99L, 2003L);
        VenueApplicationRequest request = request();
        request.setProofAssetId(10L);

        BusinessException error = assertThrows(BusinessException.class, () -> service.submit(request));

        assertEquals(bindError, error);
        verify(venueApplicationMapper).insert(any());
        verify(privateAssetService).bindVenueProof(10L, 99L, 2003L);
    }

    @Test
    void listMineIncludesProofAssetMetadata() {
        VenueApplication application = pendingApplication();
        application.setProofAssetId(10L);
        when(venueApplicationMapper.selectList(any())).thenReturn(List.of(application));
        PrivateAssetResponse asset = new PrivateAssetResponse();
        asset.setId(10L);
        asset.setOriginalFilename("venue-proof.pdf");
        when(privateAssetService.getById(10L)).thenReturn(asset);

        List<VenueApplicationResponse> responses = service.listMine(2003L);

        assertEquals(1, responses.size());
        assertNotNull(responses.get(0).getProofAsset());
        assertEquals(10L, responses.get(0).getProofAsset().getId());
        assertEquals("venue-proof.pdf", responses.get(0).getProofAsset().getOriginalFilename());
    }

    @Test
    void submitIsTransactional() throws NoSuchMethodException {
        Method method = VenueApplicationService.class.getMethod("submit", VenueApplicationRequest.class);

        assertNotNull(method.getAnnotation(Transactional.class));
    }

    @Test
    void approveIsTransactional() throws NoSuchMethodException {
        Method method = VenueApplicationService.class.getMethod(
                "approve", Long.class, Long.class, String.class, Long.class, String.class);

        assertNotNull(method.getAnnotation(Transactional.class));
    }

    @Test
    void submitRejectsLayoutWithoutTicketGroup() {
        when(userAccessService.requireAdminOrOrganizerOrAnyPermission(2003L, "activity.manage", "tour.manage")).thenReturn(user(2003L, "organizer"));
        VenueApplicationRequest request = request();
        request.getLayout().setTicketGroups(List.of());

        BusinessException error = assertThrows(BusinessException.class, () -> service.submit(request));

        assertEquals(400, error.getCode());
        assertEquals("请至少配置一个票档组", error.getMessage());
    }

    @Test
    void approveWithCreateModeCreatesNewVenueAndApprovesApplication() {
        when(userAccessService.requireAdmin(2002L)).thenReturn(user(2002L, "admin"));
        VenueApplication application = pendingApplication();
        when(venueApplicationMapper.selectById(301L)).thenReturn(application);

        VenueApplication result = service.approve(301L, 2002L, "create", null, "资料真实");

        ArgumentCaptor<Venue> venueCaptor = ArgumentCaptor.forClass(Venue.class);
        verify(venueMapper).insert(venueCaptor.capture());
        Venue venue = venueCaptor.getValue();
        assertEquals("国家体育馆", venue.getName());
        assertEquals("北京", venue.getCity());
        assertEquals("北京市朝阳区", venue.getAddress());
        assertEquals(18000, venue.getCapacity());
        assertEquals(1, venue.getStatus());
        assertEquals(1, application.getStatus());
        assertEquals(2002L, application.getReviewerId());
        assertEquals("资料真实", application.getReviewNote());
        verify(venueApplicationMapper).updateById(application);
        assertEquals(application, result);
    }

    @Test
    void approveWithLinkModeAssociatesExistingVenueWithoutCreatingVenue() {
        when(userAccessService.requireAdmin(2002L)).thenReturn(user(2002L, "admin"));
        VenueApplication application = pendingApplication();
        when(venueApplicationMapper.selectById(301L)).thenReturn(application);
        when(venueMapper.selectById(99L)).thenReturn(activeVenue(99L));

        VenueApplication result = service.approve(301L, 2002L, "link", 99L, "关联现有场馆");

        verify(venueMapper, never()).insert(any());
        assertEquals(99L, application.getVenueId());
        assertEquals(1, application.getStatus());
        assertEquals(2002L, application.getReviewerId());
        assertEquals("关联现有场馆", application.getReviewNote());
        verify(venueApplicationMapper).updateById(application);
        assertEquals(application, result);
    }

    @Test
    void listSeatLayoutTemplatesReturnsApprovedApplicationAndLegacyDefaultCandidates() {
        when(userAccessService.requireAdminOrOrganizerOrAnyPermission(2003L, "activity.manage", "tour.manage")).thenReturn(user(2003L, "organizer"));
        when(venueMapper.selectById(99L)).thenReturn(activeVenue(99L));
        VenueApplication application = approvedApplication(301L, 99L);
        when(venueApplicationMapper.selectList(any())).thenReturn(List.of(application));
        when(blockLayoutService.getLayout("venue_application", 301L)).thenReturn(layout());
        SeatCraftLayoutDtos.LayoutResponse legacy = new SeatCraftLayoutDtos.LayoutResponse();
        legacy.setId(7L);
        legacy.setName("历史地点模板");
        legacy.setTemplateType("concert");
        legacy.setStageTitle("舞台");
        legacy.setStageX(0);
        legacy.setStageY(0);
        legacy.setCanvasWidth(1000);
        legacy.setCanvasHeight(800);
        when(venueDefaultLayoutService.getLayout(99L)).thenReturn(legacy);

        List<SeatLayoutTemplateCandidateResponse> candidates = service.listSeatLayoutTemplates(2003L, 99L);

        assertEquals(2, candidates.size());
        assertEquals("venue_application", candidates.get(0).getSourceType());
        assertEquals(301L, candidates.get(0).getSourceId());
        assertEquals("国家体育馆历史申请模板", candidates.get(0).getName());
        assertEquals("legacy_venue_default", candidates.get(1).getSourceType());
        assertEquals(7L, candidates.get(1).getSourceId());
        assertEquals("历史地点模板", candidates.get(1).getName());
    }

    private VenueApplicationRequest request() {
        VenueApplicationRequest request = new VenueApplicationRequest();
        request.setUserId(2003L);
        request.setVenueName("国家体育馆");
        request.setCity("北京");
        request.setAddress("北京市朝阳区");
        request.setCapacity(18000);
        request.setContactName("张三");
        request.setContactPhone("13800000002");
        request.setQualificationNo("VENUE-001");
        request.setBusinessScope("演唱会、体育赛事");
        request.setDescription("申请加入平台公共场馆库");
        request.setValidFrom(LocalDateTime.parse("2026-06-01T00:00:00"));
        request.setValidTo(LocalDateTime.parse("2026-06-30T23:59:00"));
        request.setProofNote("已取得场地授权");
        request.setProofFileUrl("https://example.com/proof.pdf");
        request.setLayout(layout());
        request.setSetAsRecommendedLayout(true);
        return request;
    }

    private SeatCraftBlockDtos.LayoutRequest layout() {
        SeatCraftBlockDtos.LayoutRequest layout = new SeatCraftBlockDtos.LayoutRequest();
        layout.setName("国家体育馆座位图");
        layout.setCanvasWidth(1000);
        layout.setCanvasHeight(800);

        SeatCraftBlockDtos.BlockRequest block = new SeatCraftBlockDtos.BlockRequest();
        block.setBlockKey("block-a");
        block.setName("A 区");
        block.setBlockType("gridBlock");
        block.setTicketGroupKey("vip");
        block.setX(new BigDecimal("100"));
        block.setY(new BigDecimal("200"));
        block.setRows(2);
        block.setCols(3);
        layout.setBlocks(List.of(block));

        SeatCraftBlockDtos.TicketGroupRequest group = new SeatCraftBlockDtos.TicketGroupRequest();
        group.setGroupKey("vip");
        group.setName("VIP");
        group.setDefaultPrice(new BigDecimal("680.00"));
        group.setSourceBlockKeys(List.of("block-a"));
        layout.setTicketGroups(List.of(group));
        return layout;
    }

    private VenueApplication pendingApplication() {
        VenueApplication application = new VenueApplication();
        application.setId(301L);
        application.setApplicantId(2003L);
        application.setVenueName("国家体育馆");
        application.setCity("北京");
        application.setAddress("北京市朝阳区");
        application.setCapacity(18000);
        application.setContactName("张三");
        application.setContactPhone("13800000002");
        application.setStatus(0);
        return application;
    }

    private VenueApplication approvedApplication(Long id, Long venueId) {
        VenueApplication application = pendingApplication();
        application.setId(id);
        application.setVenueId(venueId);
        application.setStatus(1);
        application.setCreateTime(LocalDateTime.parse("2026-05-01T10:00:00"));
        return application;
    }

    private Venue activeVenue(Long id) {
        Venue venue = new Venue();
        venue.setId(id);
        venue.setStatus(1);
        return venue;
    }

    private InternalUserRefResponse user(Long id, String role) {
        InternalUserRefResponse user = new InternalUserRefResponse();
        user.setId(id);
        user.setRole(role);
        return user;
    }
}
