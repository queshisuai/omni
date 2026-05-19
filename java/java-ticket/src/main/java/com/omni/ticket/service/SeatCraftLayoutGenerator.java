package com.omni.ticket.service;

import com.omni.exception.BusinessException;
import org.springframework.stereotype.Component;

@Component
public class SeatCraftLayoutGenerator {

    public int countSeats(Integer rows, Integer cols) {
        int rowCount = requirePositive(rows, "排数必须大于0");
        int colCount = requirePositive(cols, "座数必须大于0");
        return rowCount * colCount;
    }

    public String buildSeatLabel(int rowNo, int seatNo) {
        if (rowNo <= 0 || seatNo <= 0) {
            throw new BusinessException(400, "排号和座号必须大于0");
        }
        return rowNo + "排" + seatNo + "座";
    }

    private int requirePositive(Integer value, String message) {
        if (value == null || value <= 0) {
            throw new BusinessException(400, message);
        }
        return value;
    }
}
