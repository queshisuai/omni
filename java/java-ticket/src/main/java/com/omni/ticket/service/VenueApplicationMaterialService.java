package com.omni.ticket.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.omni.exception.BusinessException;
import com.omni.ticket.dto.PrivateAssetResponse;
import com.omni.ticket.dto.VenueApplicationMaterialRequest;
import com.omni.ticket.dto.VenueApplicationMaterialResponse;
import com.omni.ticket.entity.PrivateAsset;
import com.omni.ticket.entity.VenueApplicationMaterial;
import com.omni.ticket.mapper.PrivateAssetMapper;
import com.omni.ticket.mapper.VenueApplicationMaterialMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class VenueApplicationMaterialService {
    public static final String FIRE_SAFETY_PERMIT = "FIRE_SAFETY_PERMIT";
    public static final String VENUE_LEASE_AGREEMENT = "VENUE_LEASE_AGREEMENT";
    public static final String LEGACY_GENERAL_PROOF = "LEGACY_GENERAL_PROOF";

    private final VenueApplicationMaterialMapper materialMapper;
    private final PrivateAssetMapper privateAssetMapper;
    private final PrivateAssetService privateAssetService;

    public VenueApplicationMaterialService(VenueApplicationMaterialMapper materialMapper,
                                           PrivateAssetMapper privateAssetMapper,
                                           PrivateAssetService privateAssetService) {
        this.materialMapper = materialMapper;
        this.privateAssetMapper = privateAssetMapper;
        this.privateAssetService = privateAssetService;
    }

    public String normalizeMaterialType(String materialType) {
        if (FIRE_SAFETY_PERMIT.equals(materialType) || VENUE_LEASE_AGREEMENT.equals(materialType)) {
            return materialType;
        }
        throw new BusinessException(400, "场馆材料类型不支持");
    }

    @Transactional
    public void saveMaterials(Long applicationId, Long userId, List<VenueApplicationMaterialRequest> requests) {
        if (applicationId == null || requests == null || requests.isEmpty()) {
            return;
        }
        for (VenueApplicationMaterialRequest request : requests) {
            if (request == null) {
                continue;
            }
            String materialType = normalizeMaterialType(request.getMaterialType());
            if (request.getAssetId() == null) {
                throw new BusinessException(400, "场馆材料附件不能为空");
            }
            String bizType = FIRE_SAFETY_PERMIT.equals(materialType)
                    ? "venue-fire-safety" : "venue-lease-agreement";
            privateAssetService.bindVenueMaterial(request.getAssetId(), applicationId, userId, bizType);
            materialMapper.delete(new LambdaQueryWrapper<VenueApplicationMaterial>()
                    .eq(VenueApplicationMaterial::getVenueApplicationId, applicationId)
                    .eq(VenueApplicationMaterial::getMaterialType, materialType));
            VenueApplicationMaterial material = new VenueApplicationMaterial();
            material.setVenueApplicationId(applicationId);
            material.setMaterialType(materialType);
            material.setAssetId(request.getAssetId());
            material.setNote(trim(request.getNote()));
            material.setValidFrom(request.getValidFrom());
            material.setValidTo(request.getValidTo());
            material.setCreateTime(LocalDateTime.now());
            material.setUpdateTime(LocalDateTime.now());
            materialMapper.insert(material);
        }
    }

    public List<VenueApplicationMaterialResponse> listMaterials(Long applicationId) {
        if (applicationId == null) {
            return Collections.emptyList();
        }
        List<VenueApplicationMaterial> rows = materialMapper.selectList(new LambdaQueryWrapper<VenueApplicationMaterial>()
                .eq(VenueApplicationMaterial::getVenueApplicationId, applicationId)
                .orderByDesc(VenueApplicationMaterial::getCreateTime)
                .orderByDesc(VenueApplicationMaterial::getId));
        if (rows == null || rows.isEmpty()) {
            return Collections.emptyList();
        }
        List<Long> assetIds = rows.stream().map(VenueApplicationMaterial::getAssetId)
                .filter(id -> id != null).distinct().collect(Collectors.toList());
        Map<Long, PrivateAsset> assets = privateAssetMapper.selectBatchIds(assetIds).stream()
                .collect(Collectors.toMap(PrivateAsset::getId, Function.identity(), (left, right) -> left));
        return rows.stream().map(row -> {
            VenueApplicationMaterialResponse response = new VenueApplicationMaterialResponse();
            response.setId(row.getId());
            response.setMaterialType(row.getMaterialType());
            response.setAssetId(row.getAssetId());
            response.setNote(row.getNote());
            response.setValidFrom(row.getValidFrom());
            response.setValidTo(row.getValidTo());
            response.setAsset(PrivateAssetResponse.from(assets.get(row.getAssetId())));
            response.setLabel(labelOf(row.getMaterialType()));
            response.setLegacy(Boolean.FALSE);
            return response;
        }).collect(Collectors.toList());
    }

    public VenueApplicationMaterialResponse legacyProof(PrivateAssetResponse asset, String note, String fileUrl) {
        if (asset == null && trim(note) == null && trim(fileUrl) == null) {
            return null;
        }
        VenueApplicationMaterialResponse response = new VenueApplicationMaterialResponse();
        response.setMaterialType(LEGACY_GENERAL_PROOF);
        response.setAssetId(asset == null ? null : asset.getId());
        response.setAsset(asset);
        response.setNote(trim(note) != null ? trim(note) : trim(fileUrl));
        response.setLabel("通用审批综合证明材料（历史凭证）");
        response.setLegacy(Boolean.TRUE);
        return response;
    }

    private String labelOf(String materialType) {
        if (FIRE_SAFETY_PERMIT.equals(materialType)) return "消防安全检查合格证明";
        if (VENUE_LEASE_AGREEMENT.equals(materialType)) return "场地租赁/运营授权协议";
        return "场馆资质材料";
    }

    private String trim(String value) {
        return value == null ? null : value.trim();
    }
}
