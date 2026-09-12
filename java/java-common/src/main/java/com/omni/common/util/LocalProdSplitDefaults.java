package com.omni.common.util;

import org.springframework.boot.SpringApplication;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Properties;

/**
 * Keeps local IDE prod-split launches usable without adding localhost fallbacks to production YAML.
 */
public final class LocalProdSplitDefaults {

    private static final String ENABLE_LOCAL_DEFAULTS = "OMNI_LOCAL_PROD_SPLIT_DEFAULTS";
    private static final String STRICT_PROD_SPLIT = "OMNI_STRICT_PROD_SPLIT";

    private LocalProdSplitDefaults() {
    }

    public static void apply(SpringApplication application, String serviceName, String[] args) {
        Map<String, Object> defaults = buildDefaultProperties(
                serviceName,
                args,
                System.getProperties(),
                System.getenv());
        if (!defaults.isEmpty()) {
            application.setDefaultProperties(defaults);
        }
    }

    static Map<String, Object> buildDefaultProperties(
            String serviceName,
            String[] args,
            Properties systemProperties,
            Map<String, String> environment) {
        if (!isProdSplitActive(args, systemProperties, environment)
                || !isLocalClassesLaunch(systemProperties, environment)) {
            return Collections.emptyMap();
        }

        Map<String, Object> defaults = new LinkedHashMap<>();
        putIfMissing(defaults, "SPRING_DATASOURCE_PASSWORD", "123456", args, systemProperties, environment);
        putIfMissing(defaults, "NACOS_HOST", "localhost", args, systemProperties, environment);
        putIfMissing(defaults, "NACOS_PORT", "8848", args, systemProperties, environment);
        putIfMissing(defaults, "RABBITMQ_HOST", "localhost", args, systemProperties, environment);
        putIfMissing(defaults, "RABBITMQ_PORT", "5672", args, systemProperties, environment);
        putIfMissing(defaults, "RABBITMQ_USER", "admin", args, systemProperties, environment);
        putIfMissing(defaults, "RABBITMQ_PASSWORD", "123456", args, systemProperties, environment);
        putIfMissing(defaults, "INTERNAL_API_TOKEN", "omni-local-internal-token", args, systemProperties, environment);

        switch (serviceName) {
            case "java-gateway":
                putIfMissing(defaults, "GATEWAY_WAITLIST_SERVICE_URI", "http://localhost:3001", args, systemProperties, environment);
                putIfMissing(defaults, "GATEWAY_GRAB_SERVICE_URI", "http://localhost:3001", args, systemProperties, environment);
                break;
            case "java-user":
                putIfMissing(defaults, "GRAB_SERVICE_URL", "http://localhost:3001", args, systemProperties, environment);
                putIfMissing(defaults, "OMNI_ID_NO_KEY", "omni-local-dev-id-no-key-change-me", args, systemProperties, environment);
                putIfMissing(defaults, "omni.sms.mock.enabled", "true", args, systemProperties, environment);
                putIfMissing(defaults, "omni.upload.root", ProjectPathUtil.resolvePublicUploadRoot("").toString(), args, systemProperties, environment);
                break;
            case "java-ticket":
                putIfMissing(defaults, "SEATA_ENABLED", "true", args, systemProperties, environment);
                putIfMissing(defaults, "ELASTICSEARCH_URIS", "http://localhost:9200", args, systemProperties, environment);
                putIfMissing(defaults, "SPRING_ELASTICSEARCH_URIS", "http://localhost:9200", args, systemProperties, environment);
                putIfMissing(defaults, "omni.upload.root", ProjectPathUtil.resolvePublicUploadRoot("").toString(), args, systemProperties, environment);
                break;
            case "java-order":
                putIfMissing(defaults, "SEATA_ENABLED", "true", args, systemProperties, environment);
                putIfMissing(defaults, "JWT_SECRET", "omni-local-jwt-secret-must-be-at-least-32-bytes", args, systemProperties, environment);
                break;
            case "java-payment":
                putIfMissing(defaults, "SEATA_ENABLED", "true", args, systemProperties, environment);
                putIfMissing(defaults, "ALIPAY_GATEWAY_URL", "http://localhost:8084/local-alipay-disabled", args, systemProperties, environment);
                putIfMissing(defaults, "ALIPAY_APP_ID", "omni-local-placeholder", args, systemProperties, environment);
                putIfMissing(defaults, "ALIPAY_MERCHANT_PRIVATE_KEY", "omni-local-placeholder", args, systemProperties, environment);
                putIfMissing(defaults, "ALIPAY_PUBLIC_KEY", "omni-local-placeholder", args, systemProperties, environment);
                putIfMissing(defaults, "ALIPAY_RETURN_URL", "http://localhost:3000/payment/result", args, systemProperties, environment);
                putIfMissing(defaults, "ALIPAY_NOTIFY_URL", "http://localhost:8088/api/payment/alipay/notify", args, systemProperties, environment);
                break;
            case "java-notification":
                putIfMissing(defaults, "JWT_SECRET", "omni-local-jwt-secret-must-be-at-least-32-bytes", args, systemProperties, environment);
                break;
            default:
                break;
        }

        return defaults;
    }

