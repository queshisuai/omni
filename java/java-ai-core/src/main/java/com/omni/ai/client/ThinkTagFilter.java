package com.omni.ai.client;

import java.util.Locale;

final class ThinkTagFilter {
    private static final String START_TAG = "<think>";
    private static final String END_TAG = "</think>";
    private static final int MAX_TAG_LENGTH = END_TAG.length();

    private boolean inThink;
    private String carry = "";

    String accept(String chunk) {
        if (chunk == null || chunk.isEmpty()) {
            return "";
        }
        String input = carry + chunk;
        carry = "";
        StringBuilder output = new StringBuilder();
        int index = 0;
        while (index < input.length()) {
            String remainingLower = input.substring(index).toLowerCase(Locale.ROOT);
            if (inThink) {
                int end = remainingLower.indexOf(END_TAG);
                if (end < 0) {
                    carry = input.substring(Math.max(index, input.length() - MAX_TAG_LENGTH));
                    return output.toString();
                }
                index += end + END_TAG.length();
                inThink = false;
                continue;
            }

            int start = remainingLower.indexOf(START_TAG);
            if (start < 0) {
                int safeEnd = Math.max(index, input.length() - START_TAG.length());
                output.append(input, index, safeEnd);
                carry = input.substring(safeEnd);
                return output.toString();
            }
            output.append(input, index, index + start);
            index += start + START_TAG.length();
            inThink = true;
        }
        return output.toString();
    }

    String flush() {
        if (inThink) {
            carry = "";
            return "";
        }
        String tail = carry;
        carry = "";
        return tail;
    }
}
