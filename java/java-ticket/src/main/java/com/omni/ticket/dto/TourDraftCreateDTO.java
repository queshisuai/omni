package com.omni.ticket.dto;

import java.util.List;

public class TourDraftCreateDTO {
    private String title;
    private Long categoryId;
    private Long artistId;
    private String poster;
    private String description;
    private Long organizerId;
    private List<TourStationCityDTO> cities;

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public Long getCategoryId() { return categoryId; }
    public void setCategoryId(Long categoryId) { this.categoryId = categoryId; }
    public Long getArtistId() { return artistId; }
    public void setArtistId(Long artistId) { this.artistId = artistId; }
    public String getPoster() { return poster; }
    public void setPoster(String poster) { this.poster = poster; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public Long getOrganizerId() { return organizerId; }
    public void setOrganizerId(Long organizerId) { this.organizerId = organizerId; }
    public List<TourStationCityDTO> getCities() { return cities; }
    public void setCities(List<TourStationCityDTO> cities) { this.cities = cities; }
}