    private static boolean isProdSplitActive(String[] args, Properties systemProperties, Map<String, String> environment) {
        return containsProfile(activeProfilesFromArgs(args), "prod-split")
                || containsProfile(systemProperties.getProperty("spring.profiles.active"), "prod-split")
                || containsProfile(environment.get("SPRING_PROFILES_ACTIVE"), "prod-split");
    }

    private static String activeProfilesFromArgs(String[] args) {
        if (args == null) {
            return "";
        }
        for (String arg : args) {
            String prefix = "--spring.profiles.active=";
            if (arg != null && arg.startsWith(prefix)) {
                return arg.substring(prefix.length());
            }
        }
        return "";
    }

    private static boolean containsProfile(String profiles, String expected) {
        if (profiles == null || profiles.isBlank()) {
            return false;
        }
        for (String profile : profiles.split(",")) {
            if (expected.equals(profile.trim())) {
                return true;
            }
        }
        return false;
    }

    private static boolean isLocalClassesLaunch(Properties systemProperties, Map<String, String> environment) {
        if (isTrue(readSetting(STRICT_PROD_SPLIT, systemProperties, environment))) {
            return false;
        }
        String localDefaults = readSetting(ENABLE_LOCAL_DEFAULTS, systemProperties, environment);
        if (localDefaults != null) {
            return isTrue(localDefaults);
        }
        String classPath = systemProperties.getProperty("java.class.path", "");
        return classPath.contains("target\\classes") || classPath.contains("target/classes");
    }

    private static String readSetting(String key, Properties systemProperties, Map<String, String> environment) {
        String systemValue = systemProperties.getProperty(key);
        if (systemValue != null) {
            return systemValue;
        }
        String dottedSystemValue = systemProperties.getProperty(key.toLowerCase().replace('_', '.'));
        if (dottedSystemValue != null) {
            return dottedSystemValue;
        }
        return environment.get(key);
    }

    private static boolean isTrue(String value) {
        return "true".equalsIgnoreCase(String.valueOf(value).trim());
    }

    private static void putIfMissing(
            Map<String, Object> defaults,
            String key,
            String value,
            String[] args,
            Properties systemProperties,
            Map<String, String> environment) {
        if (hasExplicitValue(key, args, systemProperties, environment)) {
            return;
        }
        defaults.put(key, value);
    }

    private static boolean hasExplicitValue(
            String key,
            String[] args,
            Properties systemProperties,
            Map<String, String> environment) {
        return environment.containsKey(key)
                || systemProperties.containsKey(key)
                || systemProperties.containsKey(key.toLowerCase().replace('_', '.'))
                || hasArgumentValue(key, args)
                || hasArgumentValue(key.toLowerCase().replace('_', '.'), args);
    }

    private static boolean hasArgumentValue(String key, String[] args) {
        if (args == null) {
            return false;
        }
        String prefix = "--" + key + "=";
        for (String arg : args) {
            if (arg != null && arg.startsWith(prefix)) {
                return true;
            }
        }
        return false;
    }
}
