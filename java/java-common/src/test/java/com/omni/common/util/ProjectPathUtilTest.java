package com.omni.common.util;

import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ProjectPathUtilTest {

    @Test
    void defaultPublicUploadRootUsesProjectRootEvenWhenUserDirIsOutsideProject() throws Exception {
        String previousUserDir = System.getProperty("user.dir");
        Path outsideProject = Files.createTempDirectory("omni-outside-user-dir");
        Path projectRoot = findProjectRoot(Path.of(ProjectPathUtilTest.class.getProtectionDomain().getCodeSource().getLocation().toURI()));
        try {
            System.setProperty("user.dir", outsideProject.toString());

            Path root = ProjectPathUtil.resolvePublicUploadRoot("");

            assertEquals(projectRoot.resolve("runtime").resolve("uploads"), root);
        } finally {
            System.setProperty("user.dir", previousUserDir);
        }
    }

    @Test
    void defaultPrivateUploadRootUsesProjectRootEvenWhenUserDirIsOutsideProject() throws Exception {
        String previousUserDir = System.getProperty("user.dir");
        Path outsideProject = Files.createTempDirectory("omni-outside-user-dir");
        Path projectRoot = findProjectRoot(Path.of(ProjectPathUtilTest.class.getProtectionDomain().getCodeSource().getLocation().toURI()));
        try {
            System.setProperty("user.dir", outsideProject.toString());

            Path root = ProjectPathUtil.resolvePrivateUploadRoot("", "ticket");

            assertEquals(projectRoot.resolve("runtime").resolve("private-uploads").resolve("ticket"), root);
        } finally {
            System.setProperty("user.dir", previousUserDir);
        }
    }

    private Path findProjectRoot(Path start) {
        Path cursor = start.toAbsolutePath().normalize();
        while (cursor != null) {
            if (Files.isDirectory(cursor.resolve("java")) && Files.isDirectory(cursor.resolve("frontend"))) {
                return cursor;
            }
            cursor = cursor.getParent();
        }
        throw new IllegalStateException("Cannot find project root from " + start);
    }
}
