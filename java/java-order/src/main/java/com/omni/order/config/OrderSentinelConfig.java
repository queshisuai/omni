package com.omni.order.config;

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
public class OrderSentinelConfig implements InitializingBean {

    public static final String INTERNAL_CREATE_ORDER_RESOURCE = "order-internal-create";
    public static final String INTERNAL_CREATE_ORDER_WITH_SEATS_RESOURCE = "order-internal-create-with-seats";
    public static final String INTERNAL_CREATE_TEAM_ORDER_WITH_LOCKED_SEATS_RESOURCE = "order-internal-team-create-with-locked-seats";
    public static final String INTERNAL_MARK_PAID_RESOURCE = "order-internal-mark-paid";
    public static final String USER_VALIDATE_RESOURCE = "order-user-validate";
    public static final String TICKET_SALES_RESOURCE = "order-ticket-sales";

    private final double createOrderQps;
    private final double createOrderWithSeatsQps;
    private final double createTeamOrderWithLockedSeatsQps;
    private final double markPaidQps;

    public OrderSentinelConfig(
            @Value("${omni.sentinel.order.internal-create.qps:80}") double createOrderQps,
            @Value("${omni.sentinel.order.internal-create-with-seats.qps:80}") double createOrderWithSeatsQps,
            @Value("${omni.sentinel.order.internal-team-create-with-locked-seats.qps:80}") double createTeamOrderWithLockedSeatsQps,
            @Value("${omni.sentinel.order.internal-mark-paid.qps:80}") double markPaidQps) {
        this.createOrderQps = createOrderQps;
        this.createOrderWithSeatsQps = createOrderWithSeatsQps;
        this.createTeamOrderWithLockedSeatsQps = createTeamOrderWithLockedSeatsQps;
        this.markPaidQps = markPaidQps;
    }

    @Override
    public void afterPropertiesSet() {
        List<FlowRule> rules = new ArrayList<>();
        rules.add(flowRule(INTERNAL_CREATE_ORDER_RESOURCE, createOrderQps));
        rules.add(flowRule(INTERNAL_CREATE_ORDER_WITH_SEATS_RESOURCE, createOrderWithSeatsQps));
        rules.add(flowRule(INTERNAL_CREATE_TEAM_ORDER_WITH_LOCKED_SEATS_RESOURCE, createTeamOrderWithLockedSeatsQps));
        rules.add(flowRule(INTERNAL_MARK_PAID_RESOURCE, markPaidQps));
        loadFlowRules(rules);

        List<DegradeRule> degradeRules = new ArrayList<>();
        degradeRules.add(exceptionRatioRule(USER_VALIDATE_RESOURCE));
        degradeRules.add(exceptionRatioRule(TICKET_SALES_RESOURCE));
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
