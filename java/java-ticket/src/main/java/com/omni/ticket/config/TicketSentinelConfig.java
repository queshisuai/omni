package com.omni.ticket.config;

import com.alibaba.csp.sentinel.slots.block.RuleConstant;
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
public class TicketSentinelConfig implements InitializingBean {

    public static final String SALES_LOCK_STOCK = "ticket-sales-lock-stock";
    public static final String SALES_LOCK_SEATS = "ticket-sales-lock-seats";
    public static final String SALES_CONFIRM_SOLD = "ticket-sales-confirm-sold";
    public static final String SEAT_MAP_READ = "ticket-seat-map-read";

    private final double lockStockQps;
    private final double lockSeatsQps;
    private final double confirmSoldQps;
    private final double seatMapReadQps;

    public TicketSentinelConfig(
            @Value("${omni.sentinel.ticket.sales-lock-stock.qps:80}") double lockStockQps,
            @Value("${omni.sentinel.ticket.sales-lock-seats.qps:80}") double lockSeatsQps,
            @Value("${omni.sentinel.ticket.sales-confirm-sold.qps:80}") double confirmSoldQps,
            @Value("${omni.sentinel.ticket.seat-map-read.qps:120}") double seatMapReadQps) {
        this.lockStockQps = lockStockQps;
        this.lockSeatsQps = lockSeatsQps;
        this.confirmSoldQps = confirmSoldQps;
        this.seatMapReadQps = seatMapReadQps;
    }

    @Override
    public void afterPropertiesSet() {
        List<FlowRule> rules = new ArrayList<>();
        rules.add(flowRule(SALES_LOCK_STOCK, lockStockQps));
        rules.add(flowRule(SALES_LOCK_SEATS, lockSeatsQps));
        rules.add(flowRule(SALES_CONFIRM_SOLD, confirmSoldQps));
        rules.add(flowRule(SEAT_MAP_READ, seatMapReadQps));
        loadFlowRules(rules);
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

    private FlowRule flowRule(String resource, double qps) {
        FlowRule rule = new FlowRule();
        rule.setResource(resource);
        rule.setGrade(RuleConstant.FLOW_GRADE_QPS);
        rule.setCount(qps);
        return rule;
    }
}
