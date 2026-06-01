package com.omni.user.service;

import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.Locale;
import java.util.Optional;

@Service
public class SupportAiService {

    private static final String PROJECT_KNOWLEDGE = "你是 Omni 项目的在线客服，只能基于平台规则回答用户问题。"
            + "\n平台规则："
            + "\n1. 用户购票后可在“我的票夹”查看电子票、动态入场码、入场状态和转赠状态。"
            + "\n2. 强实名票是否允许转赠由活动规则控制，后台和主办方只展示脱敏实名信息。"
            + "\n3. 退款、退票、改期和取消问题应引导用户查看订单详情页的规则与进度时间线。"
            + "\n4. 抢票与候补应解释排队位置、尝试票档、自动降档、失败原因和候补机会。"
            + "\n5. 需要人工客服时，引导用户点击“转人工”，并说明同一会话会保留客服对话记录。"
            + "\n6. 不要编造不存在的活动、订单、价格、实名证件号或内部配置。";

    private final SupportLocalModelClient localModelClient;

    public SupportAiService(SupportLocalModelClient localModelClient) {
        this.localModelClient = localModelClient;
    }

    public String answer(String question) {
        Optional<String> modelAnswer = localModelClient.answer(question, PROJECT_KNOWLEDGE);
        if (modelAnswer.isPresent() && StringUtils.hasText(modelAnswer.get())) {
            return modelAnswer.get().trim();
        }

        String normalized = StringUtils.hasText(question) ? question.toLowerCase(Locale.ROOT) : "";
        if (containsAny(normalized, "票夹", "电子票", "二维码", "入场码", "验票", "条形码")) {
            return "你可以在“我的票夹”查看已出票的电子票，入场时打开动态入场码给现场核销。动态入场码会短期有效；如活动规则允许，票夹内也可以发起转赠、撤回转赠或查看转赠状态。";
        }
        if (containsAny(normalized, "转赠", "赠票", "送票")) {
            return "转赠能力由活动规则控制。非强实名或允许转赠的活动，可以在“我的票夹”发起转赠；受赠人领取前你可以撤回，过期后转赠会自动失效。";
        }
        if (containsAny(normalized, "实名", "身份证", "观演人", "证件")) {
            return "实名观演人信息会按最小必要原则使用，后台和主办方只展示脱敏信息。下单时会固化实名快照，入场核验不会展示完整证件号。";
        }
        if (containsAny(normalized, "退款", "退票", "改期", "取消", "不到账")) {
            return "你可以在订单页查看每个活动的退票规则和退款进度时间线。若退款失败、状态未知或活动改期取消，可以在在线客服中转人工客服继续处理。";
        }
        if (containsAny(normalized, "候补", "抢票", "排队", "失败", "降档")) {
            return "抢票进度页会展示排队位置、尝试过的票档、自动降档情况和失败原因；候补页会展示预计机会和领取状态。";
        }
        if (containsAny(normalized, "客服", "人工", "联系")) {
            return "我可以先根据项目规则回答常见问题。需要人工客服时，请点击“转人工”，人工客服接入后会继续在同一个会话中处理，全部对话会保留记录。";
        }
        return "我已了解你的问题。你可以补充活动名称、订单号或遇到的具体页面；如果需要人工客服，请点击“转人工”，客服会在同一会话继续处理。";
    }

    private boolean containsAny(String value, String... keywords) {
        for (String keyword : keywords) {
            if (value.contains(keyword)) {
                return true;
            }
        }
        return false;
    }
}
