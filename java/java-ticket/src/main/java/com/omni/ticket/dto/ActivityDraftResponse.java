package com.omni.ticket.dto;

import com.omni.ticket.entity.Activity;
import com.omni.ticket.entity.Station;

public class ActivityDraftResponse {
    private final Activity activity;
    private final Station station;

    public ActivityDraftResponse(Activity activity, Station station) {
        this.activity = activity;
        this.station = station;
    }

    public Activity getActivity() {
        return activity;
    }

    public Station getStation() {
        return station;
    }
}
