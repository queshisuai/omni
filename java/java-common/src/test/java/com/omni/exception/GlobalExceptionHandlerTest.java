package com.omni.exception;

import com.omni.common.result.Result;
import org.apache.catalina.connector.ClientAbortException;
import org.junit.jupiter.api.Test;
import org.springframework.core.MethodParameter;
import org.springframework.http.HttpStatus;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;

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

    @Test
    void handleMethodNotSupportedReturnsMethodNotAllowedInsteadOfInternalError() {
        GlobalExceptionHandler handler = new GlobalExceptionHandler();
        HttpRequestMethodNotSupportedException exception = new HttpRequestMethodNotSupportedException(
                "DELETE", new String[]{"GET", "HEAD"});

        Result<Void> result = handler.handleHttpRequestMethodNotSupported(exception);

        assertEquals(405, result.getCode());
        assertEquals("请求方法不支持", result.getMessage());
    }

    @Test
    void clientAbortUsesDedicatedNoContentHandlerInsteadOfInternalError() throws Exception {
        Method method = GlobalExceptionHandler.class.getDeclaredMethod(
                "handleClientAbortException", ClientAbortException.class);

        ExceptionHandler exceptionHandler = method.getAnnotation(ExceptionHandler.class);
        ResponseStatus responseStatus = method.getAnnotation(ResponseStatus.class);

        assertEquals(Void.TYPE, method.getReturnType());
        assertEquals(ClientAbortException.class, exceptionHandler.value()[0]);
        assertEquals(HttpStatus.NO_CONTENT, responseStatus.value());
    }

    static class SampleController {
        void sample(Long userId) {
        }
    }
}
