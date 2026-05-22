package com.omni.ticket.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 艺人
 */
@TableName("artist")
public class Artist {

    @TableId(type = IdType.AUTO)
    private Long id;
    private String name;
    private String description;
    private String avatar;
    private Integer status;
    private LocalDateTime createTime;
    private String alias;
    private LocalDate birthDate;
    private Integer birthYear;
    private String gender;
    private String artistType;
    private String countryOrRegion;
    private String agency;
    private String representativeWorks;
    private String categoryTags;
    private String externalLinks;
    private String sourceNote;
    private String riskStatus;
    private String riskReason;
    private Long riskMarkedBy;
    private LocalDateTime riskMarkedAt;
    private Long riskClearedBy;
    private LocalDateTime riskClearedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getAvatar() { return avatar; }
    public void setAvatar(String avatar) { this.avatar = avatar; }
    public Integer getStatus() { return status; }
    public void setStatus(Integer status) { this.status = status; }
    public LocalDateTime getCreateTime() { return createTime; }
    public void setCreateTime(LocalDateTime createTime) { this.createTime = createTime; }
    public String getAlias() { return alias; }
    public void setAlias(String alias) { this.alias = alias; }
    public LocalDate getBirthDate() { return birthDate; }
    public void setBirthDate(LocalDate birthDate) { this.birthDate = birthDate; }
    public Integer getBirthYear() { return birthYear; }
    public void setBirthYear(Integer birthYear) { this.birthYear = birthYear; }
    public String getGender() { return gender; }
    public void setGender(String gender) { this.gender = gender; }
    public String getArtistType() { return artistType; }
    public void setArtistType(String artistType) { this.artistType = artistType; }
    public String getCountryOrRegion() { return countryOrRegion; }
    public void setCountryOrRegion(String countryOrRegion) { this.countryOrRegion = countryOrRegion; }
    public String getAgency() { return agency; }
    public void setAgency(String agency) { this.agency = agency; }
    public String getRepresentativeWorks() { return representativeWorks; }
    public void setRepresentativeWorks(String representativeWorks) { this.representativeWorks = representativeWorks; }
    public String getCategoryTags() { return categoryTags; }
    public void setCategoryTags(String categoryTags) { this.categoryTags = categoryTags; }
    public String getExternalLinks() { return externalLinks; }
    public void setExternalLinks(String externalLinks) { this.externalLinks = externalLinks; }
    public String getSourceNote() { return sourceNote; }
    public void setSourceNote(String sourceNote) { this.sourceNote = sourceNote; }
    public String getRiskStatus() { return riskStatus; }
    public void setRiskStatus(String riskStatus) { this.riskStatus = riskStatus; }
    public String getRiskReason() { return riskReason; }
    public void setRiskReason(String riskReason) { this.riskReason = riskReason; }
    public Long getRiskMarkedBy() { return riskMarkedBy; }
    public void setRiskMarkedBy(Long riskMarkedBy) { this.riskMarkedBy = riskMarkedBy; }
    public LocalDateTime getRiskMarkedAt() { return riskMarkedAt; }
    public void setRiskMarkedAt(LocalDateTime riskMarkedAt) { this.riskMarkedAt = riskMarkedAt; }
    public Long getRiskClearedBy() { return riskClearedBy; }
    public void setRiskClearedBy(Long riskClearedBy) { this.riskClearedBy = riskClearedBy; }
    public LocalDateTime getRiskClearedAt() { return riskClearedAt; }
    public void setRiskClearedAt(LocalDateTime riskClearedAt) { this.riskClearedAt = riskClearedAt; }
}
