package com.omni.exception;

import com.omni.common.result.Result;
import org.junit.jupiter.api.Test;
import org.springframework.core.MethodParameter;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.lang.reflect.Method;

import static org.junit.jupiter.api.Assertions.assertEquals;

class GlobalExceptionHandlerTest {

    @Test
    void handleTypeMismatchReturnsBadRequestInsteadOfInternalError() throws Exception {
        GlobalExceptionHandler handler = new GlobalExceptionHandler();
        Method method = SampleController.class.getDeclaredMethod("sample", Long.class);
        MethodParameter parameter = new MethodParameter(method, 0);
        MethodArgumentTypeMismatchException exception = new MethodArgumentTypeMismatchException(
                "NaN", Long.class, "userId", parameter, new NumberFormatException("For input string: \"NaN\""));

        Result<Void> result = handler.handleMethodArgumentTypeMismatch(exception);

        assertEquals(400, result.getCode());
        assertEquals("参数格式不正确", result.getMessage());
    }

    static class SampleController {
        void sample(Long userId) {
        }
    }
}
