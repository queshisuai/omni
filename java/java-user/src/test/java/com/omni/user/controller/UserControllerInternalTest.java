package com.omni.user.controller;

import com.omni.user.dto.InternalUserRefResponse;
import com.omni.user.service.OrganizerApplicationService;
import com.omni.user.service.UserService;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class UserControllerInternalTest {

    private final UserService userService = mock(UserService.class);
    private final OrganizerApplicationService organizerApplicationService = mock(OrganizerApplicationService.class);
    private final UserController controller = new UserController(userService, organizerApplicationService, "internal-token");

    @Test
    void internalUserRefRejectsMissingToken() {
        var result = controller.getInternalUserRef(2004L, null);

        assertEquals(403, result.getCode());
        verify(userService, never()).getInternalUserRef(2004L);
    }

    @Test
    void internalUserRefRejectsWrongToken() {
        var result = controller.getInternalUserRef(2004L, "wrong-token");

        assertEquals(403, result.getCode());
        verify(userService, never()).getInternalUserRef(2004L);
    }

    @Test
    void internalUserRefReturnsUserWhenTokenMatches() {
        InternalUserRefResponse user = new InternalUserRefResponse();
        user.setId(2004L);
        user.setRole("organizer");
        when(userService.getInternalUserRef(2004L)).thenReturn(user);

        var result = controller.getInternalUserRef(2004L, "internal-token");

        assertEquals(200, result.getCode());
        assertEquals(2004L, result.getData().getId());
        assertEquals("organizer", result.getData().getRole());
    }

    @Test
    void internalUserRefRejectsEmptyConfiguredToken() {
        UserController emptyTokenController = new UserController(userService, organizerApplicationService, "");

        var result = emptyTokenController.getInternalUserRef(2004L, "internal-token");

        assertEquals(403, result.getCode());
        assertNull(result.getData());
    }
}
