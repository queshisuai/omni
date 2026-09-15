package com.omni.ticket.ai;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.MapperFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.omni.ai.client.AiModelClient;
import com.omni.ai.dto.AiMessage;
import com.omni.ai.dto.AiRequest;
import com.omni.ai.dto.AiResponse;
import com.omni.ai.prompt.PromptTemplate;
import com.omni.exception.BusinessException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.util.StringUtils;

import java.time.Clock;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;
import java.math.BigDecimal;
import java.util.List;
import java.util.ArrayList;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class TicketIntentParser {
    private static final Logger log = LoggerFactory.getLogger(TicketIntentParser.class);
    private static final int MAX_QUERY_LENGTH = 1000;
    private static final ZoneId DEFAULT_ZONE = ZoneId.of("Asia/Shanghai");
    private static final Pattern FULL_DATE = Pattern.compile(
            "(?<!\\d)(\\d{4})\\s*(?:年|[-/])\\s*(\\d{1,2})\\s*(?:月|[-/])\\s*(\\d{1,2})\\s*(?:日|号)?");
    private static final Pattern MONTH_DAY = Pattern.compile(
            "(?<!\\d)(\\d{1,2})\\s*月\\s*(\\d{1,2})\\s*(?:日|号)?");
    private static final Pattern PEOPLE_COUNT = Pattern.compile(
            "(\\d+|[零一二三四五六七八九十百千万两]+)(?:人|张|位|个)");
    private static final Pattern PRICE_RANGE_NUMERIC = Pattern.compile(
            "(?<!\\d)(\\d+(?:\\.\\d+)?)(?:元|块|人民币|¥|￥)?(?:到|至|-|~|～)"
                    + "(\\d+(?:\\.\\d+)?)(?:元|块|人民币|¥|￥)?");
    private static final Pattern PRICE_UPPER_NUMERIC = Pattern.compile(
            "(\\d+(?:\\.\\d+)?)(?:元|块|人民币|¥|￥)?(?:以内|以下)");
    private static final Pattern PRICE_UPPER_PREFIX = Pattern.compile(
            "(?:不超过|不高于|最多|上限|低于|少于)(\\d+(?:\\.\\d+)?)(?:元|块|人民币|¥|￥)?");
    private static final String PRICE_AMOUNT = "\\d+(?:\\.\\d+)?\\s*(?:元|块|人民币|¥|￥)?";
    private static final PromptTemplate PROMPT = PromptTemplate.fromResource(
            TicketIntentParser.class,
            "/prompts/ticket-finder-intent-v1.txt",
            "ticket-finder-intent",
            "v1",
            java.util.Set.of("currentDate"));

    private final AiModelClient modelClient;
    private final ObjectMapper objectMapper;
    private final Clock clock;
    private final String model;

    public TicketIntentParser(AiModelClient modelClient, ObjectMapper objectMapper, Clock clock, String model) {
        this.modelClient = modelClient;
        this.objectMapper = objectMapper;
        this.clock = clock == null ? Clock.system(DEFAULT_ZONE) : clock;
        this.model = model;
    }

    public TicketIntentParseResult parse(String query) {
        if (!StringUtils.hasText(query) || query.length() > MAX_QUERY_LENGTH) {
            throw new BusinessException(400, "找票内容不能为空且长度不能超过1000字");
        }
        String requestId = UUID.randomUUID().toString();
        AiResponse response;
        try {
            response = modelClient.generate(new AiRequest(
                    requestId,
                    model,
                    PROMPT.render(Map.of("currentDate", LocalDate.now(clock).toString())),
                    List.of(new AiMessage("user", query)),
                    0D,
                    800,
                    2048,
                    finderResponseSchema()));
        } catch (RuntimeException exception) {
            throw new BusinessException(503, "AI 找票解析服务暂时不可用，请稍后重试");
        }
        if (response == null || !StringUtils.hasText(response.getText())) {
            log.warn("AI意图解析失败: requestId={} type=model_response_empty", safeRequestId(requestId));
            throw new BusinessException(502, "AI 找票解析结果为空，请稍后重试");
        }

        TicketIntentModelOutput output;
        try {
            ObjectMapper strictMapper = objectMapper.copy()
                    .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, true)
                    .configure(MapperFeature.ALLOW_COERCION_OF_SCALARS, false);
            output = strictMapper.readValue(
                    response.getText().trim(), TicketIntentModelOutput.class);
        } catch (Exception exception) {
            log.warn("AI意图解析失败: requestId={} type=json_parse", safeRequestId(requestId));
            throw new BusinessException(502, "AI 找票解析结果格式不正确，请稍后重试");
        }

        try {
            TicketIntent intent = output.toIntent();
            intent.validate();
            List<String> normalizationQuestions = normalizeUnreliableFields(query, intent);
            intent.validate();
            validateModelClarificationQuestions(output.getClarificationQuestions());
            List<String> questions = new ArrayList<>();
            for (String question : normalizationQuestions) {
                addQuestionIfAbsent(questions, question);
            }
            if (Boolean.TRUE.equals(intent.getNeedAdjacentSeats()) && intent.getPeopleCount() == null) {
                addQuestionIfAbsent(questions, "请问需要几个人的连座？");
            }
            if (questions.size() > 3 || questions.stream().anyMatch(this::containsUnsafeOutput)
                    || questions.stream().anyMatch(question -> question.length() > 200)) {
                throw new IllegalArgumentException("澄清内容不安全");
            }
            if (questions.isEmpty() && hasNoSearchConstraint(intent)) {
                questions = List.of("请提供活动名称、城市或日期范围中的至少一项");
            }
            return new TicketIntentParseResult(requestId, intent, questions);
        } catch (Exception exception) {
            log.warn("AI意图解析失败: requestId={} type=semantic_validation", safeRequestId(requestId));
            throw new BusinessException(502, "AI 找票解析结果格式不正确，请稍后重试");
        }
    }

    private boolean hasNoSearchConstraint(TicketIntent intent) {
        return !StringUtils.hasText(intent.getKeyword())
                && !StringUtils.hasText(intent.getCity())
                && intent.getDateFrom() == null
                && intent.getDateTo() == null
                && intent.getPreferredDate() == null
                && intent.getMinPrice() == null
                && intent.getMaxPrice() == null
                && intent.getSaleStatus() == null;
    }

    private List<String> normalizeUnreliableFields(String query, TicketIntent intent) {
        List<String> questions = new ArrayList<>();
        PriceExpression priceExpression = resolvePriceExpression(query);
        if (priceExpression != null) {
            intent.setMinPrice(priceExpression.minPrice);
            intent.setMaxPrice(priceExpression.maxPrice);
        } else if (!hasExplicitPriceConstraint(query)) {
            intent.setMinPrice(null);
            intent.setMaxPrice(null);
        }
        intent.setPeopleCount(explicitPeopleCount(query));
        intent.setSaleStatus(explicitSaleStatus(query));
        intent.setSortPreference(explicitSortPreference(query));
        intent.setNeedAdjacentSeats(explicitAdjacentSeats(query));
        intent.setIsSupportSeat(explicitSeatSupport(query));
        intent.setRealNameRequired(explicitRealNameRequired(query));
        DateExpression dateExpression = resolveDateExpression(query);
        if (dateExpression.kind == DateExpressionKind.NONE) {
            intent.setDateFrom(null);
            intent.setDateTo(null);
            intent.setPreferredDate(null);
        } else if (dateExpression.kind == DateExpressionKind.RELATIVE) {
            intent.setDateFrom(dateExpression.from);
            intent.setDateTo(dateExpression.to);
            intent.setPreferredDate(dateExpression.preferredDate);
        } else if (!matchesExplicitDate(intent, dateExpression)) {
            intent.setDateFrom(null);
            intent.setDateTo(null);
            intent.setPreferredDate(null);
            questions.add("请确认具体日期后再搜索。");
        }
        return questions;
    }

    private void validateModelClarificationQuestions(List<String> modelQuestions) {
        if (modelQuestions == null) {
            return;
        }
        List<String> questions = modelQuestions.stream()
                .filter(StringUtils::hasText)
                .map(String::trim)
                .collect(Collectors.toList());
        if (questions.size() > 3
                || questions.stream().anyMatch(this::containsUnsafeOutput)
                || questions.stream().anyMatch(question -> question.length() > 200)) {
            throw new IllegalArgumentException("澄清内容不安全");
        }
    }

    private String explicitSaleStatus(String query) {
        String normalized = compact(query);
        if (containsAny(normalized, "还没开售", "尚未开售", "未开售", "即将开售", "待开售", "还没售票", "未售票")) {
            return "coming_soon";
        }
        if (containsAny(normalized, "卖完", "售罄", "已售罄", "卖光")) {
            return "sold_out";
        }
        if (containsAny(normalized, "已开售", "已经开售", "正在售票", "售票中", "在售")) {
            return "on_sale";
        }
        return null;
    }

    private String explicitSortPreference(String query) {
        String normalized = compact(query);
        if (containsAny(normalized, "推荐", "最值得", "值得看")) {
            return "RECOMMENDED";
        }
        if (containsAny(normalized, "最便宜", "便宜", "低价", "价格最低", "实惠")) {
            return "PRICE_ASC";
        }
        if (containsAny(normalized, "最近", "最早", "离现在近")) {
            return "TIME_ASC";
        }
        return null;
    }

    private Integer explicitPeopleCount(String query) {
        Matcher matcher = PEOPLE_COUNT.matcher(compact(query));
        if (!matcher.find()) {
            return null;
        }
        String value = matcher.group(1);
        try {
            return Integer.valueOf(value);
        } catch (NumberFormatException ignored) {
            switch (value) {
                case "一":
                    return 1;
                case "两":
                case "二":
                    return 2;
                case "三":
                    return 3;
                case "四":
                    return 4;
                case "五":
                    return 5;
                case "六":
                    return 6;
                default:
                    return null;
            }
        }
    }

    private Boolean explicitAdjacentSeats(String query) {
        String normalized = compact(query);
        if (containsAny(normalized, "不需要连座", "不要连座", "无需连座")) {
            return Boolean.FALSE;
        }
        return containsAny(normalized, "连座", "坐一起", "相邻座位", "挨着坐")
                ? Boolean.TRUE
                : null;
    }

    private Boolean explicitSeatSupport(String query) {
        String normalized = compact(query);
        if (containsAny(normalized, "不需要选座", "不要选座", "无需选座")) {
            return Boolean.FALSE;
        }
        return containsAny(normalized, "选座", "座位图", "座位选择")
                ? Boolean.TRUE
                : null;
    }

    private Boolean explicitRealNameRequired(String query) {
        String normalized = compact(query);
        if (containsAny(normalized, "无需实名", "不需要实名", "不要实名")) {
            return Boolean.FALSE;
        }
        return containsAny(normalized, "实名", "实名制")
                ? Boolean.TRUE
                : null;
    }

    private boolean containsAny(String value, String... candidates) {
        for (String candidate : candidates) {
            if (value.contains(candidate)) {
                return true;
            }
        }
        return false;
    }

    private String compact(String value) {
        return value == null ? "" : value.replaceAll("\\s+", "").toLowerCase(Locale.ROOT);
    }

    private String safeRequestId(String requestId) {
        return requestId == null ? "" : requestId.replaceAll("[^a-zA-Z0-9-]", "_");
    }

    private JsonNode finderResponseSchema() {
        ObjectNode schema = objectMapper.createObjectNode();
        schema.put("type", "object");
        ObjectNode properties = schema.putObject("properties");
        nullableString(properties, "keyword");
        nullableString(properties, "city");
        nullableDate(properties, "dateFrom");
        nullableDate(properties, "dateTo");
        nullableDate(properties, "preferredDate");
        nullableNumber(properties, "minPrice");
        nullableNumber(properties, "maxPrice");
        nullableInteger(properties, "peopleCount");
        nullableBoolean(properties, "needAdjacentSeats");
        nullableEnum(properties, "saleStatus", "on_sale", "coming_soon", "sold_out");
        nullableBoolean(properties, "isSupportSeat");
        nullableBoolean(properties, "realNameRequired");
        nullableEnum(properties, "sortPreference", "RECOMMENDED", "PRICE_ASC", "TIME_ASC");
        ObjectNode questions = properties.putObject("clarificationQuestions");
        questions.put("type", "array");
        questions.putObject("items").put("type", "string");
        ArrayNode required = schema.putArray("required");
        required.add("keyword").add("city").add("dateFrom").add("dateTo")
                .add("preferredDate").add("minPrice").add("maxPrice").add("peopleCount")
                .add("needAdjacentSeats").add("saleStatus").add("isSupportSeat")
                .add("realNameRequired").add("sortPreference").add("clarificationQuestions");
        schema.put("additionalProperties", false);
        return schema;
    }

    private void nullableString(ObjectNode properties, String name) {
        nullableType(properties, name, "string");
    }

    private void nullableDate(ObjectNode properties, String name) {
        ObjectNode property = properties.putObject(name);
        ArrayNode type = property.putArray("type");
        type.add("string").add("null");
        property.put("format", "date");
    }

    private void nullableNumber(ObjectNode properties, String name) {
        nullableType(properties, name, "number");
    }

    private void nullableInteger(ObjectNode properties, String name) {
        nullableType(properties, name, "integer");
    }

    private void nullableBoolean(ObjectNode properties, String name) {
        nullableType(properties, name, "boolean");
    }

    private void nullableType(ObjectNode properties, String name, String typeName) {
        ObjectNode property = properties.putObject(name);
        ArrayNode type = property.putArray("type");
        type.add(typeName).add("null");
    }

    private void nullableEnum(ObjectNode properties, String name, String... values) {
        ObjectNode property = properties.putObject(name);
        ArrayNode type = property.putArray("type");
        type.add("string").add("null");
        ArrayNode allowed = property.putArray("enum");
        for (String value : values) {
            allowed.add(value);
        }
        allowed.addNull();
    }

    private boolean hasExplicitPriceConstraint(String query) {
        String normalized = compact(query);
        return normalized.matches(".*" + PRICE_AMOUNT + "\\s*(?:以内|以下).*")
                || normalized.matches(".*(?:不超过|不高于|最多|上限|低于|少于)\\s*" + PRICE_AMOUNT + ".*")
                || normalized.matches(".*" + PRICE_AMOUNT + "\\s*(?:到|至|-|~|～)\\s*" + PRICE_AMOUNT + ".*")
                || normalized.matches(".*(?:价格|预算|价位)\\s*(?:是|为|在)?\\s*" + PRICE_AMOUNT + ".*");
    }

    private PriceExpression resolvePriceExpression(String query) {
        String normalized = compact(query);
        Matcher range = PRICE_RANGE_NUMERIC.matcher(normalized);
        if (range.find()) {
            return new PriceExpression(new BigDecimal(range.group(1)), new BigDecimal(range.group(2)));
        }
        Matcher upper = PRICE_UPPER_NUMERIC.matcher(normalized);
        if (upper.find()) {
            return new PriceExpression(null, new BigDecimal(upper.group(1)));
        }
        Matcher upperPrefix = PRICE_UPPER_PREFIX.matcher(normalized);
        if (upperPrefix.find()) {
            return new PriceExpression(null, new BigDecimal(upperPrefix.group(1)));
        }
        return null;
    }

    private DateExpression resolveDateExpression(String query) {
        LocalDate today = LocalDate.now(clock);
        if (query.contains("下个月")) {
            YearMonth month = YearMonth.from(today).plusMonths(1);
            return DateExpression.range(month.atDay(1), month.atEndOfMonth());
        }
        if (query.contains("上个月")) {
            YearMonth month = YearMonth.from(today).minusMonths(1);
            return DateExpression.range(month.atDay(1), month.atEndOfMonth());
        }
        if (query.contains("下周末")) {
            LocalDate saturday = startOfWeek(today).plusWeeks(1).plusDays(5);
            return DateExpression.range(saturday, saturday.plusDays(1));
        }
        if (query.contains("上周末")) {
            LocalDate saturday = startOfWeek(today).minusWeeks(1).plusDays(5);
            return DateExpression.range(saturday, saturday.plusDays(1));
        }
        if (query.contains("本周末") || query.contains("这周末") || query.contains("周末")) {
            LocalDate saturday = startOfWeek(today).plusDays(5);
            return DateExpression.range(saturday, saturday.plusDays(1));
        }
        if (query.contains("下周")) {
            return DateExpression.range(startOfWeek(today).plusWeeks(1), startOfWeek(today).plusWeeks(1).plusDays(6));
        }
        if (query.contains("上周")) {
            return DateExpression.range(startOfWeek(today).minusWeeks(1), startOfWeek(today).minusWeeks(1).plusDays(6));
        }
        if (query.contains("本周") || query.contains("这周")) {
            return DateExpression.range(startOfWeek(today), startOfWeek(today).plusDays(6));
        }
        if (query.contains("今天")) {
            return DateExpression.preferred(today);
        }
        if (query.contains("明天")) {
            return DateExpression.preferred(today.plusDays(1));
        }
        if (query.contains("后天")) {
            return DateExpression.preferred(today.plusDays(2));
        }
        if (query.contains("昨天")) {
            return DateExpression.preferred(today.minusDays(1));
        }

        Matcher fullDateMatcher = FULL_DATE.matcher(query);
        if (fullDateMatcher.find()) {
            return DateExpression.explicit(parseDate(
                    Integer.parseInt(fullDateMatcher.group(1)),
                    Integer.parseInt(fullDateMatcher.group(2)),
                    Integer.parseInt(fullDateMatcher.group(3))));
        }
        Matcher monthDayMatcher = MONTH_DAY.matcher(query);
        if (monthDayMatcher.find()) {
            return DateExpression.explicit(parseDate(
                    today.getYear(),
                    Integer.parseInt(monthDayMatcher.group(1)),
                    Integer.parseInt(monthDayMatcher.group(2))));
        }
        return DateExpression.none();
    }

    private LocalDate startOfWeek(LocalDate date) {
        return date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
    }

    private LocalDate parseDate(int year, int month, int day) {
        try {
            return LocalDate.of(year, month, day);
        } catch (RuntimeException exception) {
            return null;
        }
    }

    private boolean matchesExplicitDate(TicketIntent intent, DateExpression expression) {
        if (expression.preferredDate != null) {
            boolean preferredForm = expression.preferredDate.equals(intent.getPreferredDate())
                    && intent.getDateFrom() == null
                    && intent.getDateTo() == null;
            boolean rangeForm = expression.preferredDate.equals(intent.getDateFrom())
                    && expression.preferredDate.equals(intent.getDateTo())
                    && intent.getPreferredDate() == null;
            return preferredForm || rangeForm;
        }
        return expression.from != null
                && expression.from.equals(intent.getDateFrom())
                && expression.to.equals(intent.getDateTo())
                && intent.getPreferredDate() == null;
    }

    private void addQuestionIfAbsent(List<String> questions, String question) {
        if (!questions.contains(question)) {
            questions.add(question);
        }
    }

    private boolean containsUnsafeOutput(String value) {
        String normalized = value.toLowerCase(java.util.Locale.ROOT);
        return normalized.contains("http://")
                || normalized.contains("https://")
                || normalized.contains("jdbc:")
                || normalized.matches(".*\\b(select|insert|update|delete|drop)\\b.*");
    }

    private enum DateExpressionKind {
        NONE, RELATIVE, EXPLICIT
    }

    private static final class DateExpression {
        private final DateExpressionKind kind;
        private final LocalDate from;
        private final LocalDate to;
        private final LocalDate preferredDate;

        private DateExpression(DateExpressionKind kind, LocalDate from, LocalDate to, LocalDate preferredDate) {
            this.kind = kind;
            this.from = from;
            this.to = to;
            this.preferredDate = preferredDate;
        }

        private static DateExpression none() {
            return new DateExpression(DateExpressionKind.NONE, null, null, null);
        }

        private static DateExpression range(LocalDate from, LocalDate to) {
            return new DateExpression(DateExpressionKind.RELATIVE, from, to, null);
        }

        private static DateExpression preferred(LocalDate date) {
            return new DateExpression(DateExpressionKind.RELATIVE, null, null, date);
        }

        private static DateExpression explicit(LocalDate date) {
            return date == null
                    ? none()
                    : new DateExpression(DateExpressionKind.EXPLICIT, null, null, date);
        }
    }

    private static final class PriceExpression {
        private final BigDecimal minPrice;
        private final BigDecimal maxPrice;

        private PriceExpression(BigDecimal minPrice, BigDecimal maxPrice) {
            this.minPrice = minPrice;
            this.maxPrice = maxPrice;
        }
    }
}
