package com.omni.ticket.dto;

import java.math.BigDecimal;
import java.util.List;

public class TicketTypeBatchUpdateRequest {
    private List<Long> ids;
    private String action;
    private BigDecimal price;
    private Integer status;
    private Integer totalStock;

    public List<Long> getIds() { return ids; }
    public void setIds(List<Long> ids) { this.ids = ids; }
    public String getAction() { return action; }
    public void setAction(String action) { this.action = action; }
    public BigDecimal getPrice() { return price; }
    public void setPrice(BigDecimal price) { this.price = price; }
    public Integer getStatus() { return status; }
    public void setStatus(Integer status) { this.status = status; }
    public Integer getTotalStock() { return totalStock; }
    public void setTotalStock(Integer totalStock) { this.totalStock = totalStock; }
}
