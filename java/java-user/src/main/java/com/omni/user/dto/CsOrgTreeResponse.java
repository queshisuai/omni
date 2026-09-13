package com.omni.user.dto;

import java.util.ArrayList;
import java.util.List;

public class CsOrgTreeResponse {
    private Long activeCount;
    private Long totalCount;
    private Long publicPoolCount;
    private Long publicPoolTimeoutCount;
    private Long aiResolvedCount;
    private Long aiHumanCount;
    private List<Group> groups = new ArrayList<>();

    public Long getActiveCount() { return activeCount; }
    public void setActiveCount(Long activeCount) { this.activeCount = activeCount; }

    public Long getTotalCount() { return totalCount; }
    public void setTotalCount(Long totalCount) { this.totalCount = totalCount; }

    public Long getPublicPoolCount() { return publicPoolCount; }
    public void setPublicPoolCount(Long publicPoolCount) { this.publicPoolCount = publicPoolCount; }

    public Long getPublicPoolTimeoutCount() { return publicPoolTimeoutCount; }
    public void setPublicPoolTimeoutCount(Long publicPoolTimeoutCount) { this.publicPoolTimeoutCount = publicPoolTimeoutCount; }

    public Long getAiResolvedCount() { return aiResolvedCount; }
    public void setAiResolvedCount(Long aiResolvedCount) { this.aiResolvedCount = aiResolvedCount; }

    public Long getAiHumanCount() { return aiHumanCount; }
    public void setAiHumanCount(Long aiHumanCount) { this.aiHumanCount = aiHumanCount; }

    public List<Group> getGroups() { return groups; }
    public void setGroups(List<Group> groups) { this.groups = groups == null ? new ArrayList<>() : groups; }

    public static class Group {
        private Long id;
        private String groupCode;
        private String groupName;
        private Long leaderUserId;
        private String leaderName;
        private Long activeCount;
        private Long totalCount;
        private Long waitingCount;
        private Long overdueCount;
        private List<Agent> agents = new ArrayList<>();

        public Long getId() { return id; }
        public void setId(Long id) { this.id = id; }
        public String getGroupCode() { return groupCode; }
        public void setGroupCode(String groupCode) { this.groupCode = groupCode; }
        public String getGroupName() { return groupName; }
        public void setGroupName(String groupName) { this.groupName = groupName; }
        public Long getLeaderUserId() { return leaderUserId; }
        public void setLeaderUserId(Long leaderUserId) { this.leaderUserId = leaderUserId; }
        public String getLeaderName() { return leaderName; }
        public void setLeaderName(String leaderName) { this.leaderName = leaderName; }
        public Long getActiveCount() { return activeCount; }
        public void setActiveCount(Long activeCount) { this.activeCount = activeCount; }
        public Long getTotalCount() { return totalCount; }
        public void setTotalCount(Long totalCount) { this.totalCount = totalCount; }
        public Long getWaitingCount() { return waitingCount; }
        public void setWaitingCount(Long waitingCount) { this.waitingCount = waitingCount; }
        public Long getOverdueCount() { return overdueCount; }
        public void setOverdueCount(Long overdueCount) { this.overdueCount = overdueCount; }
        public List<Agent> getAgents() { return agents; }
        public void setAgents(List<Agent> agents) { this.agents = agents == null ? new ArrayList<>() : agents; }
    }

    public static class Agent {
        private Long userId;
        private String agentName;
        private Integer agentStatus;
        private Long activeSessionCount;
        private Long totalCount;

        public Long getUserId() { return userId; }
        public void setUserId(Long userId) { this.userId = userId; }
        public String getAgentName() { return agentName; }
        public void setAgentName(String agentName) { this.agentName = agentName; }
        public Integer getAgentStatus() { return agentStatus; }
        public void setAgentStatus(Integer agentStatus) { this.agentStatus = agentStatus; }
        public Long getActiveSessionCount() { return activeSessionCount; }
        public void setActiveSessionCount(Long activeSessionCount) { this.activeSessionCount = activeSessionCount; }
        public Long getTotalCount() { return totalCount; }
        public void setTotalCount(Long totalCount) { this.totalCount = totalCount; }
    }
}
