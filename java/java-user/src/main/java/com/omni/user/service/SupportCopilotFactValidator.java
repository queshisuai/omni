package com.omni.user.service;

import com.omni.user.dto.SupportContextResponse;
import com.omni.user.dto.SupportCopilotModelOutput;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class SupportCopilotFactValidator {
    private static final Pattern ORDER_NO = Pattern.compile(
            "(?i)(?:订单号|orderNo)\\s*[:：#]?\\s*([A-Za-z0-9][A-Za-z0-9-]{2,})");
    private static final Pattern TICKET_ID = Pattern.compile(
            "(?i)(?:票券\\s*ID|票券号|票号|ticketId)\\s*[:：#]?\\s*(\\d+)");
    private static final Pattern AMOUNT = Pattern.compile(
            "(?:订单|退款|支付)?金额\\s*(?:为|是|[:：])?\\s*[¥￥]?\\s*(\\d+(?:\\.\\d{1,2})?)");

    private SupportCopilotFactValidator() {
    }

    public static void validate(SupportCopilotModelOutput output, SupportContextResponse context) {
        if (output == null || output.getSuggestionText() == null || output.getSuggestionText().isBlank()) {
            throw new IllegalArgumentException("模型未返回建议文本");
        }
        Set<String> knownFactKeys = new HashSet<>(SupportCopilotFactCatalog.keys(context));
        if (output.getSourceEvidence() != null) {
            for (SupportCopilotModelOutput.SourceEvidenceItem item : output.getSourceEvidence()) {
                if (item == null || item.getFactKey() == null || !knownFactKeys.contains(item.getFactKey())) {
                    throw new IllegalArgumentException("模型引用了不存在的事实");
                }
            }
        }
        String text = allText(output);
        validateOrderNumbers(text, context);
        validateTicketIds(text, context);
        validateAmounts(text, context);
        validateNumericStatuses(text, context);
    }

    private static void validateOrderNumbers(String text, SupportContextResponse context) {
        Set<String> known = new HashSet<>();
        if (context != null && context.getOrders() != null) {
            context.getOrders().forEach(item -> {
                if (item != null && item.getOrderNo() != null) known.add(item.getOrderNo());
            });
        }
        if (context != null && context.getRefunds() != null) {
            context.getRefunds().forEach(item -> {
                if (item != null && item.getOrderNo() != null) known.add(item.getOrderNo());
            });
        }
        Matcher matcher = ORDER_NO.matcher(text);
        while (matcher.find()) {
            if (!known.contains(matcher.group(1))) {
                throw new IllegalArgumentException("模型生成了不一致的订单号");
            }
        }
    }

    private static void validateTicketIds(String text, SupportContextResponse context) {
        Set<Long> known = new HashSet<>();
        if (context != null && context.getTickets() != null) {
            context.getTickets().forEach(item -> {
                if (item != null && item.getTicketId() != null) known.add(item.getTicketId());
            });
        }
        Matcher matcher = TICKET_ID.matcher(text);
        while (matcher.find()) {
            if (!known.contains(Long.valueOf(matcher.group(1)))) {
                throw new IllegalArgumentException("模型生成了不一致的票券 ID");
            }
        }
    }

    private static void validateAmounts(String text, SupportContextResponse context) {
        Set<BigDecimal> known = new HashSet<>();
        if (context != null && context.getOrders() != null) {
            context.getOrders().forEach(item -> {
                if (item != null && item.getAmount() != null) known.add(item.getAmount());
            });
        }
        Matcher matcher = AMOUNT.matcher(text);
        while (matcher.find()) {
            BigDecimal amount = new BigDecimal(matcher.group(1));
            if (!known.contains(amount)) {
                throw new IllegalArgumentException("模型生成了不一致的金额");
            }
        }
    }

    private static void validateNumericStatuses(String text, SupportContextResponse context) {
        List<Integer> known = new ArrayList<>();
        if (context != null) {
            if (context.getOrders() != null) context.getOrders().forEach(i -> {
                if (i != null && i.getStatus() != null) known.add(i.getStatus());
            });
            if (context.getRefunds() != null) context.getRefunds().forEach(i -> {
                if (i != null && i.getStatus() != null) known.add(i.getStatus());
            });
            if (context.getTickets() != null) context.getTickets().forEach(i -> {
                if (i != null && i.getStatus() != null) known.add(i.getStatus());
            });
        }
        Matcher matcher = Pattern.compile("(?:订单|退款|票券)状态\\s*(?:为|是|[:：])?\\s*(\\d+)").matcher(text);
        while (matcher.find()) {
            if (!known.contains(Integer.valueOf(matcher.group(1)))) {
                throw new IllegalArgumentException("模型生成了不一致的状态");
            }
        }
    }

    private static String allText(SupportCopilotModelOutput output) {
        StringBuilder value = new StringBuilder();
        append(value, output.getSuggestionText());
        append(value, output.getSummary());
        append(value, output.getIssueType());
        append(value, output.getRecommendedAction());
        if (output.getMissingInformation() != null) {
            output.getMissingInformation().forEach(item -> append(value, item));
        }
        return value.toString();
    }

    private static void append(StringBuilder target, String value) {
        if (value != null) target.append(value).append('\n');
    }
}
