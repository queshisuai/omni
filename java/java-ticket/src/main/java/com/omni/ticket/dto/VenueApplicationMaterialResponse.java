package com.omni.ticket.dto;

import java.time.LocalDateTime;

public class VenueApplicationMaterialResponse {
    private Long id;
    private String materialType;
    private Long assetId;
    private String note;
    private LocalDateTime validFrom;
    private LocalDateTime validTo;
    private PrivateAssetResponse asset;
    private String label;
    private Boolean legacy;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getMaterialType() { return materialType; }
    public void setMaterialType(String materialType) { this.materialType = materialType; }
    public Long getAssetId() { return assetId; }
    public void setAssetId(Long assetId) { this.assetId = assetId; }
    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }
    public LocalDateTime getValidFrom() { return validFrom; }
    public void setValidFrom(LocalDateTime validFrom) { this.validFrom = validFrom; }
    public LocalDateTime getValidTo() { return validTo; }
    public void setValidTo(LocalDateTime validTo) { this.validTo = validTo; }
    public PrivateAssetResponse getAsset() { return asset; }
    public void setAsset(PrivateAssetResponse asset) { this.asset = asset; }
    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }
    public Boolean getLegacy() { return legacy; }
    public void setLegacy(Boolean legacy) { this.legacy = legacy; }
}
