package com.omni.user.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

public class SupportContextResponse {

    private Long conversationId;
    private SupportContextUser user;
    private List<SupportContextOrder> orders = new ArrayList<>();
    private List<SupportContextRefund> refunds = new ArrayList<>();
    private List<SupportContextTicket> tickets = new ArrayList<>();
    private List<SupportContextWaitlist> waitlist = new ArrayList<>();
    private List<SupportContextGrabRequest> grabRequests = new ArrayList<>();
    private List<SupportContextNotification> notifications = new ArrayList<>();
    private List<SupportContextError> errors = new ArrayList<>();

    public static SupportContextResponse empty(Long conversationId, Long userId, String nickname, String phoneMask) {
        SupportContextResponse response = new SupportContextResponse();
        response.setConversationId(conversationId);
        SupportContextUser user = new SupportContextUser();
        user.setUserId(userId);
        user.setNickname(nickname);
        user.setPhoneMask(phoneMask);
        response.setUser(user);
        return response;
    }

    public void addError(String section, String message) {
        SupportContextError error = new SupportContextError();
        error.setSection(section);
        error.setMessage(message);
        errors.add(error);
    }

    public Long getConversationId() { return conversationId; }
    public void setConversationId(Long conversationId) { this.conversationId = conversationId; }

    public SupportContextUser getUser() { return user; }
    public void setUser(SupportContextUser user) { this.user = user; }

    public List<SupportContextOrder> getOrders() { return orders; }
    public void setOrders(List<SupportContextOrder> orders) { this.orders = orders != null ? orders : new ArrayList<>(); }

    public List<SupportContextRefund> getRefunds() { return refunds; }
    public void setRefunds(List<SupportContextRefund> refunds) { this.refunds = refunds != null ? refunds : new ArrayList<>(); }

    public List<SupportContextTicket> getTickets() { return tickets; }
    public void setTickets(List<SupportContextTicket> tickets) { this.tickets = tickets != null ? tickets : new ArrayList<>(); }

    public List<SupportContextWaitlist> getWaitlist() { return waitlist; }
    public void setWaitlist(List<SupportContextWaitlist> waitlist) { this.waitlist = waitlist != null ? waitlist : new ArrayList<>(); }

    public List<SupportContextGrabRequest> getGrabRequests() { return grabRequests; }
    public void setGrabRequests(List<SupportContextGrabRequest> grabRequests) { this.grabRequests = grabRequests != null ? grabRequests : new ArrayList<>(); }

    public List<SupportContextNotification> getNotifications() { return notifications; }
    public void setNotifications(List<SupportContextNotification> notifications) { this.notifications = notifications != null ? notifications : new ArrayList<>(); }

    public List<SupportContextError> getErrors() { return errors; }
    public void setErrors(List<SupportContextError> errors) { this.errors = errors != null ? errors : new ArrayList<>(); }

    public static class SupportContextUser {
        private Long userId;
        private String nickname;
        private String phoneMask;

        public Long getUserId() { return userId; }
        public void setUserId(Long userId) { this.userId = userId; }

        public String getNickname() { return nickname; }
        public void setNickname(String nickname) { this.nickname = nickname; }

        public String getPhoneMask() { return phoneMask; }
        public void setPhoneMask(String phoneMask) { this.phoneMask = phoneMask; }
    }

    public static class SupportContextOrder {
        private Long id;
        private String orderNo;
        private Integer status;
        private BigDecimal amount;
        private String activityName;
        private LocalDateTime sessionTime;
        private String href;

        public Long getId() { return id; }
        public void setId(Long id) { this.id = id; }

        public String getOrderNo() { return orderNo; }
        public void setOrderNo(String orderNo) { this.orderNo = orderNo; }

        public Integer getStatus() { return status; }
        public void setStatus(Integer status) { this.status = status; }

        public BigDecimal getAmount() { return amount; }
        public void setAmount(BigDecimal amount) { this.amount = amount; }

        public String getActivityName() { return activityName; }
        public void setActivityName(String activityName) { this.activityName = activityName; }

        public LocalDateTime getSessionTime() { return sessionTime; }
        public void setSessionTime(LocalDateTime sessionTime) { this.sessionTime = sessionTime; }

        public String getHref() { return href; }
        public void setHref(String href) { this.href = href; }
    }

    public static class SupportContextRefund {
        private Long id;
        private Long orderId;
        private String orderNo;
        private Integer status;
        private String reason;
        private String href;

        public Long getId() { return id; }
        public void setId(Long id) { this.id = id; }

        public Long getOrderId() { return orderId; }
        public void setOrderId(Long orderId) { this.orderId = orderId; }

