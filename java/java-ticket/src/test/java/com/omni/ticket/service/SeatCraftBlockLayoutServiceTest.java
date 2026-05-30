package com.omni.ticket.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.omni.exception.BusinessException;
import com.omni.ticket.dto.SeatCraftBlockDtos;
import com.omni.ticket.entity.SeatBlock;
import com.omni.ticket.entity.SeatOverride;
import com.omni.ticket.entity.TicketGroup;
import com.omni.ticket.mapper.SeatBlockMapper;
import com.omni.ticket.mapper.SeatOverrideMapper;
import com.omni.ticket.mapper.TicketGroupMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.never;

@ExtendWith(MockitoExtension.class)
class SeatCraftBlockLayoutServiceTest {

    @Mock
    private SeatBlockMapper seatBlockMapper;
    @Mock
    private SeatOverrideMapper seatOverrideMapper;
    @Mock
    private TicketGroupMapper ticketGroupMapper;

    private SeatCraftBlockLayoutService service;

    @BeforeEach
    void setUp() {
        service = new SeatCraftBlockLayoutService(seatBlockMapper, seatOverrideMapper, ticketGroupMapper);
    }

    @Test
    void replaceLayoutPersistsBlocksOverridesAndTicketGroups() {
        SeatCraftBlockDtos.LayoutRequest layout = layout();
        when(seatBlockMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of());
        doAnswer(invocation -> {
            SeatBlock block = invocation.getArgument(0);
            block.setId(101L);
            return 1;
        }).when(seatBlockMapper).insert(any(SeatBlock.class));

        service.replaceLayout("venue", 9L, layout);

        ArgumentCaptor<SeatBlock> blockCaptor = ArgumentCaptor.forClass(SeatBlock.class);
        verify(seatBlockMapper).insert(blockCaptor.capture());
        SeatBlock block = blockCaptor.getValue();
        assertEquals("venue", block.getOwnerType());
        assertEquals(9L, block.getOwnerId());
        assertEquals("block-a", block.getBlockKey());
        assertEquals("gridBlock", block.getBlockType());
        assertEquals("vip", block.getTicketGroupKey());
        assertEquals(new BigDecimal("100"), block.getX());
        assertEquals(1, block.getStatus());

        ArgumentCaptor<SeatOverride> overrideCaptor = ArgumentCaptor.forClass(SeatOverride.class);
        verify(seatOverrideMapper).insert(overrideCaptor.capture());
        SeatOverride override = overrideCaptor.getValue();
        assertEquals(1, override.getRowNo());
        assertEquals(2, override.getSeatNo());
        assertEquals("visible", override.getStatus());
        assertEquals("A02", override.getCustomLabel());

        ArgumentCaptor<TicketGroup> groupCaptor = ArgumentCaptor.forClass(TicketGroup.class);
        verify(ticketGroupMapper).insert(groupCaptor.capture());
        TicketGroup group = groupCaptor.getValue();
        assertEquals("venue", group.getOwnerType());
        assertEquals(9L, group.getOwnerId());
        assertEquals("vip", group.getGroupKey());
        assertEquals("block-a", group.getSourceBlockIds());
        assertEquals(1, group.getStatus());
    }

    @Test
    void replaceLayoutPersistsHiddenAndDeletedOverrideStatuses() {
        SeatCraftBlockDtos.LayoutRequest layout = layout();
        SeatCraftBlockDtos.OverrideRequest hidden = new SeatCraftBlockDtos.OverrideRequest();
        hidden.setBlockKey("block-a");
        hidden.setRowNo(1);
        hidden.setSeatNo(1);
        hidden.setStatus("hidden");
        SeatCraftBlockDtos.OverrideRequest deleted = new SeatCraftBlockDtos.OverrideRequest();
        deleted.setBlockKey("block-a");
        deleted.setRowNo(2);
        deleted.setSeatNo(2);
        deleted.setStatus("deleted");
        layout.setOverrides(List.of(hidden, deleted));
        when(seatBlockMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of());
        doAnswer(invocation -> {
            SeatBlock block = invocation.getArgument(0);
            block.setId(101L);
            return 1;
        }).when(seatBlockMapper).insert(any(SeatBlock.class));

        service.replaceLayout("venue", 9L, layout);

        ArgumentCaptor<SeatOverride> overrideCaptor = ArgumentCaptor.forClass(SeatOverride.class);
        verify(seatOverrideMapper, org.mockito.Mockito.times(2)).insert(overrideCaptor.capture());
        assertEquals(List.of("hidden", "deleted"), overrideCaptor.getAllValues().stream().map(SeatOverride::getStatus).collect(Collectors.toList()));
        assertEquals(List.of(1, 2), overrideCaptor.getAllValues().stream().map(SeatOverride::getRowNo).collect(Collectors.toList()));
        assertEquals(List.of(1, 2), overrideCaptor.getAllValues().stream().map(SeatOverride::getSeatNo).collect(Collectors.toList()));
    }

