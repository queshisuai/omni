package com.omni.ticket.dto;

public class ActivityArtistDto {
    private Long artistId;
    private String name;
    private String alias;
    private String artistType;
    private String countryOrRegion;
    private String categoryTags;
    private String avatar;
    private Boolean isPrimary;
    private String roleType;
    private String roleName;
    private String visibility;
    private Integer sort;

    public Long getArtistId() { return artistId; }
    public void setArtistId(Long artistId) { this.artistId = artistId; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getAlias() { return alias; }
    public void setAlias(String alias) { this.alias = alias; }
    public String getArtistType() { return artistType; }
    public void setArtistType(String artistType) { this.artistType = artistType; }
    public String getCountryOrRegion() { return countryOrRegion; }
    public void setCountryOrRegion(String countryOrRegion) { this.countryOrRegion = countryOrRegion; }
    public String getCategoryTags() { return categoryTags; }
    public void setCategoryTags(String categoryTags) { this.categoryTags = categoryTags; }
    public String getAvatar() { return avatar; }
    public void setAvatar(String avatar) { this.avatar = avatar; }
    public Boolean getPrimary() { return isPrimary; }
    public void setPrimary(Boolean primary) { isPrimary = primary; }
    public String getRoleType() { return roleType; }
    public void setRoleType(String roleType) { this.roleType = roleType; }
    public String getRoleName() { return roleName; }
    public void setRoleName(String roleName) { this.roleName = roleName; }
    public String getVisibility() { return visibility; }
    public void setVisibility(String visibility) { this.visibility = visibility; }
    public Integer getSort() { return sort; }
    public void setSort(Integer sort) { this.sort = sort; }
}