        public String getOrderNo() { return orderNo; }
        public void setOrderNo(String orderNo) { this.orderNo = orderNo; }

        public Integer getStatus() { return status; }
        public void setStatus(Integer status) { this.status = status; }

        public String getReason() { return reason; }
        public void setReason(String reason) { this.reason = reason; }

        public String getHref() { return href; }
        public void setHref(String href) { this.href = href; }
    }

    public static class SupportContextTicket {
        private Long ticketId;
        private Long orderId;
        private String activityName;
        private LocalDateTime sessionTime;
        private Integer status;
        private Boolean checkedIn;
        private String href;

        public Long getTicketId() { return ticketId; }
        public void setTicketId(Long ticketId) { this.ticketId = ticketId; }

        public Long getOrderId() { return orderId; }
        public void setOrderId(Long orderId) { this.orderId = orderId; }

        public String getActivityName() { return activityName; }
        public void setActivityName(String activityName) { this.activityName = activityName; }

        public LocalDateTime getSessionTime() { return sessionTime; }
        public void setSessionTime(LocalDateTime sessionTime) { this.sessionTime = sessionTime; }

        public Integer getStatus() { return status; }
        public void setStatus(Integer status) { this.status = status; }

        public Boolean getCheckedIn() { return checkedIn; }
        public void setCheckedIn(Boolean checkedIn) { this.checkedIn = checkedIn; }

        public String getHref() { return href; }
        public void setHref(String href) { this.href = href; }
    }

    public static class SupportContextWaitlist {
        private Long id;
        private Long sessionId;
        private Long ticketTypeId;
        private Integer quantity;
        private String status;
        private Integer rank;
        private String estimatedWaitText;

        public Long getId() { return id; }
        public void setId(Long id) { this.id = id; }

        public Long getSessionId() { return sessionId; }
        public void setSessionId(Long sessionId) { this.sessionId = sessionId; }

        public Long getTicketTypeId() { return ticketTypeId; }
        public void setTicketTypeId(Long ticketTypeId) { this.ticketTypeId = ticketTypeId; }

        public Integer getQuantity() { return quantity; }
        public void setQuantity(Integer quantity) { this.quantity = quantity; }

        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }

        public Integer getRank() { return rank; }
        public void setRank(Integer rank) { this.rank = rank; }

        public String getEstimatedWaitText() { return estimatedWaitText; }
        public void setEstimatedWaitText(String estimatedWaitText) { this.estimatedWaitText = estimatedWaitText; }
    }

    public static class SupportContextGrabRequest {
        private String requestId;
        private Long sessionId;
        private Long ticketTypeId;
        private Integer quantity;
        private String status;
        private Integer queueRank;
        private String progressMessage;
        private String failReason;
        private String href;

        public String getRequestId() { return requestId; }
        public void setRequestId(String requestId) { this.requestId = requestId; }

        public Long getSessionId() { return sessionId; }
        public void setSessionId(Long sessionId) { this.sessionId = sessionId; }

        public Long getTicketTypeId() { return ticketTypeId; }
        public void setTicketTypeId(Long ticketTypeId) { this.ticketTypeId = ticketTypeId; }

        public Integer getQuantity() { return quantity; }
        public void setQuantity(Integer quantity) { this.quantity = quantity; }

        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }

        public Integer getQueueRank() { return queueRank; }
        public void setQueueRank(Integer queueRank) { this.queueRank = queueRank; }

        public String getProgressMessage() { return progressMessage; }
        public void setProgressMessage(String progressMessage) { this.progressMessage = progressMessage; }

        public String getFailReason() { return failReason; }
        public void setFailReason(String failReason) { this.failReason = failReason; }

        public String getHref() { return href; }
        public void setHref(String href) { this.href = href; }
    }

    public static class SupportContextNotification {
        private Long id;
        private String title;
        private String content;
        private String type;
        private Boolean read;
        private LocalDateTime createTime;

        public Long getId() { return id; }
        public void setId(Long id) { this.id = id; }

        public String getTitle() { return title; }
        public void setTitle(String title) { this.title = title; }

        public String getContent() { return content; }
        public void setContent(String content) { this.content = content; }

        public String getType() { return type; }
        public void setType(String type) { this.type = type; }

        public Boolean getRead() { return read; }
        public void setRead(Boolean read) { this.read = read; }

        public LocalDateTime getCreateTime() { return createTime; }
        public void setCreateTime(LocalDateTime createTime) { this.createTime = createTime; }
    }

    public static class SupportContextError {
        private String section;
        private String message;

        public String getSection() { return section; }
        public void setSection(String section) { this.section = section; }

        public String getMessage() { return message; }
        public void setMessage(String message) { this.message = message; }
    }
}
