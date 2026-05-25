package com.omni.ticket.dto;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class SeatCraftBlockDtosTest {
    @Test
    void layoutRequestCarriesVersionAndBindings() {
        SeatCraftBlockDtos.LayoutRequest layout = new SeatCraftBlockDtos.LayoutRequest();
        layout.setVersionId(10L);
        layout.setVersionNo(3);
        layout.setVersionStatus("draft");

        SeatCraftBlockDtos.BindingRequest binding = new SeatCraftBlockDtos.BindingRequest();
        binding.setBlockKey("block-a");
        binding.setGroupKey("vip");
        binding.setBindingRole("primary");
        binding.setSort(1);
        layout.getBindings().add(binding);

        assertEquals(10L, layout.getVersionId());
        assertEquals(3, layout.getVersionNo());
        assertEquals("draft", layout.getVersionStatus());
        assertEquals("block-a", layout.getBindings().get(0).getBlockKey());
        assertEquals("vip", layout.getBindings().get(0).getGroupKey());
        assertEquals("primary", layout.getBindings().get(0).getBindingRole());
    }
}
