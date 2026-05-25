package com.omni.ticket.dto;

import com.omni.ticket.entity.PrivateAsset;

import java.time.LocalDateTime;

public class PrivateAssetResponse {
    private Long id;
    private String bizType;
    private Long bizId;
    private String originalFilename;
    private String contentType;
    private Long fileSize;
    private String status;
    private LocalDateTime createTime;

    public static PrivateAssetResponse from(PrivateAsset asset) {
        if (asset == null) return null;
        PrivateAssetResponse response = new PrivateAssetResponse();
        response.setId(asset.getId());
        response.setBizType(asset.getBizType());
        response.setBizId(asset.getBizId());
        response.setOriginalFilename(asset.getOriginalFilename());
        response.setContentType(asset.getContentType());
        response.setFileSize(asset.getFileSize());
        response.setStatus(asset.getStatus());
        response.setCreateTime(asset.getCreateTime());
        return response;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getBizType() { return bizType; }
    public void setBizType(String bizType) { this.bizType = bizType; }
    public Long getBizId() { return bizId; }
    public void setBizId(Long bizId) { this.bizId = bizId; }
    public String getOriginalFilename() { return originalFilename; }
    public void setOriginalFilename(String originalFilename) { this.originalFilename = originalFilename; }
    public String getContentType() { return contentType; }
    public void setContentType(String contentType) { this.contentType = contentType; }
    public Long getFileSize() { return fileSize; }
    public void setFileSize(Long fileSize) { this.fileSize = fileSize; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public LocalDateTime getCreateTime() { return createTime; }
    public void setCreateTime(LocalDateTime createTime) { this.createTime = createTime; }
}
