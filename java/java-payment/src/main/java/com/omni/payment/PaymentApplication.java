package com.omni.payment;

import com.omni.common.util.LocalProdSplitDefaults;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;
import org.springframework.cloud.openfeign.EnableFeignClients;

@SpringBootApplication(scanBasePackages = "com.omni")
@EnableDiscoveryClient
@EnableFeignClients
public class PaymentApplication {
    public static void main(String[] args) {
        SpringApplication application = new SpringApplication(PaymentApplication.class);
        LocalProdSplitDefaults.apply(application, "java-payment", args);
        application.run(args);
    }
}
