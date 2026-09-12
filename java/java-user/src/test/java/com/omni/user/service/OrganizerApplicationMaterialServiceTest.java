package com.omni.user.service;

import com.omni.exception.BusinessException;
import com.omni.user.entity.OrganizerApplication;
import com.omni.user.entity.UserAsset;
import com.omni.user.mapper.OrganizerApplicationMapper;
import com.omni.user.mapper.OrganizerApplicationMaterialMapper;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class OrganizerApplicationMaterialServiceTest {

    private final OrganizerApplicationMapper applicationMapper = mock(OrganizerApplicationMapper.class);
    private final OrganizerApplicationMaterialMapper materialMapper = mock(OrganizerApplicationMaterialMapper.class);
    private final UserAssetService assetService = mock(UserAssetService.class);
    private final OrganizerApplicationMaterialService service =
            new OrganizerApplicationMaterialService(applicationMapper, materialMapper, assetService);

    @Test
    void uploadRejectsApplicationOwnedByAnotherUser() {
        when(applicationMapper.selectById(11L)).thenReturn(application(11L, 2004L, 0));

        BusinessException error = assertThrows(BusinessException.class,
                () -> service.upload(2005L, 11L, "BUSINESS_LICENSE", image()));

        assertEquals("无权操作该入驻申请", error.getMessage());
        verify(materialMapper, never()).insert(any());
        verifyNoInteractions(assetService);
    }

    @Test
    void uploadRejectsApprovedOrRejectedApplication() {
        when(applicationMapper.selectById(11L)).thenReturn(application(11L, 2004L, 1));

        BusinessException error = assertThrows(BusinessException.class,
                () -> service.upload(2004L, 11L, "BUSINESS_LICENSE", image()));

        assertEquals("仅待审核申请可维护材料", error.getMessage());
        verifyNoInteractions(assetService);
    }

    @Test
    void uploadCreatesUserAssetAndApplicationMaterial() {
        UserAsset asset = new UserAsset();
        asset.setId(31L);
        asset.setBizType("organizer_application_business_license");
        asset.setPublicUrl("/uploads/user/organizer/license.jpg");
        asset.setOriginalName("license.jpg");
        asset.setMimeType("image/jpeg");
        asset.setSizeBytes(4L);
        when(applicationMapper.selectById(11L)).thenReturn(application(11L, 2004L, 0));
        when(assetService.uploadImageAsset(eq(2004L), eq("organizer_application"), any())).thenReturn(asset);
        when(materialMapper.insert(any())).thenAnswer(invocation -> {
            var material = invocation.getArgument(0, com.omni.user.entity.OrganizerApplicationMaterial.class);
            material.setId(41L);
            return 1;
        });

        var response = service.upload(2004L, 11L, "BUSINESS_LICENSE", image());

        assertEquals(41L, response.getId());
        assertEquals(31L, response.getAssetId());
        assertEquals("BUSINESS_LICENSE", response.getMaterialType());
        assertEquals("/uploads/user/organizer/license.jpg", response.getPublicUrl());
        verify(materialMapper).insert(any());
    }

    @Test
    void uploadReplacesPreviousSingleMaterialType() {
        UserAsset newAsset = new UserAsset();
        newAsset.setId(32L);
        newAsset.setPublicUrl("/uploads/license-new.jpg");
        newAsset.setOriginalName("license-new.jpg");
        newAsset.setMimeType("image/jpeg");
        newAsset.setSizeBytes(4L);
        var previous = new com.omni.user.entity.OrganizerApplicationMaterial();
        previous.setId(41L);
        previous.setApplicationId(11L);
        previous.setAssetId(31L);
        previous.setMaterialType("BUSINESS_LICENSE");
        UserAsset previousAsset = new UserAsset();
        previousAsset.setId(31L);
        when(applicationMapper.selectById(11L)).thenReturn(application(11L, 2004L, 0));
        when(materialMapper.selectList(any())).thenReturn(List.of(previous));
        when(assetService.uploadImageAsset(eq(2004L), eq("organizer_application"), any())).thenReturn(newAsset);
        when(assetService.getAsset(31L)).thenReturn(previousAsset);
        when(materialMapper.insert(any())).thenAnswer(invocation -> {
            var material = invocation.getArgument(0, com.omni.user.entity.OrganizerApplicationMaterial.class);
            material.setId(42L);
            return 1;
        });

        var response = service.upload(2004L, 11L, "BUSINESS_LICENSE", image());

        assertEquals(42L, response.getId());
        assertEquals(32L, response.getAssetId());
        verify(materialMapper).deleteById(41L);
        verify(assetService).deleteAsset(previousAsset);
    }

    @Test
    void listReturnsMaterialResponsesForOwner() {
        UserAsset asset = new UserAsset();
        asset.setId(31L);
        asset.setPublicUrl("/uploads/license.jpg");
        asset.setOriginalName("license.jpg");
        asset.setMimeType("image/jpeg");
        asset.setSizeBytes(4L);
        var material = new com.omni.user.entity.OrganizerApplicationMaterial();
        material.setId(41L);
        material.setApplicationId(11L);
        material.setAssetId(31L);
        material.setMaterialType("BUSINESS_LICENSE");
        when(applicationMapper.selectById(11L)).thenReturn(application(11L, 2004L, 0));
        when(materialMapper.selectList(any())).thenReturn(List.of(material));
        when(assetService.getAsset(31L)).thenReturn(asset);

        assertEquals(1, service.list(2004L, 11L).size());
        assertEquals("license.jpg", service.list(2004L, 11L).get(0).getOriginalName());
    }

    private OrganizerApplication application(Long id, Long userId, int status) {
        OrganizerApplication application = new OrganizerApplication();
        application.setId(id);
        application.setUserId(userId);
        application.setStatus(status);
        return application;
    }

    private MockMultipartFile image() {
        return new MockMultipartFile("file", "license.jpg", "image/jpeg", new byte[] {(byte) 0xff, (byte) 0xd8, (byte) 0xff, 0});
    }
}
