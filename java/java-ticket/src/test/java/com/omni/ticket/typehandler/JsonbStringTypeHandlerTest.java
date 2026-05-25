package com.omni.ticket.typehandler;

import org.junit.jupiter.api.Test;
import org.postgresql.util.PGobject;

import java.sql.PreparedStatement;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class JsonbStringTypeHandlerTest {

    @Test
    void setNonNullParameterWritesJsonbPgobject() throws Exception {
        String json = "[{\"x\":0,\"y\":0}]";
        PreparedStatement statement = mock(PreparedStatement.class);
        JsonbStringTypeHandler handler = new JsonbStringTypeHandler();

        handler.setNonNullParameter(statement, 1, json, null);

        verify(statement).setObject(org.mockito.ArgumentMatchers.eq(1), org.mockito.ArgumentMatchers.argThat(value -> {
            PGobject object = assertInstanceOf(PGobject.class, value);
            assertEquals("jsonb", object.getType());
            assertEquals(json, object.getValue());
            return true;
        }));
    }
}
