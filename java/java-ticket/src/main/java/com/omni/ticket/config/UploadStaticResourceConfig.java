package com.omni.ticket.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.StringUtils;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Path;
import java.nio.file.Paths;

@Configuration
public class UploadStaticResourceConfig implements WebMvcConfigurer {

    private final String uploadRoot;

    public UploadStaticResourceConfig(@Value("${omni.upload.root:${OMNI_UPLOAD_ROOT:}}") String uploadRoot) {
        this.uploadRoot = uploadRoot;
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        Path root = resolveUploadRoot(uploadRoot);
        registry.addResourceHandler("/uploads/**")
                .addResourceLocations(root.toUri().toString());
    }

    static Path resolveUploadRoot(String configuredRoot) {
        if (StringUtils.hasText(configuredRoot)) {
            return Paths.get(configuredRoot).toAbsolutePath().normalize();
        }
        return Paths.get(System.getProperty("user.dir"), "..", "runtime", "uploads")
                .toAbsolutePath()
                .normalize();
    }
}
