package com.omni.user.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.omni.common.result.ResultCode;
import com.omni.exception.BusinessException;
import com.omni.user.dto.OrganizerApplicationMaterialResponse;
import com.omni.user.entity.OrganizerApplication;
import com.omni.user.entity.OrganizerApplicationMaterial;
import com.omni.user.entity.UserAsset;
import com.omni.user.mapper.OrganizerApplicationMapper;
import com.omni.user.mapper.OrganizerApplicationMaterialMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class OrganizerApplicationMaterialService {

    private static final int STATUS_PENDING = 0;
    private static final Set<String> MATERIAL_TYPES = Set.of(
            "BUSINESS_LICENSE", "ID_CARD_FRONT", "ID_CARD_BACK", "OTHER_QUALIFICATION");
    private static final Set<String> SINGLE_MATERIAL_TYPES = Set.of(
            "BUSINESS_LICENSE", "ID_CARD_FRONT", "ID_CARD_BACK");

    private final OrganizerApplicationMapper applicationMapper;
    private final OrganizerApplicationMaterialMapper materialMapper;
    private final UserAssetService assetService;

    public OrganizerApplicationMaterialService(OrganizerApplicationMapper applicationMapper,
                                               OrganizerApplicationMaterialMapper materialMapper,
                                               UserAssetService assetService) {
        this.applicationMapper = applicationMapper;
        this.materialMapper = materialMapper;
        this.assetService = assetService;
    }

    @Transactional
    public OrganizerApplicationMaterialResponse upload(Long userId, Long applicationId,
                                                       String materialType, MultipartFile file) {
        OrganizerApplication application = requireApplication(applicationId);
        if (!userId.equals(application.getUserId())) {
            throw new BusinessException(ResultCode.FORBIDDEN, "无权操作该入驻申请");
        }
        if (!Integer.valueOf(STATUS_PENDING).equals(application.getStatus())) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "仅待审核申请可维护材料");
        }
        String normalizedType = normalizeMaterialType(materialType);
        List<OrganizerApplicationMaterial> previousMaterials = SINGLE_MATERIAL_TYPES.contains(normalizedType)
                ? materialMapper.selectList(new LambdaQueryWrapper<OrganizerApplicationMaterial>()
                .eq(OrganizerApplicationMaterial::getApplicationId, applicationId)
                .eq(OrganizerApplicationMaterial::getMaterialType, normalizedType))
                : List.of();
        UserAsset asset = assetService.uploadImageAsset(userId, "organizer_application", file);
        try {
            OrganizerApplicationMaterial material = new OrganizerApplicationMaterial();
            material.setApplicationId(applicationId);
            material.setAssetId(asset.getId());
            material.setMaterialType(normalizedType);
            materialMapper.insert(material);
            for (OrganizerApplicationMaterial previous : previousMaterials) {
                materialMapper.deleteById(previous.getId());
                assetService.deleteAsset(assetService.getAsset(previous.getAssetId()));
            }
            return toResponse(material, asset);
        } catch (RuntimeException e) {
            assetService.deleteAsset(asset);
            throw e;
        }
    }

    @Transactional(readOnly = true)
    public List<OrganizerApplicationMaterialResponse> list(Long userId, Long applicationId) {
        OrganizerApplication application = requireApplication(applicationId);
        if (!userId.equals(application.getUserId())) {
            throw new BusinessException(ResultCode.FORBIDDEN, "无权查看该入驻申请");
        }
        return listByApplication(applicationId);
    }

    public List<OrganizerApplicationMaterialResponse> listByApplication(Long applicationId) {
        List<OrganizerApplicationMaterial> materials = materialMapper.selectList(
                new LambdaQueryWrapper<OrganizerApplicationMaterial>()
                        .eq(OrganizerApplicationMaterial::getApplicationId, applicationId)
                        .orderByDesc(OrganizerApplicationMaterial::getCreateTime)
                        .orderByDesc(OrganizerApplicationMaterial::getId));
        return materials.stream()
                .map(material -> toResponse(material, assetService.getAsset(material.getAssetId())))
                .collect(Collectors.toList());
    }

    private OrganizerApplication requireApplication(Long applicationId) {
        if (applicationId == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "入驻申请编号不能为空");
        }
        OrganizerApplication application = applicationMapper.selectById(applicationId);
        if (application == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "入驻申请不存在");
        }
        return application;
    }

    private String normalizeMaterialType(String materialType) {
        String normalized = materialType == null ? "" : materialType.trim().toUpperCase();
        if (!MATERIAL_TYPES.contains(normalized)) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "材料类型不正确");
        }
        return normalized;
    }

    private OrganizerApplicationMaterialResponse toResponse(OrganizerApplicationMaterial material, UserAsset asset) {
        if (asset == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "材料资产不存在");
        }
        OrganizerApplicationMaterialResponse response = new OrganizerApplicationMaterialResponse();
        response.setId(material.getId());
        response.setMaterialType(material.getMaterialType());
        response.setAssetId(material.getAssetId());
        response.setPublicUrl(asset.getPublicUrl());
        response.setOriginalName(asset.getOriginalName());
        response.setMimeType(asset.getMimeType());
        response.setSizeBytes(asset.getSizeBytes());
        response.setCreateTime(material.getCreateTime());
        return response;
    }
}
