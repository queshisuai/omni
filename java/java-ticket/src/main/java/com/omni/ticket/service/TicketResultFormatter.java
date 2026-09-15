package com.omni.ticket.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.omni.ai.client.AiModelClient;
import com.omni.ai.dto.AiMessage;
import com.omni.ai.dto.AiRequest;
import com.omni.ai.dto.AiResponse;
import com.omni.ai.prompt.PromptTemplate;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.util.HashSet;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class TicketResultFormatter {
    private static final Pattern ARABIC_NUMBER = Pattern.compile("(?<![\\p{L}])\\d+(?:[,.]\\d+)?");
    private static final Pattern INVENTORY_QUANTITY = Pattern.compile(
            "(\\d+(?:[,.]\\d+)?)\\s*(?:张(?:票)?|票|个(?:票|票档))");
    private static final Pattern CHINESE_QUANTITY = Pattern.compile(
            "[零一二三四五六七八九十百千万亿两]+\\s*(?:个|张|人|场|档|票|元|块)");
    private static final Pattern BUSINESS_ACTION = Pattern.compile(
            ".*(?:立即|马上|请)?(?:下单|购买|购票|支付|锁座|锁库存|退款).*");
    private static final Pattern ADJACENCY_CLAIM = Pattern.compile(
            ".*(?:连座|相邻座位|坐一起|挨着).*");
    private static final List<String> GENERIC_FACT_PHRASES = List.of(
            "已根据实时票务数据找到", "已为你找到", "已找到", "暂未找到",
            "符合条件的", "可售票档", "票档", "其中", "满足", "购票需求",
            "实时票务数据", "请调整", "城市", "日期", "价格", "或", "人数",
            "条件", "后重试", "个", "人", "场次", "演出", "有");
    private static final PromptTemplate PROMPT = PromptTemplate.fromResource(
            TicketResultFormatter.class,
            "/prompts/ticket-finder-explanation-v1.txt",
            "ticket-finder-explanation",
            "v1",
            java.util.Set.of("facts"));

    private final AiModelClient modelClient;
    private final ObjectMapper objectMapper;

    public TicketResultFormatter(AiModelClient modelClient, ObjectMapper objectMapper) {
        this.modelClient = modelClient;
        this.objectMapper = objectMapper;
    }

    public String explain(String requestId, List<TicketFinderResult> results, Integer peopleCount) {
        String fallback = fallback(results, peopleCount);
        if (results == null || results.isEmpty()) {
            return fallback;
        }
        try {
            String facts = objectMapper.writeValueAsString(toFactDtos(results));
            AiResponse response = modelClient.generate(new AiRequest(
                    requestId,
                    null,
                    PROMPT.render(Map.of("facts", facts)),
                    List.of(new AiMessage("user", "请根据事实包生成说明。")),
                    0D,
                    300,
                    2048));
            return response != null && StringUtils.hasText(response.getText())
                    && isSafeExplanation(response.getText(), results, peopleCount)
                    ? response.getText().trim()
                    : fallback;
        } catch (RuntimeException | JsonProcessingException exception) {
            return fallback;
        }
    }

    public String fallback(List<TicketFinderResult> results, Integer peopleCount) {
        int count = results == null ? 0 : results.size();
        if (count == 0) {
            return "暂未找到符合条件的可售票档，请调整城市、日期、价格或人数条件后重试。";
        }
        if (peopleCount == null) {
            return "已根据实时票务数据找到 " + count + " 个符合条件的可售票档。";
        }
        long enough = results.stream()
                .filter(result -> result.getAvailableQuantity() != null
                        && result.getAvailableQuantity() >= peopleCount)
                .count();
        return "已根据实时票务数据找到 " + count + " 个符合条件的可售票档，其中 "
                + enough + " 个满足 " + peopleCount + " 人购票需求。";
    }

    private boolean isSafeExplanation(String value, List<TicketFinderResult> results, Integer peopleCount) {
        String normalized = value.toLowerCase(java.util.Locale.ROOT);
        return value.length() <= 500
                && !normalized.contains("http://")
                && !normalized.contains("https://")
                && !normalized.contains("jdbc:")
                && !normalized.matches(".*\\b(select|insert|update|delete|drop)\\b.*")
                && !BUSINESS_ACTION.matcher(value).matches()
                && !ADJACENCY_CLAIM.matcher(value).matches()
                && !CHINESE_QUANTITY.matcher(value).find()
                && containsOnlyFactNumbers(value, results, peopleCount)
                && containsOnlyFactQuantities(value, results)
                && containsOnlyFactText(value, results);
    }

    private boolean containsOnlyFactNumbers(String value, List<TicketFinderResult> results, Integer peopleCount) {
        Set<BigDecimal> allowed = new HashSet<>();
        allowed.add(BigDecimal.valueOf(results.size()));
        if (peopleCount != null) {
            allowed.add(BigDecimal.valueOf(peopleCount));
        }
        for (TicketFinderResult result : results) {
            if (result.getAvailableQuantity() != null) {
                allowed.add(BigDecimal.valueOf(result.getAvailableQuantity()));
            }
            if (result.getPrice() != null) {
                allowed.add(result.getPrice());
            }
        }
        Matcher matcher = ARABIC_NUMBER.matcher(value);
        while (matcher.find()) {
            String token = matcher.group().replace(",", "");
            try {
                BigDecimal number = new BigDecimal(token);
                if (allowed.stream().noneMatch(allowedNumber -> number.compareTo(allowedNumber) == 0)) {
                    return false;
                }
            } catch (NumberFormatException exception) {
                return false;
            }
        }
        return true;
    }

    private boolean containsOnlyFactQuantities(String value, List<TicketFinderResult> results) {
        Set<BigDecimal> availableQuantities = new HashSet<>();
        for (TicketFinderResult result : results) {
            if (result.getAvailableQuantity() != null) {
                availableQuantities.add(BigDecimal.valueOf(result.getAvailableQuantity()));
            }
        }
        Matcher matcher = INVENTORY_QUANTITY.matcher(value);
        while (matcher.find()) {
            try {
                BigDecimal quantity = new BigDecimal(matcher.group(1).replace(",", ""));
                if (availableQuantities.stream()
                        .noneMatch(available -> quantity.compareTo(available) == 0)) {
                    return false;
                }
            } catch (NumberFormatException exception) {
                return false;
            }
        }
        return true;
    }

    private boolean containsOnlyFactText(String value, List<TicketFinderResult> results) {
        String remaining = value;
        Set<String> factValues = new HashSet<>();
        for (TicketFinderResult result : results) {
            addFactValue(factValues, result.getActivityName());
            addFactValue(factValues, result.getVenueName());
            addFactValue(factValues, result.getCity());
            addFactValue(factValues, result.getTicketTypeName());
            addFactValue(factValues, result.getSaleStatus());
        }
        List<String> values = new ArrayList<>(factValues);
        values.sort(Comparator.comparingInt(String::length).reversed());
        for (String factValue : values) {
            remaining = remaining.replace(factValue, "");
        }
        remaining = ARABIC_NUMBER.matcher(remaining).replaceAll("");
        remaining = remaining.replaceAll("[\\p{Punct}\\p{IsPunctuation}\\p{Z}\\s]", "");
        List<String> generic = new ArrayList<>(GENERIC_FACT_PHRASES);
        generic.sort(Comparator.comparingInt(String::length).reversed());
        for (String phrase : generic) {
            remaining = remaining.replace(phrase, "");
        }
        return remaining.isEmpty();
    }

    private void addFactValue(Set<String> values, String value) {
        if (StringUtils.hasText(value)) {
            values.add(value);
        }
    }

    private List<ExplanationFact> toFactDtos(List<TicketFinderResult> results) {
        List<ExplanationFact> facts = new ArrayList<>();
        for (TicketFinderResult result : results) {
            facts.add(new ExplanationFact(
                    result.getActivityId(),
                    result.getActivityName(),
                    result.getSessionId(),
                    result.getSessionStartTime(),
                    result.getVenueId(),
                    result.getVenueName(),
                    result.getCity(),
                    result.getTicketTypeId(),
                    result.getTicketTypeName(),
                    result.getPrice(),
                    result.getAvailableQuantity(),
                    result.getSaleStatus()));
        }
        return facts;
    }

    private static final class ExplanationFact {
        private final Long activityId;
        private final String activityName;
        private final Long sessionId;
        private final java.time.LocalDateTime sessionStartTime;
        private final Long venueId;
        private final String venueName;
        private final String city;
        private final Long ticketTypeId;
        private final String ticketTypeName;
        private final BigDecimal price;
        private final Integer availableQuantity;
        private final String saleStatus;

        private ExplanationFact(Long activityId, String activityName, Long sessionId,
                                java.time.LocalDateTime sessionStartTime, Long venueId,
                                String venueName, String city, Long ticketTypeId,
                                String ticketTypeName, BigDecimal price,
                                Integer availableQuantity, String saleStatus) {
            this.activityId = activityId;
            this.activityName = activityName;
            this.sessionId = sessionId;
            this.sessionStartTime = sessionStartTime;
            this.venueId = venueId;
            this.venueName = venueName;
            this.city = city;
            this.ticketTypeId = ticketTypeId;
            this.ticketTypeName = ticketTypeName;
            this.price = price;
            this.availableQuantity = availableQuantity;
            this.saleStatus = saleStatus;
        }

        public Long getActivityId() { return activityId; }
        public String getActivityName() { return activityName; }
        public Long getSessionId() { return sessionId; }
        public java.time.LocalDateTime getSessionStartTime() { return sessionStartTime; }
        public Long getVenueId() { return venueId; }
        public String getVenueName() { return venueName; }
        public String getCity() { return city; }
        public Long getTicketTypeId() { return ticketTypeId; }
        public String getTicketTypeName() { return ticketTypeName; }
        public BigDecimal getPrice() { return price; }
        public Integer getAvailableQuantity() { return availableQuantity; }
        public String getSaleStatus() { return saleStatus; }
    }
}
