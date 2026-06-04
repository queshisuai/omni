package com.omni.user.service;

import com.omni.user.dto.HelpFaqResponse;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

final class SupportKnowledgeBase {

    private static final String PROJECT_KNOWLEDGE = "你是 Omni 万象抢票平台的在线客服，只能基于 Omni 平台规则回答用户问题。"
            + "\n回答原则："
            + "\n1. 先判断用户问题属于浏览购票、订单支付、票夹入场、实名安全、转赠、退款改期、抢票候补、小队抢票、通知账号或人工客服。"
            + "\n2. 回答要简洁、可执行，控制在200字以内；不要输出推理过程、JSON、Markdown表格或<think>标签。"
            + "\n3. 不要编造不存在的活动、订单、价格、座位号、证件号、退款结果、库存数量或内部配置；缺少订单号/活动名时请让用户补充。"
            + "\n4. 不能代替人工承诺退款到账、锁票成功、候补必得、活动一定开演或证件信息修改成功。"
            + "\n5. 需要人工客服时，引导用户点击“转人工”，说明同一会话会保留 AI 与人工客服记录。"
            + "\nOmni 项目规则："
            + "\n1. 购票流程是登录后浏览首页或搜索活动，进入活动详情，选择城市站点、场次、票档、数量，若支持选座则选择座位，再选择实名观演人，确认订单并扫码支付。"
            + "\n2. 订单有待支付、已支付、已取消、已退款等状态；待支付订单需在有效期内完成支付，支付后可在订单页同步结果并查看出票情况。"
            + "\n3. 支付成功并出票后，用户可在“我的票夹”查看电子票、动态入场码、入场状态、座位信息和转赠状态；动态入场码短期有效，重新打开票详情会刷新。"
            + "\n4. 是否实名购票、每人限购、是否允许转赠由活动规则控制；实名活动下单和候补需要选择对应数量的实名观演人。"
            + "\n5. 实名信息按最小必要原则使用，下单会固化观演人快照，后台和主办方只展示脱敏信息，不展示完整身份证号。"
            + "\n6. 转赠只对活动规则允许且当前状态可转赠的电子票开放；可在票夹发起、查看状态、受赠人领取前撤回，过期后自动失效。"
            + "\n7. 退款、退票、改期、取消问题以订单详情页的活动规则、退款申请状态和进度时间线为准；退款失败、结果未知或改期取消争议应转人工处理。"
            + "\n8. 普通抢票会展示排队位置、尝试票档、自动降档、失败原因和订单确认状态；订单确认中时提醒稍后刷新，不要让用户重复提交。"
            + "\n9. 票档售罄后可加入候补；候补只代表排队资格，库存释放后系统按顺序尝试生成待支付订单，用户需限时支付，超时会释放给下一位。"
            + "\n10. 小队抢票支持创建小队、用小队 ID 和邀请码加入、成员确认后统一锁票；小队订单确认中或失败时以小队页状态和失败原因为准。"
            + "\n11. 通知中心会推送订单支付、候补名额释放或过期、活动取消或延期、退款进度和人工客服回复；未收到通知可先刷新通知页和对应订单、候补或小队页面。";

    private static final List<FaqEntry> FAQS = List.of(
            faq("票夹与入场", "购票后在哪里查看电子票？", "支付成功出票后，可在“我的票夹”查看电子票、动态入场码、入场状态、座位信息和转赠状态。"),
            faq("票夹与入场", "动态入场码过期怎么办？", "重新打开电子票详情会刷新短期有效的动态入场码。已验票或已失效的票不会再次生成有效码。"),
            faq("转赠", "哪些票可以转赠？", "是否允许转赠由活动规则和电子票当前状态控制。允许转赠的票可在“我的票夹”发起、查看状态或在受赠人领取前撤回；强实名或主办方禁止转赠的活动不可转赠。"),
            faq("订单支付", "支付后订单还是待支付怎么办？", "请先回到订单页点击同步支付结果，并查看出票状态。若仍异常，请带订单号转人工客服继续处理。"),
            faq("订单支付", "待支付订单必须多久内付款？", "待支付订单需要在页面提示的有效期内完成扫码支付，超时后系统会取消订单并释放库存或座位。"),
            faq("选座实名", "支持选座的活动怎么下单？", "支持选座的活动会在详情页展示座位图。请选择可售座位、票档、数量和实名观演人后再确认订单。"),
            faq("选座实名", "实名观演人怎么选择？", "实名活动下单或候补时，需要选择与购买数量一致的实名观演人；每人限购以活动规则为准。"),
            faq("实名安全", "主办方能看到完整身份证号吗？", "不能。后台和主办方只展示脱敏信息，证件号按加密和审计要求处理，不展示完整身份证号。"),
            faq("抢票与候补", "抢票失败能看到原因吗？", "抢票进度页会展示排队位置、尝试票档、自动降档、失败原因和订单确认状态；订单确认中请稍后刷新。"),
            faq("抢票与候补", "候补成功后就一定有票吗？", "不是。候补只代表排队资格，库存释放后系统会按顺序尝试生成待支付订单，用户需限时支付，超时会释放给下一位。"),
            faq("小队抢票", "小队抢票邀请码怎么用？", "可在活动详情创建小队，或使用小队 ID 和邀请码加入。成员确认后系统会统一尝试锁票，小队页会展示成员状态、订单号或失败原因。"),
            faq("退款改期", "退款进度在哪里看？", "订单页会展示退票规则、退款申请状态和进度时间线。退款失败、结果未知、改期或取消争议请转人工客服处理。"),
            faq("通知与客服", "没收到通知怎么办？", "请先刷新通知中心，并同步查看订单页、候补页或小队页的最新状态。通知中心会展示支付、候补、活动变更、退款和人工客服回复。"),
            faq("通知与客服", "什么时候需要转人工客服？", "涉及退款异常、订单结果未知、改期取消争议、实名信息修改或需要人工核查时，请点击“转人工”，同一会话会保留 AI 与人工客服记录。")
    );

