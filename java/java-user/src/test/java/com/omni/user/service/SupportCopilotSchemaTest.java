package com.omni.user.service;

import com.omni.user.dto.SupportCopilotModelOutput;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class SupportCopilotSchemaTest {

    @Test
    void rejectsUnknownFieldsAndEvidenceTextFromTheModel() {
        assertThrows(IllegalArgumentException.class,
                () -> SupportCopilotModelOutput.parseStrict(
                        "{\"suggestionText\":\"请核实\",\"unknown\":\"x\",\"sourceEvidence\":[]}"));
        assertThrows(IllegalArgumentException.class,
                () -> SupportCopilotModelOutput.parseStrict(
                        "{\"suggestionText\":\"请核实\",\"sourceEvidence\":[{\"factKey\":\"order.orderNo\",\"text\":\"自由文本\"}]}"));

        SupportCopilotModelOutput output = SupportCopilotModelOutput.parseStrict(
                "{\"suggestionText\":\"请核实订单\",\"summary\":\"需要核实\",\"issueType\":\"ORDER\","
                        + "\"recommendedAction\":\"人工核对\",\"missingInformation\":[],"
                        + "\"sourceEvidence\":[{\"factKey\":\"order.orderNo\"}]}");
        assertEquals("请核实订单", output.getSuggestionText());
        assertEquals("order.orderNo", output.getSourceEvidence().get(0).getFactKey());
    }

    @Test
    void rejectsScalarTypeCoercion() {
        assertThrows(IllegalArgumentException.class,
                () -> SupportCopilotModelOutput.parseStrict(
                        "{\"suggestionText\":123,\"sourceEvidence\":[]}"));
    }

    @Test
    void rejectsMalformedJson() {
        assertThrows(IllegalArgumentException.class,
                () -> SupportCopilotModelOutput.parseStrict(
                        "{\"suggestionText\":\"请核实\",\"sourceEvidence\":"));
    }
}
