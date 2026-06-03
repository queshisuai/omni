package com.omni.common.mq.message;

import java.io.Serializable;

/**
 * 搜索索引刷新消息。
 */
public class SearchIndexMessage implements Serializable {
    private static final long serialVersionUID = 1L;

    private String itemType;
    private Long itemId;
    private String action;

    public SearchIndexMessage() {}

    public SearchIndexMessage(String itemType, Long itemId, String action) {
        this.itemType = itemType;
        this.itemId = itemId;
        this.action = action;
    }

    public String getItemType() { return itemType; }
    public void setItemType(String itemType) { this.itemType = itemType; }
    public Long getItemId() { return itemId; }
    public void setItemId(Long itemId) { this.itemId = itemId; }
    public String getAction() { return action; }
    public void setAction(String action) { this.action = action; }
}
