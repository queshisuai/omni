package com.omni.ticket.service;

import com.omni.exception.BusinessException;
import com.omni.ticket.dto.InternalUserRefResponse;
import com.omni.ticket.dto.PrivateAssetDownload;
import com.omni.ticket.dto.PrivateAssetResponse;
import com.omni.ticket.entity.PrivateAsset;
import com.omni.ticket.entity.VenueApplication;
import com.omni.ticket.mapper.PrivateAssetMapper;
import com.omni.ticket.mapper.VenueApplicationMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PrivateAssetServiceTest {

    private static final Long ADMIN_ID = 2002L;
    private static final Long APPLICANT_ID = 2003L;
    private static final Long OTHER_ORGANIZER_ID = 2005L;

    @Mock
    private PrivateAssetMapper privateAssetMapper;
    @Mock
    private VenueApplicationMapper venueApplicationMapper;
    @Mock
    private UserAccessService userAccessService;

    @Test
    void uploadVenueProofStoresPrivatePendingAsset() throws Exception {
        Path privateRoot = Files.createTempDirectory("omni-private-asset-test");
        when(userAccessService.requireAdminOrOrganizer(APPLICANT_ID)).thenReturn(user(APPLICANT_ID, "organizer"));
        when(privateAssetMapper.insert(any(PrivateAsset.class))).thenAnswer(invocation -> {
            PrivateAsset asset = invocation.getArgument(0);
            asset.setId(9101L);
            return 1;
        });
        PrivateAssetService service = service(privateRoot);
        MockMultipartFile file = pdfFile();

        PrivateAssetResponse response = service.upload(APPLICANT_ID, "venue-proof", file);

        assertEquals(9101L, response.getId());
        assertEquals("venue-proof", response.getBizType());
        assertEquals("proof.pdf", response.getOriginalFilename());
        assertEquals("application/pdf", response.getContentType());
        assertEquals(file.getSize(), response.getFileSize());
        assertEquals("pending", response.getStatus());

        ArgumentCaptor<PrivateAsset> captor = ArgumentCaptor.forClass(PrivateAsset.class);
        verify(privateAssetMapper).insert(captor.capture());
        PrivateAsset saved = captor.getValue();
        assertEquals("ticket", saved.getServiceName());
        assertEquals("venue-proof", saved.getBizType());
        assertEquals(APPLICANT_ID, saved.getUploaderId());
        assertEquals("pending", saved.getStatus());
        assertNotNull(saved.getSha256());
        assertTrue(saved.getRelativePath().startsWith("venue-proof/"));
        assertTrue(Files.exists(privateRoot.resolve(saved.getRelativePath())));
    }

    @Test
    void uploadRejectsUnsupportedBizType() throws Exception {
        PrivateAssetService service = service(Files.createTempDirectory("omni-private-asset-test"));

        BusinessException error = assertThrows(BusinessException.class,
                () -> service.upload(APPLICANT_ID, "activity-poster", pngFile()));

        assertEquals(400, error.getCode());
        assertEquals("不支持的私有资产类型", error.getMessage());
        verifyNoInteractions(privateAssetMapper);
    }

    @Test
    void uploadRejectsUnsupportedFileType() throws Exception {
        when(userAccessService.requireAdminOrOrganizer(APPLICANT_ID)).thenReturn(user(APPLICANT_ID, "organizer"));
        PrivateAssetService service = service(Files.createTempDirectory("omni-private-asset-test"));
        MockMultipartFile file = new MockMultipartFile("file", "proof.txt", "text/plain", "plain".getBytes());

        BusinessException error = assertThrows(BusinessException.class,
                () -> service.upload(APPLICANT_ID, "venue-proof", file));

        assertEquals(400, error.getCode());
        assertEquals("场地证明仅支持 PDF、JPG、PNG 或 WEBP 文件", error.getMessage());
        verify(privateAssetMapper, never()).insert(any());
    }

    @Test
    void uploadRejectsMismatchedOriginalExtension() throws Exception {
        when(userAccessService.requireAdminOrOrganizer(APPLICANT_ID)).thenReturn(user(APPLICANT_ID, "organizer"));
        PrivateAssetService service = service(Files.createTempDirectory("omni-private-asset-test"));
        MockMultipartFile file = new MockMultipartFile("file", "proof.txt", "application/pdf", "%PDF-1.7\ncontent".getBytes());

        BusinessException error = assertThrows(BusinessException.class,
                () -> service.upload(APPLICANT_ID, "venue-proof", file));

        assertEquals(400, error.getCode());
        assertEquals("场地证明仅支持 PDF、JPG、PNG 或 WEBP 文件", error.getMessage());
        verify(privateAssetMapper, never()).insert(any());
    }

    @Test
    void uploadRejectsFileLargerThan20Mb() throws Exception {
        when(userAccessService.requireAdminOrOrganizer(APPLICANT_ID)).thenReturn(user(APPLICANT_ID, "organizer"));
        PrivateAssetService service = service(Files.createTempDirectory("omni-private-asset-test"));
        MockMultipartFile file = new MockMultipartFile("file", "proof.pdf", "application/pdf", new byte[20 * 1024 * 1024 + 1]);

        BusinessException error = assertThrows(BusinessException.class,
                () -> service.upload(APPLICANT_ID, "venue-proof", file));

        assertEquals(400, error.getCode());
        assertEquals("场地证明文件不能超过20MB", error.getMessage());
        verify(privateAssetMapper, never()).insert(any());
    }

    @Test
    void bindVenueProofMarksPendingAssetAsBound() throws Exception {
        when(userAccessService.requireAdminOrOrganizer(APPLICANT_ID)).thenReturn(user(APPLICANT_ID, "organizer"));
        PrivateAsset asset = pendingAsset(9101L, APPLICANT_ID, Files.createTempDirectory("omni-private-asset-test"));
        when(privateAssetMapper.selectById(9101L)).thenReturn(asset);
        PrivateAssetService service = service(Files.createTempDirectory("omni-private-asset-test"));

        PrivateAssetResponse response = service.bindVenueProof(9101L, 301L, APPLICANT_ID);

        assertEquals(301L, response.getBizId());
        assertEquals("bound", response.getStatus());
        assertEquals(301L, asset.getBizId());
        assertEquals("bound", asset.getStatus());
        assertNotNull(asset.getBindTime());
        verify(privateAssetMapper).updateById(asset);
    }

    @Test
    void getByIdReturnsAssetResponse() throws Exception {
        Path privateRoot = Files.createTempDirectory("omni-private-asset-test");
        PrivateAsset asset = pendingAsset(9101L, APPLICANT_ID, privateRoot);
        when(privateAssetMapper.selectById(9101L)).thenReturn(asset);
        PrivateAssetService service = service(privateRoot);

        PrivateAssetResponse response = service.getById(9101L);

        assertEquals(9101L, response.getId());
        assertEquals("venue-proof", response.getBizType());
        assertEquals("pending", response.getStatus());
    }

    @Test
    void prepareDownloadAllowsPendingUploader() throws Exception {
        Path privateRoot = Files.createTempDirectory("omni-private-asset-test");
        PrivateAsset asset = pendingAsset(9101L, APPLICANT_ID, privateRoot);
        when(privateAssetMapper.selectById(9101L)).thenReturn(asset);
        when(userAccessService.requireAdminOrOrganizer(APPLICANT_ID)).thenReturn(user(APPLICANT_ID, "organizer"));
        PrivateAssetService service = service(privateRoot);

        PrivateAssetDownload download = service.prepareDownload(9101L, APPLICANT_ID);

        assertEquals(privateRoot.resolve(asset.getRelativePath()), download.getPath());
        assertEquals("proof.pdf", download.getOriginalFilename());
        assertEquals("application/pdf", download.getContentType());
        assertEquals(asset.getFileSize().longValue(), download.getFileSize());
    }

    @Test
    void prepareDownloadAllowsPendingAdminForReview() throws Exception {
        Path privateRoot = Files.createTempDirectory("omni-private-asset-test");
        PrivateAsset asset = pendingAsset(9101L, APPLICANT_ID, privateRoot);
        when(privateAssetMapper.selectById(9101L)).thenReturn(asset);
        when(userAccessService.requireAdminOrOrganizer(ADMIN_ID)).thenReturn(user(ADMIN_ID, "admin"));
        PrivateAssetService service = service(privateRoot);

        PrivateAssetDownload download = service.prepareDownload(9101L, ADMIN_ID);

        assertEquals(privateRoot.resolve(asset.getRelativePath()), download.getPath());
    }

    @Test
    void prepareDownloadRejectsPendingNonUploader() throws Exception {
        Path privateRoot = Files.createTempDirectory("omni-private-asset-test");
        PrivateAsset asset = pendingAsset(9101L, APPLICANT_ID, privateRoot);
        when(privateAssetMapper.selectById(9101L)).thenReturn(asset);
        when(userAccessService.requireAdminOrOrganizer(OTHER_ORGANIZER_ID)).thenReturn(user(OTHER_ORGANIZER_ID, "organizer"));
        PrivateAssetService service = service(privateRoot);

        BusinessException error = assertThrows(BusinessException.class,
                () -> service.prepareDownload(9101L, OTHER_ORGANIZER_ID));

        assertEquals(403, error.getCode());
    }

    @Test
    void prepareDownloadAllowsBoundVenueProofAdminOrApplicant() throws Exception {
        Path privateRoot = Files.createTempDirectory("omni-private-asset-test");
        PrivateAsset asset = boundAsset(9101L, APPLICANT_ID, privateRoot);
        when(privateAssetMapper.selectById(9101L)).thenReturn(asset);
        when(userAccessService.requireAdminOrOrganizer(ADMIN_ID)).thenReturn(user(ADMIN_ID, "admin"));
        when(userAccessService.requireAdminOrOrganizer(APPLICANT_ID)).thenReturn(user(APPLICANT_ID, "organizer"));
        when(venueApplicationMapper.selectById(301L)).thenReturn(venueApplication(301L, APPLICANT_ID));
        PrivateAssetService service = service(privateRoot);

        assertEquals(privateRoot.resolve(asset.getRelativePath()), service.prepareDownload(9101L, ADMIN_ID).getPath());
        assertEquals(privateRoot.resolve(asset.getRelativePath()), service.prepareDownload(9101L, APPLICANT_ID).getPath());
    }

    @Test
    void prepareDownloadRejectsBoundVenueProofOtherOrganizer() throws Exception {
        Path privateRoot = Files.createTempDirectory("omni-private-asset-test");
        PrivateAsset asset = boundAsset(9101L, APPLICANT_ID, privateRoot);
        when(privateAssetMapper.selectById(9101L)).thenReturn(asset);
        when(userAccessService.requireAdminOrOrganizer(OTHER_ORGANIZER_ID)).thenReturn(user(OTHER_ORGANIZER_ID, "organizer"));
        when(venueApplicationMapper.selectById(301L)).thenReturn(venueApplication(301L, APPLICANT_ID));
        PrivateAssetService service = service(privateRoot);

        BusinessException error = assertThrows(BusinessException.class,
                () -> service.prepareDownload(9101L, OTHER_ORGANIZER_ID));

        assertEquals(403, error.getCode());
    }

    @Test
    void prepareDownloadAllowsBoundVenueProofApplicantFromVenueApplicationEvenWhenNotUploader() throws Exception {
        Path privateRoot = Files.createTempDirectory("omni-private-asset-test");
        PrivateAsset asset = boundAsset(9101L, OTHER_ORGANIZER_ID, privateRoot);
        when(privateAssetMapper.selectById(9101L)).thenReturn(asset);
        when(userAccessService.requireAdminOrOrganizer(APPLICANT_ID)).thenReturn(user(APPLICANT_ID, "organizer"));
        when(venueApplicationMapper.selectById(301L)).thenReturn(venueApplication(301L, APPLICANT_ID));
        PrivateAssetService service = service(privateRoot);

        assertEquals(privateRoot.resolve(asset.getRelativePath()), service.prepareDownload(9101L, APPLICANT_ID).getPath());
    }

    @Test
    void prepareDownloadRejectsBoundVenueProofUploaderWhenNotVenueApplicationApplicant() throws Exception {
        Path privateRoot = Files.createTempDirectory("omni-private-asset-test");
        PrivateAsset asset = boundAsset(9101L, OTHER_ORGANIZER_ID, privateRoot);
        when(privateAssetMapper.selectById(9101L)).thenReturn(asset);
        when(userAccessService.requireAdminOrOrganizer(OTHER_ORGANIZER_ID)).thenReturn(user(OTHER_ORGANIZER_ID, "organizer"));
        when(venueApplicationMapper.selectById(301L)).thenReturn(venueApplication(301L, APPLICANT_ID));
        PrivateAssetService service = service(privateRoot);

        BusinessException error = assertThrows(BusinessException.class,
                () -> service.prepareDownload(9101L, OTHER_ORGANIZER_ID));

        assertEquals(403, error.getCode());
    }

    @Test
    void getByIdReturns404ForDeletedStatus() throws Exception {
        Path privateRoot = Files.createTempDirectory("omni-private-asset-test");
        PrivateAsset asset = pendingAsset(9101L, APPLICANT_ID, privateRoot);
        asset.setStatus("deleted");
        when(privateAssetMapper.selectById(9101L)).thenReturn(asset);
        PrivateAssetService service = service(privateRoot);

        BusinessException error = assertThrows(BusinessException.class, () -> service.getById(9101L));

        assertEquals(404, error.getCode());
    }

    @Test
    void prepareDownloadReturns404WhenDeletedAtIsSet() throws Exception {
        Path privateRoot = Files.createTempDirectory("omni-private-asset-test");
        PrivateAsset asset = pendingAsset(9101L, APPLICANT_ID, privateRoot);
        asset.setDeletedAt(LocalDateTime.now());
        when(privateAssetMapper.selectById(9101L)).thenReturn(asset);
        when(userAccessService.requireAdminOrOrganizer(APPLICANT_ID)).thenReturn(user(APPLICANT_ID, "organizer"));
        PrivateAssetService service = service(privateRoot);

        BusinessException error = assertThrows(BusinessException.class,
                () -> service.prepareDownload(9101L, APPLICANT_ID));

        assertEquals(404, error.getCode());
    }

    @Test
    void prepareDownloadRejectsPathTraversal() throws Exception {
        Path privateRoot = Files.createTempDirectory("omni-private-asset-test");
        Path outside = Files.createTempFile("omni-private-asset-outside", ".pdf");
        Files.write(outside, "%PDF-1.7\ncontent".getBytes());
        PrivateAsset asset = pendingAsset(9101L, APPLICANT_ID, privateRoot);
        asset.setRelativePath("../" + outside.getFileName());
        when(privateAssetMapper.selectById(9101L)).thenReturn(asset);
        when(userAccessService.requireAdminOrOrganizer(APPLICANT_ID)).thenReturn(user(APPLICANT_ID, "organizer"));
        PrivateAssetService service = service(privateRoot);

        BusinessException error = assertThrows(BusinessException.class,
                () -> service.prepareDownload(9101L, APPLICANT_ID));

        assertEquals(403, error.getCode());
    }

    private MockMultipartFile pdfFile() {
        return new MockMultipartFile("file", "proof.pdf", "application/pdf", "%PDF-1.7\ncontent".getBytes());
    }

    private MockMultipartFile pngFile() {
        return new MockMultipartFile("file", "proof.png", "image/png",
                new byte[] {(byte) 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a});
    }

    private PrivateAsset pendingAsset(Long id, Long uploaderId, Path privateRoot) throws Exception {
        Path file = privateRoot.resolve("venue-proof/2026/05/proof.pdf");
        Files.createDirectories(file.getParent());
        Files.write(file, "%PDF-1.7\ncontent".getBytes());

        PrivateAsset asset = new PrivateAsset();
        asset.setId(id);
        asset.setServiceName("ticket");
        asset.setBizType("venue-proof");
        asset.setUploaderId(uploaderId);
        asset.setOriginalFilename("proof.pdf");
        asset.setStoredFilename("proof.pdf");
        asset.setRelativePath("venue-proof/2026/05/proof.pdf");
        asset.setContentType("application/pdf");
        asset.setFileSize(Files.size(file));
        asset.setStatus("pending");
        return asset;
    }

    private PrivateAsset boundAsset(Long id, Long uploaderId, Path privateRoot) throws Exception {
        PrivateAsset asset = pendingAsset(id, uploaderId, privateRoot);
        asset.setBizId(301L);
        asset.setStatus("bound");
        return asset;
    }

    private InternalUserRefResponse user(Long id, String role) {
        InternalUserRefResponse user = new InternalUserRefResponse();
        user.setId(id);
        user.setRole(role);
        return user;
    }

    private VenueApplication venueApplication(Long id, Long applicantId) {
        VenueApplication application = new VenueApplication();
        application.setId(id);
        application.setApplicantId(applicantId);
        return application;
    }

    private PrivateAssetService service(Path privateRoot) {
        return new PrivateAssetService(privateAssetMapper, venueApplicationMapper, userAccessService, privateRoot.toString());
    }
}
