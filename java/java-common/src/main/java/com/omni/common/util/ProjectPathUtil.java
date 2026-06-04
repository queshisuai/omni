package com.omni.common.util;

import org.springframework.util.StringUtils;

import java.net.URISyntaxException;
import java.nio.file.FileSystemNotFoundException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

public final class ProjectPathUtil {

    private ProjectPathUtil() {
    }

    public static Path resolvePublicUploadRoot(String configuredRoot) {
        if (StringUtils.hasText(configuredRoot)) {
            return Paths.get(configuredRoot).toAbsolutePath().normalize();
        }
        return projectRoot().resolve("runtime").resolve("uploads").normalize();
    }

    public static Path resolvePrivateUploadRoot(String configuredRoot, String serviceName) {
        if (StringUtils.hasText(configuredRoot)) {
            return Paths.get(configuredRoot).toAbsolutePath().normalize();
        }
        return projectRoot().resolve("runtime").resolve("private-uploads").resolve(serviceName).normalize();
    }

    private static Path projectRoot() {
        Path classpathRoot = findProjectRoot(classpathLocation());
        if (classpathRoot != null) {
            return classpathRoot;
        }
        Path userDir = Paths.get(System.getProperty("user.dir")).toAbsolutePath().normalize();
        Path userDirRoot = findProjectRoot(userDir);
        return userDirRoot != null ? userDirRoot : userDir;
    }

    private static Path classpathLocation() {
        try {
            return Paths.get(ProjectPathUtil.class.getProtectionDomain().getCodeSource().getLocation().toURI())
                    .toAbsolutePath()
                    .normalize();
        } catch (URISyntaxException | IllegalArgumentException | FileSystemNotFoundException e) {
            return null;
        }
    }

    private static Path findProjectRoot(Path start) {
        Path cursor = start;
        while (cursor != null) {
            if (Files.isDirectory(cursor.resolve("java")) && Files.isDirectory(cursor.resolve("frontend"))) {
                return cursor;
            }
            cursor = cursor.getParent();
        }
        return null;
    }
}
