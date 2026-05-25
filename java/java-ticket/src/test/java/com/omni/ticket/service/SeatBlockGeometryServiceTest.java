package com.omni.ticket.service;

import com.omni.ticket.entity.SeatBlock;
import com.omni.ticket.entity.SeatOverride;
import com.omni.exception.BusinessException;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class SeatBlockGeometryServiceTest {
    private final SeatBlockGeometryService service = new SeatBlockGeometryService();

    @Test
    void gridBlockGeneratesRowsTimesColsSeats() {
        List<SeatBlockGeometryService.GeneratedSeat> seats = service.generateSeats(gridBlock(), List.of());

        assertEquals(6, seats.size());
        assertEquals("1排1座", seats.get(0).getLabel());
        assertEquals(100.0, seats.get(0).getX());
        assertEquals(200.0, seats.get(0).getY());
    }

    @Test
    void hiddenAndDeletedOverridesAreExcluded() {
        List<SeatOverride> overrides = List.of(override(1, 1, "hidden", null, null, null), override(1, 2, "deleted", null, null, null));

        assertEquals(4, service.generateSeats(gridBlock(), overrides).size());
    }

    @Test
    void visibleOverrideCanMoveAndRenameSeat() {
        List<SeatBlockGeometryService.GeneratedSeat> seats = service.generateSeats(gridBlock(),
                List.of(override(1, 1, "visible", new BigDecimal("5"), new BigDecimal("7"), "A01")));

        assertEquals("A01", seats.get(0).getLabel());
        assertEquals(105.0, seats.get(0).getX());
        assertEquals(207.0, seats.get(0).getY());
    }

    @Test
    void visibleOverrideCanMoveSeatToArbitraryCanvasPosition() {
        List<SeatBlockGeometryService.GeneratedSeat> seats = service.generateSeats(gridBlock(),
                List.of(override(1, 1, "visible", new BigDecimal("350"), new BigDecimal("-120"), null)));

        assertEquals(450.0, seats.get(0).getX());
        assertEquals(80.0, seats.get(0).getY());
        assertEquals(6, seats.size());
    }

    @Test
    void movedVisibleOverrideDoesNotChangeSellableSeatCount() {
        int stock = service.countSellableSeats(gridBlock(),
                List.of(override(1, 1, "visible", new BigDecimal("350"), new BigDecimal("-120"), null)));

        assertEquals(6, stock);
    }

    @Test
    void arcBlockGeneratesCurvedCoordinates() {
        List<SeatBlockGeometryService.GeneratedSeat> seats = service.generateSeats(arcBlock(), List.of());

        assertEquals(6, seats.size());
        assertNotEquals(seats.get(0).getX(), seats.get(1).getX());
        assertNotEquals(seats.get(0).getY(), seats.get(1).getY());
    }

    @Test
    void standingBlockGeneratesNoSeatsButCountsCapacity() {
        SeatBlock block = standingBlock();

        assertEquals(0, service.generateSeats(block, List.of()).size());
        assertEquals(500, service.countSellableSeats(block, List.of()));
    }

    @Test
    void polygonBlockGeneratesSeatsInsideBounds() {
        List<SeatBlockGeometryService.GeneratedSeat> seats = service.generateSeats(polygonBlock(squarePoints()), List.of());

        assertEquals(9, seats.size());
        assertEquals(10.0, seats.get(0).getX());
        assertEquals(20.0, seats.get(0).getY());
        assertEquals(30.0, seats.get(8).getX());
        assertEquals(40.0, seats.get(8).getY());
    }

    @Test
    void polygonBlockExcludesOutsideCandidates() {
        List<SeatBlockGeometryService.GeneratedSeat> seats = service.generateSeats(
                polygonBlock("[{\"x\":0,\"y\":0},{\"x\":20,\"y\":0},{\"x\":0,\"y\":20}]"), List.of());

        assertEquals(6, seats.size());
    }

    @Test
    void polygonBlockAppliesOverrides() {
        List<SeatBlockGeometryService.GeneratedSeat> seats = service.generateSeats(polygonBlock(squarePoints()),
                List.of(override(1, 1, "hidden", null, null, null),
                        override(1, 2, "visible", new BigDecimal("5"), new BigDecimal("7"), "P02")));

        assertEquals(8, seats.size());
        assertEquals("P02", seats.get(0).getLabel());
        assertEquals(25.0, seats.get(0).getX());
        assertEquals(27.0, seats.get(0).getY());
    }

    @Test
    void polygonBlockRejectsInvalidPoints() {
        BusinessException exception = assertThrows(BusinessException.class,
                () -> service.generateSeats(polygonBlock("[{\"x\":0,\"y\":0},{\"x\":20,\"y\":0}]"), List.of()));

        assertEquals(400, exception.getCode());
    }

    @Test
    void polygonBlockRejectsMalformedJson() {
        BusinessException exception = assertThrows(BusinessException.class,
                () -> service.generateSeats(polygonBlock("[{\"x\":0,"), List.of()));

        assertEquals(400, exception.getCode());
        assertEquals("多边形座位块顶点不正确", exception.getMessage());
    }

    @Test
    void polygonBlockRejectsNullJson() {
        BusinessException exception = assertThrows(BusinessException.class,
                () -> service.generateSeats(polygonBlock("null"), List.of()));

        assertEquals(400, exception.getCode());
        assertEquals("多边形座位块顶点不正确", exception.getMessage());
    }

    @Test
    void polygonBlockRejectsMissingCoordinate() {
        BusinessException exception = assertThrows(BusinessException.class,
                () -> service.generateSeats(polygonBlock("[{\"x\":0,\"y\":0},{\"x\":20},{\"x\":0,\"y\":20}]"), List.of()));

        assertEquals(400, exception.getCode());
        assertEquals("多边形座位块顶点不正确", exception.getMessage());
    }

    @Test
    void polygonBlockRejectsNullPoint() {
        BusinessException exception = assertThrows(BusinessException.class,
                () -> service.generateSeats(polygonBlock("[{\"x\":0,\"y\":0},null,{\"x\":0,\"y\":20}]"), List.of()));

        assertEquals(400, exception.getCode());
        assertEquals("多边形座位块顶点不正确", exception.getMessage());
    }

    @Test
    void polygonBlockRejectsZeroArea() {
        BusinessException exception = assertThrows(BusinessException.class,
                () -> service.generateSeats(polygonBlock("[{\"x\":0,\"y\":0},{\"x\":10,\"y\":10},{\"x\":20,\"y\":20}]"), List.of()));

        assertEquals(400, exception.getCode());
        assertEquals("多边形座位块面积必须大于0", exception.getMessage());
    }

    @Test
    void polygonBlockRejectsNonPositiveSpacing() {
        SeatBlock block = polygonBlock(squarePoints());
        block.setRowSpacing(BigDecimal.ZERO);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> service.generateSeats(block, List.of()));

        assertEquals(400, exception.getCode());
    }

    private SeatBlock gridBlock() {
        SeatBlock block = baseBlock("gridBlock");
        block.setRows(2);
        block.setCols(3);
        block.setX(new BigDecimal("100"));
        block.setY(new BigDecimal("200"));
        block.setRowSpacing(new BigDecimal("10"));
        block.setSeatSpacing(new BigDecimal("20"));
        return block;
    }

    private SeatBlock arcBlock() {
        SeatBlock block = baseBlock("arcBlock");
        block.setRows(2);
        block.setSeatsPerRow(3);
        block.setX(new BigDecimal("500"));
        block.setY(new BigDecimal("400"));
        block.setInnerRadius(new BigDecimal("80"));
        block.setRowSpacing(new BigDecimal("30"));
        block.setArcStartAngle(new BigDecimal("0"));
        block.setArcEndAngle(new BigDecimal("90"));
        return block;
    }

    private SeatBlock standingBlock() {
        SeatBlock block = baseBlock("standingBlock");
        block.setCapacity(500);
        return block;
    }

    private SeatBlock polygonBlock(String polygonPoints) {
        SeatBlock block = baseBlock("polygonBlock");
        block.setX(new BigDecimal("10"));
        block.setY(new BigDecimal("20"));
        block.setRowSpacing(new BigDecimal("10"));
        block.setSeatSpacing(new BigDecimal("10"));
        block.setPolygonPoints(polygonPoints);
        return block;
    }

    private String squarePoints() {
        return "[{\"x\":0,\"y\":0},{\"x\":20,\"y\":0},{\"x\":20,\"y\":20},{\"x\":0,\"y\":20}]";
    }

    private SeatBlock baseBlock(String type) {
        SeatBlock block = new SeatBlock();
        block.setId(1L);
        block.setBlockKey("block-a");
        block.setTicketGroupKey("vip");
        block.setBlockType(type);
        return block;
    }

    private SeatOverride override(int row, int seat, String status, BigDecimal dx, BigDecimal dy, String label) {
        SeatOverride override = new SeatOverride();
        override.setRowNo(row);
        override.setSeatNo(seat);
        override.setStatus(status);
        override.setDx(dx);
        override.setDy(dy);
        override.setCustomLabel(label);
        return override;
    }
}