    @Test
    void replaceLayoutPersistsSeatOverrideOffsetForFreeMovedSeat() {
        SeatCraftBlockDtos.LayoutRequest layout = layout();
        SeatCraftBlockDtos.OverrideRequest moved = new SeatCraftBlockDtos.OverrideRequest();
        moved.setBlockKey("block-a");
        moved.setRowNo(1);
        moved.setSeatNo(2);
        moved.setStatus("visible");
        moved.setDx(new BigDecimal("123.5"));
        moved.setDy(new BigDecimal("-45.25"));
        moved.setCustomLabel("A02");
        layout.setOverrides(List.of(moved));
        when(seatBlockMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of());
        doAnswer(invocation -> {
            SeatBlock block = invocation.getArgument(0);
            block.setId(101L);
            return 1;
        }).when(seatBlockMapper).insert(any(SeatBlock.class));

        service.replaceLayout("venue", 9L, layout);

        ArgumentCaptor<SeatOverride> overrideCaptor = ArgumentCaptor.forClass(SeatOverride.class);
        verify(seatOverrideMapper).insert(overrideCaptor.capture());
        SeatOverride override = overrideCaptor.getValue();
        assertEquals(new BigDecimal("123.5"), override.getDx());
        assertEquals(new BigDecimal("-45.25"), override.getDy());
        assertEquals("visible", override.getStatus());
        assertEquals("A02", override.getCustomLabel());
    }

    @Test
    void replaceLayoutPersistsAndReturnsPolygonPoints() {
        String polygonPoints = "[{\"x\":0,\"y\":0},{\"x\":20,\"y\":0},{\"x\":20,\"y\":20},{\"x\":0,\"y\":20}]";
        SeatCraftBlockDtos.LayoutRequest layout = layout();
        SeatCraftBlockDtos.BlockRequest request = layout.getBlocks().get(0);
        request.setBlockType("polygonBlock");
        request.setPolygonPoints(polygonPoints);
        when(seatBlockMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of());
        doAnswer(invocation -> {
            SeatBlock block = invocation.getArgument(0);
            block.setId(101L);
            return 1;
        }).when(seatBlockMapper).insert(any(SeatBlock.class));

        service.replaceLayout("venue", 9L, layout);

        ArgumentCaptor<SeatBlock> blockCaptor = ArgumentCaptor.forClass(SeatBlock.class);
        verify(seatBlockMapper).insert(blockCaptor.capture());
        SeatBlock insertedBlock = blockCaptor.getValue();
        assertEquals(polygonPoints, insertedBlock.getPolygonPoints());

        when(seatBlockMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(insertedBlock));
        when(seatOverrideMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of());

        SeatCraftBlockDtos.LayoutRequest result = service.getLayout("venue", 9L);

        assertNotNull(result);
        assertEquals(polygonPoints, result.getBlocks().get(0).getPolygonPoints());
    }

    @Test
    void replaceLayoutRejectsBlockWithUnknownTicketGroup() {
        SeatCraftBlockDtos.LayoutRequest layout = layout();
        layout.setTicketGroups(List.of());

        BusinessException error = assertThrows(BusinessException.class, () -> service.replaceLayout("venue", 9L, layout));

        assertEquals(400, error.getCode());
    }

