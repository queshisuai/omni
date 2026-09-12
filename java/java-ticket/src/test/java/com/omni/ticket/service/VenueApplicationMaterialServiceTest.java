package com.omni.ticket.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.omni.exception.BusinessException;
import com.omni.ticket.dto.PrivateAssetResponse;
import com.omni.ticket.dto.VenueApplicationMaterialRequest;
import com.omni.ticket.dto.VenueApplicationMaterialResponse;
import com.omni.ticket.entity.PrivateAsset;
import com.omni.ticket.entity.VenueApplicationMaterial;
import com.omni.ticket.mapper.PrivateAssetMapper;
import com.omni.ticket.mapper.VenueApplicationMaterialMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class VenueApplicationMaterialServiceTest {

    @Mock
    private VenueApplicationMaterialMapper materialMapper;
    @Mock
    private PrivateAssetMapper privateAssetMapper;
    @Mock
    private PrivateAssetService privateAssetService;

    private VenueApplicationMaterialService service;

    @BeforeEach
    void setUp() {
        service = new VenueApplicationMaterialService(materialMapper, privateAssetMapper, privateAssetService);
    }

    @Test
    void bindsFireAndLeaseMaterialsToApplication() {
        VenueApplicationMaterialRequest fire = request("FIRE_SAFETY_PERMIT", 11L);
        VenueApplicationMaterialRequest lease = request("VENUE_LEASE_AGREEMENT", 12L);
        when(privateAssetService.bindVenueMaterial(11L, 301L, 2003L, "venue-fire-safety"))
                .thenReturn(assetResponse(11L));
        when(privateAssetService.bindVenueMaterial(12L, 301L, 2003L, "venue-lease-agreement"))
                .thenReturn(assetResponse(12L));

        service.saveMaterials(301L, 2003L, List.of(fire, lease));

        ArgumentCaptor<VenueApplicationMaterial> captor = ArgumentCaptor.forClass(VenueApplicationMaterial.class);
        verify(materialMapper, org.mockito.Mockito.times(2)).insert(captor.capture());
        assertEquals(List.of("FIRE_SAFETY_PERMIT", "VENUE_LEASE_AGREEMENT"),
                captor.getAllValues().stream().map(VenueApplicationMaterial::getMaterialType).collect(Collectors.toList()));
        assertTrue(captor.getAllValues().stream().allMatch(item -> Long.valueOf(301L).equals(item.getVenueApplicationId())));
    }

    @Test
    void rejectsUnknownMaterialType() {
        BusinessException error = assertThrows(BusinessException.class,
                () -> service.normalizeMaterialType("OTHER"));

        assertEquals(400, error.getCode());
        assertEquals("场馆材料类型不支持", error.getMessage());
    }

    @Test
    void listsMaterialsWithPrivateAssetMetadata() {
        VenueApplicationMaterial material = new VenueApplicationMaterial();
        material.setId(21L);
        material.setVenueApplicationId(301L);
        material.setMaterialType("FIRE_SAFETY_PERMIT");
        material.setAssetId(11L);
        material.setValidFrom(LocalDateTime.parse("2026-06-01T00:00:00"));
        material.setValidTo(LocalDateTime.parse("2026-06-30T23:59:00"));
        when(materialMapper.selectList(any())).thenReturn(List.of(material));
        PrivateAsset asset = new PrivateAsset();
        asset.setId(11L);
        asset.setOriginalFilename("fire.pdf");
        asset.setContentType("application/pdf");
        asset.setFileSize(1024L);
        when(privateAssetMapper.selectBatchIds(List.of(11L))).thenReturn(List.of(asset));

        List<VenueApplicationMaterialResponse> result = service.listMaterials(301L);

        assertEquals(1, result.size());
        assertEquals("消防安全检查合格证明", result.get(0).getLabel());
        assertEquals("fire.pdf", result.get(0).getAsset().getOriginalFilename());
        assertEquals(LocalDateTime.parse("2026-06-30T23:59:00"), result.get(0).getValidTo());
        assertEquals(Boolean.FALSE, result.get(0).getLegacy());
    }

    private VenueApplicationMaterialRequest request(String type, Long assetId) {
        VenueApplicationMaterialRequest request = new VenueApplicationMaterialRequest();
        request.setMaterialType(type);
        request.setAssetId(assetId);
        request.setValidFrom(LocalDateTime.parse("2026-06-01T00:00:00"));
        request.setValidTo(LocalDateTime.parse("2026-06-30T23:59:00"));
        return request;
    }

    private PrivateAssetResponse assetResponse(Long assetId) {
        PrivateAssetResponse response = new PrivateAssetResponse();
        response.setId(assetId);
        return response;
    }
}
