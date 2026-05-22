package com.omni.ticket.config;

import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertTrue;

class UploadStaticResourceConfigTest {

    @Test
    void ticketUploadResourceLocationEndsWithSlash() throws Exception {
        Path uploadRoot = Files.createTempDirectory("omni-ticket-upload-root");

        String location = UploadStaticResourceConfig.ticketUploadLocation(uploadRoot.toString());

        assertTrue(location.endsWith("/"));
        assertTrue(location.replace('\\', '/').contains("/ticket/"));
    }
}