    @Test
    void replaceLayoutUpdatesExistingBlockAndGroupWithSameKey() {
        SeatCraftBlockDtos.LayoutRequest layout = layout();
        SeatBlock existingBlock = new SeatBlock();
        existingBlock.setId(101L);
        existingBlock.setOwnerType("venue");
        existingBlock.setOwnerId(9L);
        existingBlock.setBlockKey("block-a");
        existingBlock.setStatus(0);
        when(seatBlockMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(existingBlock));
        TicketGroup existingGroup = new TicketGroup();
        existingGroup.setId(201L);
        existingGroup.setOwnerType("venue");
        existingGroup.setOwnerId(9L);
        existingGroup.setGroupKey("vip");
        existingGroup.setStatus(0);
        when(ticketGroupMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(existingGroup));

        service.replaceLayout("venue", 9L, layout);

        verify(seatBlockMapper, never()).insert(any(SeatBlock.class));
        verify(ticketGroupMapper, never()).insert(any(TicketGroup.class));
        verify(seatBlockMapper).updateById(org.mockito.ArgumentMatchers.argThat(block -> Long.valueOf(101L).equals(block.getId())
                && Integer.valueOf(1).equals(block.getStatus())
                && "gridBlock".equals(block.getBlockType())));
        verify(ticketGroupMapper).updateById(org.mockito.ArgumentMatchers.argThat(group -> Long.valueOf(201L).equals(group.getId())
                && Integer.valueOf(1).equals(group.getStatus())
                && "block-a".equals(group.getSourceBlockIds())));
        verify(seatOverrideMapper).delete(any(LambdaQueryWrapper.class));
        verify(seatOverrideMapper).insert(any(SeatOverride.class));
    }

    @Test
    void replaceLayoutTreatsNullSourceBlockKeysAsEmptyList() {
        SeatCraftBlockDtos.LayoutRequest layout = layout();
        layout.getTicketGroups().get(0).setSourceBlockKeys(null);
        when(seatBlockMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of());
        doAnswer(invocation -> {
            SeatBlock block = invocation.getArgument(0);
            block.setId(101L);
            return 1;
        }).when(seatBlockMapper).insert(any(SeatBlock.class));

        service.replaceLayout("venue", 9L, layout);

        ArgumentCaptor<TicketGroup> groupCaptor = ArgumentCaptor.forClass(TicketGroup.class);
        verify(ticketGroupMapper).insert(groupCaptor.capture());
        assertEquals("", groupCaptor.getValue().getSourceBlockIds());
    }

    @Test
    void getLayoutLoadsBlocksOverridesAndTicketGroups() {
        SeatBlock block = new SeatBlock();
        block.setId(101L);
        block.setBlockKey("block-a");
        block.setName("A 区");
        block.setBlockType("gridBlock");
        block.setTicketGroupKey("vip");
        block.setX(new BigDecimal("100"));
        block.setY(new BigDecimal("200"));
        block.setRows(2);
        block.setCols(3);
        block.setColor("#34d399");
        block.setSort(0);
        when(seatBlockMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(block));

        SeatOverride override = new SeatOverride();
        override.setBlockId(101L);
        override.setRowNo(1);
        override.setSeatNo(2);
        override.setStatus("visible");
        override.setDx(new BigDecimal("5"));
        override.setDy(new BigDecimal("7"));
        override.setCustomLabel("A02");
        when(seatOverrideMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(override));

        TicketGroup group = new TicketGroup();
        group.setGroupKey("vip");
        group.setName("VIP");
        group.setDefaultPrice(new BigDecimal("680.00"));
        group.setSourceBlockIds("block-a");
        group.setSort(0);
        when(ticketGroupMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(group));

        SeatCraftBlockDtos.LayoutRequest result = service.getLayout("venue", 9L);

        assertNotNull(result);
        assertEquals("block-a", result.getBlocks().get(0).getBlockKey());
        assertEquals("A02", result.getOverrides().get(0).getCustomLabel());
        assertEquals(List.of("block-a"), result.getTicketGroups().get(0).getSourceBlockKeys());
    }

