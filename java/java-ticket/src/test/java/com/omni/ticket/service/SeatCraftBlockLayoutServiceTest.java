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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.doAnswer;

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
    void replaceLayoutRejectsBlockWithUnknownTicketGroup() {
        SeatCraftBlockDtos.LayoutRequest layout = layout();
        layout.setTicketGroups(List.of());

        BusinessException error = assertThrows(BusinessException.class, () -> service.replaceLayout("venue", 9L, layout));

        assertEquals(400, error.getCode());
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
