package com.omni.user.service;

import com.omni.user.dto.SupportContextResponse;
import com.omni.user.dto.CsCopilotSourceEvidenceResponse;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;

class SupportCopilotFactCatalogTest {

    @Test
    void exposesOnlyWhitelistedFactsAndHydratesEvidenceOnTheServer() {
        SupportContextResponse context = SupportContextResponse.empty(10L, 20L, "用户", "139****0001");
        SupportContextResponse.SupportContextOrder order = new SupportContextResponse.SupportContextOrder();
        order.setOrderNo("DM-100");
        order.setAmount(new BigDecimal("120.00"));
        order.setStatus(2);
        context.setOrders(List.of(order));

        List<String> keys = SupportCopilotFactCatalog.keys(context);

        assertEquals(List.of("order.amount", "order.orderNo", "order.status"), keys);
        assertFalse(keys.stream().anyMatch(key -> key.contains("href")));

        List<CsCopilotSourceEvidenceResponse> evidence =
                SupportCopilotFactCatalog.hydrateEvidence(List.of("order.orderNo"), context);
        assertEquals("order.orderNo", evidence.get(0).getFactKey());
        assertEquals("订单号为 DM-100", evidence.get(0).getText());
        assertThrows(IllegalArgumentException.class,
                () -> SupportCopilotFactCatalog.hydrateEvidence(List.of("order.missing"), context));
    }
}