    @Test
    void getLayoutReturnsHiddenAndDeletedOverrideStatuses() {
        SeatBlock block = new SeatBlock();
        block.setId(101L);
        block.setBlockKey("block-a");
        block.setName("A 区");
        block.setBlockType("gridBlock");
        block.setTicketGroupKey("vip");
        block.setX(new BigDecimal("100"));
        block.setY(new BigDecimal("200"));
        block.setRows(2);
        block.setCols(3);
        block.setColor("#34d399");
        block.setSort(0);
        when(seatBlockMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(block));

        SeatOverride hidden = new SeatOverride();
        hidden.setBlockId(101L);
        hidden.setRowNo(1);
        hidden.setSeatNo(1);
        hidden.setStatus("hidden");
        SeatOverride deleted = new SeatOverride();
        deleted.setBlockId(101L);
        deleted.setRowNo(2);
        deleted.setSeatNo(2);
        deleted.setStatus("deleted");
        when(seatOverrideMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(hidden, deleted));

        TicketGroup group = new TicketGroup();
        group.setGroupKey("vip");
        group.setName("VIP");
        group.setDefaultPrice(new BigDecimal("680.00"));
        group.setSourceBlockIds("block-a");
        group.setSort(0);
        when(ticketGroupMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(group));

        SeatCraftBlockDtos.LayoutRequest result = service.getLayout("venue", 9L);

        assertNotNull(result);
        assertEquals(List.of("hidden", "deleted"), result.getOverrides().stream().map(SeatCraftBlockDtos.OverrideRequest::getStatus).collect(Collectors.toList()));
        assertEquals(List.of(1, 2), result.getOverrides().stream().map(SeatCraftBlockDtos.OverrideRequest::getRowNo).collect(Collectors.toList()));
        assertEquals(List.of(1, 2), result.getOverrides().stream().map(SeatCraftBlockDtos.OverrideRequest::getSeatNo).collect(Collectors.toList()));
    }

    @Test
    void getLayoutReturnsSeatOverrideOffsetForFreeMovedSeat() {
        SeatBlock block = new SeatBlock();
        block.setId(101L);
        block.setBlockKey("block-a");
        block.setName("A 区");
        block.setBlockType("gridBlock");
        block.setTicketGroupKey("vip");
        block.setX(new BigDecimal("100"));
        block.setY(new BigDecimal("200"));
        block.setRows(2);
        block.setCols(3);
        block.setColor("#34d399");
        block.setSort(0);
        when(seatBlockMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(block));

        SeatOverride moved = new SeatOverride();
        moved.setBlockId(101L);
        moved.setRowNo(1);
        moved.setSeatNo(2);
        moved.setStatus("visible");
        moved.setDx(new BigDecimal("123.5"));
        moved.setDy(new BigDecimal("-45.25"));
        moved.setCustomLabel("A02");
        when(seatOverrideMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(moved));

        TicketGroup group = new TicketGroup();
        group.setGroupKey("vip");
        group.setName("VIP");
        group.setDefaultPrice(new BigDecimal("680.00"));
        group.setSourceBlockIds("block-a");
        group.setSort(0);
        when(ticketGroupMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(group));

        SeatCraftBlockDtos.LayoutRequest result = service.getLayout("venue", 9L);

        assertNotNull(result);
        assertEquals(new BigDecimal("123.5"), result.getOverrides().get(0).getDx());
        assertEquals(new BigDecimal("-45.25"), result.getOverrides().get(0).getDy());
        assertEquals("A02", result.getOverrides().get(0).getCustomLabel());
    }

    private SeatCraftBlockDtos.LayoutRequest layout() {
        SeatCraftBlockDtos.LayoutRequest layout = new SeatCraftBlockDtos.LayoutRequest();
        SeatCraftBlockDtos.BlockRequest block = new SeatCraftBlockDtos.BlockRequest();
        block.setBlockKey("block-a");
        block.setName("A 区");
        block.setBlockType("gridBlock");
        block.setTicketGroupKey("vip");
        block.setX(new BigDecimal("100"));
        block.setY(new BigDecimal("200"));
        block.setRows(2);
        block.setCols(3);
        block.setColor("#34d399");
        layout.setBlocks(List.of(block));

        SeatCraftBlockDtos.OverrideRequest override = new SeatCraftBlockDtos.OverrideRequest();
        override.setBlockKey("block-a");
        override.setRowNo(1);
        override.setSeatNo(2);
        override.setStatus("visible");
        override.setDx(new BigDecimal("5"));
        override.setDy(new BigDecimal("7"));
        override.setCustomLabel("A02");
        layout.setOverrides(List.of(override));

        SeatCraftBlockDtos.TicketGroupRequest group = new SeatCraftBlockDtos.TicketGroupRequest();
        group.setGroupKey("vip");
        group.setName("VIP");
        group.setDefaultPrice(new BigDecimal("680.00"));
        group.setSourceBlockKeys(List.of("block-a"));
        layout.setTicketGroups(List.of(group));
        return layout;
    }
}
