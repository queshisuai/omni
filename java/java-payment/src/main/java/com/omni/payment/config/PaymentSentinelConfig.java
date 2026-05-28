package com.omni.payment.config;

import com.alibaba.csp.sentinel.slots.block.RuleConstant;
import com.alibaba.csp.sentinel.slots.block.degrade.DegradeRule;
import com.alibaba.csp.sentinel.slots.block.degrade.DegradeRuleManager;
import com.alibaba.csp.sentinel.slots.block.flow.FlowRule;
import com.alibaba.csp.sentinel.slots.block.flow.FlowRuleManager;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Configuration
public class PaymentSentinelConfig implements InitializingBean {

    public static final String ALIPAY_SYNC = "payment-alipay-sync";
    public static final String ALIPAY_NOTIFY = "payment-alipay-notify";
    public static final String REFUND_APPLY = "payment-refund-apply";
    public static final String ORDER_CLIENT = "payment-order-client";
    public static final String ALIPAY_CHANNEL = "payment-alipay-channel";

    private final double alipaySyncQps;
    private final double alipayNotifyQps;
    private final double refundApplyQps;

    public PaymentSentinelConfig(
            @Value("${omni.sentinel.payment.alipay-sync.qps:60}") double alipaySyncQps,
            @Value("${omni.sentinel.payment.alipay-notify.qps:100}") double alipayNotifyQps,
            @Value("${omni.sentinel.payment.refund-apply.qps:30}") double refundApplyQps) {
        this.alipaySyncQps = alipaySyncQps;
        this.alipayNotifyQps = alipayNotifyQps;
        this.refundApplyQps = refundApplyQps;
    }

    @Override
    public void afterPropertiesSet() {
        List<FlowRule> flowRules = new ArrayList<>();
        flowRules.add(flowRule(ALIPAY_SYNC, alipaySyncQps));
        flowRules.add(flowRule(ALIPAY_NOTIFY, alipayNotifyQps));
        flowRules.add(flowRule(REFUND_APPLY, refundApplyQps));
        loadFlowRules(flowRules);

        List<DegradeRule> degradeRules = new ArrayList<>();
        degradeRules.add(exceptionRatioRule(ORDER_CLIENT));
        degradeRules.add(exceptionRatioRule(ALIPAY_CHANNEL));
        loadDegradeRules(degradeRules);
    }

    private void loadFlowRules(List<FlowRule> ownedRules) {
        Set<String> ownedResources = ownedRules.stream()
                .map(FlowRule::getResource)
                .collect(Collectors.toSet());
        List<FlowRule> mergedRules = FlowRuleManager.getRules().stream()
                .filter(rule -> !ownedResources.contains(rule.getResource()))
                .collect(Collectors.toCollection(ArrayList::new));
        mergedRules.addAll(ownedRules);
        FlowRuleManager.loadRules(mergedRules);
    }

    private void loadDegradeRules(List<DegradeRule> ownedRules) {
        Set<String> ownedResources = ownedRules.stream()
                .map(DegradeRule::getResource)
                .collect(Collectors.toSet());
        List<DegradeRule> mergedRules = DegradeRuleManager.getRules().stream()
                .filter(rule -> !ownedResources.contains(rule.getResource()))
                .collect(Collectors.toCollection(ArrayList::new));
        mergedRules.addAll(ownedRules);
        DegradeRuleManager.loadRules(mergedRules);
    }

    private FlowRule flowRule(String resource, double qps) {
        FlowRule rule = new FlowRule();
        rule.setResource(resource);
        rule.setGrade(RuleConstant.FLOW_GRADE_QPS);
        rule.setCount(qps);
        return rule;
    }

    private DegradeRule exceptionRatioRule(String resource) {
        DegradeRule rule = new DegradeRule();
        rule.setResource(resource);
        rule.setGrade(RuleConstant.DEGRADE_GRADE_EXCEPTION_RATIO);
        rule.setCount(0.5);
        rule.setMinRequestAmount(5);
        rule.setTimeWindow(10);
        return rule;
    }
}
