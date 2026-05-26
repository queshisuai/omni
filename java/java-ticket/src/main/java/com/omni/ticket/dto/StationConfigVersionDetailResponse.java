package com.omni.ticket.dto;

import com.omni.ticket.entity.Station;

import java.util.ArrayList;
import java.util.List;

public class StationConfigVersionDetailResponse {
    private Station station;
    private List<StationConfigVersionResponse> versions = new ArrayList<>();

    public Station getStation() { return station; }
    public void setStation(Station station) { this.station = station; }
    public List<StationConfigVersionResponse> getVersions() { return versions; }
    public void setVersions(List<StationConfigVersionResponse> versions) { this.versions = versions; }
}
