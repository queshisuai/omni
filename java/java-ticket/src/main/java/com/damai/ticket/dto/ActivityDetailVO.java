package com.damai.ticket.dto;

import com.damai.ticket.entity.*;

import java.util.List;

/**
 * 活动详情
 */
public class ActivityDetailVO {

    private Activity activity;
    private Category category;
    private Artist artist;
    private List<SessionDetail> sessions;

    public Activity getActivity() { return activity; }
    public void setActivity(Activity activity) { this.activity = activity; }
    public Category getCategory() { return category; }
    public void setCategory(Category category) { this.category = category; }
    public Artist getArtist() { return artist; }
    public void setArtist(Artist artist) { this.artist = artist; }
    public List<SessionDetail> getSessions() { return sessions; }
    public void setSessions(List<SessionDetail> sessions) { this.sessions = sessions; }

    /**
     * 场次详情（含票档列表和场馆信息）
     */
    public static class SessionDetail {
        private Session session;
        private Venue venue;
        private List<TicketType> ticketTypes;

        public Session getSession() { return session; }
        public void setSession(Session session) { this.session = session; }
        public Venue getVenue() { return venue; }
        public void setVenue(Venue venue) { this.venue = venue; }
        public List<TicketType> getTicketTypes() { return ticketTypes; }
        public void setTicketTypes(List<TicketType> ticketTypes) { this.ticketTypes = ticketTypes; }
    }
}