    private static final List<AnswerEntry> ANSWER_INDEX = List.of(
            answer("支付成功出票后，可在“我的票夹”查看电子票、动态入场码、入场状态、座位信息和转赠状态。动态入场码短期有效，重新打开票详情会刷新；已验票或已失效的票不会再次生成有效码。",
                    "票夹", "电子票", "二维码", "入场码", "验票", "条形码", "入场", "检票", "核销"),
            answer("转赠能力由活动规则和电子票当前状态控制。允许转赠的票可在“我的票夹”发起、查看领取状态，或在受赠人领取前撤回；强实名或主办方禁止转赠的活动不可转赠。",
                    "转赠", "赠票", "送票"),
            answer("实名活动下单或候补时，需要选择与购买数量一致的实名观演人；每人限购以活动规则为准。下单会固化观演人快照，后台和主办方只展示脱敏信息，不会展示完整证件号。",
                    "实名", "身份证", "观演人", "证件", "限购"),
            answer("请在订单页查看该活动的退票规则、退款进度、申请状态和进度时间线。退款失败、结果未知、活动改期取消或对审核结果有异议时，请点击“转人工客服”并提供订单号继续处理。",
                    "退款", "退票", "改期", "取消", "不到账", "退钱", "拒绝退款"),
            answer("小队抢票可在活动详情创建小队，或用小队 ID 和邀请码加入。成员确认后系统会统一尝试锁票；小队订单确认中请稍后刷新，小队页会展示成员状态、订单号或失败原因。",
                    "小队", "组队", "队伍", "邀请码", "成员", "team"),
            answer("通知中心会展示支付结果、候补名额释放或过期、活动取消延期、退款进度和人工客服回复。若暂未收到提醒，请刷新通知页，并同步查看订单页、候补页或小队页的最新状态。",
                    "通知", "消息", "站内信", "提醒", "没收到"),
            answer("抢票进度页会展示排队位置、尝试票档、自动降档、失败原因和订单确认状态。票档售罄后可加入候补；候补只是排队资格，库存释放后系统按顺序生成待支付订单，需限时支付。",
                    "候补", "抢票", "排队", "失败", "降档"),
            answer("支持选座的活动会在详情页展示座位图，可按票档和可售状态选择座位后下单。若座位被其他订单锁定、已售或不属于当前票档，请换选可售座位或改用系统可选方案。",
                    "座位", "选座", "座位图", "连座", "位置"),
            answer("请先在活动详情选择场次、票档、数量和实名观演人，确认后生成待支付订单。待支付订单需在有效期内完成扫码支付；支付后可在订单页同步结果并查看出票状态，订单异常请带订单号转人工处理。",
                    "订单", "下单", "支付", "付款", "待支付", "已支付", "扫码", "支付宝", "同步"),
            answer("我可以先根据项目规则回答常见问题。需要人工客服时，请点击“转人工”，人工客服接入后会继续在同一个会话中处理，全部对话会保留记录。",
                    "客服", "人工", "联系")
    );

    private SupportKnowledgeBase() {
    }

    static String projectKnowledge() {
        return PROJECT_KNOWLEDGE;
    }

    static List<HelpFaqResponse> listFaqs() {
        List<HelpFaqResponse> responses = new ArrayList<>();
        for (FaqEntry faq : FAQS) {
            responses.add(new HelpFaqResponse(faq.category, faq.question, faq.answer));
        }
        return responses;
    }

    static Optional<String> answerKnownQuestion(String question) {
        String normalized = question == null ? "" : question.trim().toLowerCase(Locale.ROOT);
        if (normalized.isEmpty()) {
            return Optional.empty();
        }
        for (AnswerEntry entry : ANSWER_INDEX) {
            if (entry.matches(normalized)) {
                return Optional.of(entry.answer);
            }
        }
        return Optional.empty();
    }

    static String defaultAnswer() {
        return "我已了解你的问题。你可以补充活动名称、订单号或遇到的具体页面；如果需要人工客服，请点击“转人工”，客服会在同一会话继续处理。";
    }

    private static FaqEntry faq(String category, String question, String answer) {
        return new FaqEntry(category, question, answer);
    }

    private static AnswerEntry answer(String answer, String... keywords) {
        return new AnswerEntry(answer, keywords);
    }

    private static final class FaqEntry {
        private final String category;
        private final String question;
        private final String answer;

        private FaqEntry(String category, String question, String answer) {
            this.category = category;
            this.question = question;
            this.answer = answer;
        }
    }

    private static final class AnswerEntry {
        private final String answer;
        private final String[] keywords;

        private AnswerEntry(String answer, String[] keywords) {
            this.answer = answer;
            this.keywords = keywords;
        }

        private boolean matches(String normalizedQuestion) {
            for (String keyword : keywords) {
                if (normalizedQuestion.contains(keyword.toLowerCase(Locale.ROOT))) {
                    return true;
                }
            }
            return false;
        }
    }
}
