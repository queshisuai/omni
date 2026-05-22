package com.omni.ticket.dto;

public class ArtistSubmissionRequest {
    private Long userId;
    private String name;
    private String alias;
    private String artistType;
    private String countryOrRegion;
    private String agency;
    private String representativeWorks;
    private String categoryTags;
    private String description;
    private String sourceNote;

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getAlias() { return alias; }
    public void setAlias(String alias) { this.alias = alias; }
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
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getSourceNote() { return sourceNote; }
    public void setSourceNote(String sourceNote) { this.sourceNote = sourceNote; }
}
