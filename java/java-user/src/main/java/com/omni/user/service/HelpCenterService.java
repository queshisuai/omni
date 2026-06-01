package com.omni.user.service;

import com.omni.user.dto.HelpFaqResponse;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class HelpCenterService {

    public List<HelpFaqResponse> listFaqs() {
        return List.of(
                new HelpFaqResponse("票夹与入场", "购票后在哪里查看电子票？", "支付成功出票后，可在“我的票夹”查看电子票和动态入场码，现场扫码核销入场。"),
                new HelpFaqResponse("票夹与入场", "动态入场码过期怎么办？", "重新打开电子票详情会刷新短期有效的动态入场码，已验票或已失效的票不会再次生成有效码。"),
                new HelpFaqResponse("转赠", "哪些票可以转赠？", "是否允许转赠由活动规则控制。强实名或主办方禁止转赠的活动不可转赠，允许转赠的票可在票夹发起、撤回和查看领取状态。"),
                new HelpFaqResponse("抢票与候补", "抢票失败能看到原因吗？", "抢票进度会展示排队位置、尝试票档、自动降档和失败原因；售罄后可进入候补。"),
                new HelpFaqResponse("退款改期", "退款进度在哪里看？", "订单页会展示退票规则和退款进度时间线。退款异常、改期或取消可转人工客服处理。"),
                new HelpFaqResponse("实名安全", "主办方能看到完整身份证号吗？", "不能。后台和主办方只展示脱敏信息，证件号按加密和审计要求处理。")
        );
    }
}
