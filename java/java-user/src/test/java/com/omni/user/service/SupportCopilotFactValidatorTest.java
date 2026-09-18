package com.omni.user.service;

import com.omni.user.dto.SupportContextResponse;
import com.omni.user.dto.SupportCopilotModelOutput;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertThrows;

class SupportCopilotFactValidatorTest {

    @Test
    void rejectsOrderNumberAmountAndTicketIdThatAreNotInContext() {
        SupportContextResponse context = SupportContextResponse.empty(10L, 20L, "用户", null);
        SupportContextResponse.SupportContextOrder order = new SupportContextResponse.SupportContextOrder();
        order.setOrderNo("DM-100");
        order.setAmount(new BigDecimal("120.00"));
        order.setStatus(2);
        context.setOrders(java.util.List.of(order));
        SupportContextResponse.SupportContextTicket ticket = new SupportContextResponse.SupportContextTicket();
        ticket.setTicketId(6001L);
        context.setTickets(java.util.List.of(ticket));

        SupportCopilotModelOutput output = SupportCopilotModelOutput.parseStrict(
                "{\"suggestionText\":\"订单号 DM-999，金额为 999，票券 ID 6002\","
                        + "\"sourceEvidence\":[{\"factKey\":\"order.orderNo\"}]}");

        assertThrows(IllegalArgumentException.class,
                () -> SupportCopilotFactValidator.validate(output, context));
    }

    @Test
    void rejectsUnknownNumericStatus() {
        SupportContextResponse context = SupportContextResponse.empty(10L, 20L, "用户", null);
        SupportContextResponse.SupportContextOrder order = new SupportContextResponse.SupportContextOrder();
        order.setStatus(2);
        context.setOrders(java.util.List.of(order));

        SupportCopilotModelOutput output = SupportCopilotModelOutput.parseStrict(
                "{\"suggestionText\":\"订单状态为 9\",\"sourceEvidence\":[]}");

        assertThrows(IllegalArgumentException.class,
                () -> SupportCopilotFactValidator.validate(output, context));
    }
}
