package com.omni.ticket.service;

import com.omni.ticket.entity.UserRef;
import com.omni.ticket.entity.Venue;
import com.omni.ticket.entity.VenueSeatLayoutTemplate;
import com.omni.ticket.entity.VenueSeatLayoutTemplateSection;
import com.omni.ticket.mapper.UserRefMapper;
import com.omni.ticket.mapper.VenueMapper;
import com.omni.ticket.mapper.VenueSeatLayoutTemplateMapper;
import com.omni.ticket.mapper.VenueSeatLayoutTemplateSectionMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SeatCraftTemplateServiceTest {

    @Mock
    private VenueMapper venueMapper;

    @Mock
    private UserRefMapper userRefMapper;

    @Mock
    private VenueSeatLayoutTemplateMapper templateMapper;

    @Mock
    private VenueSeatLayoutTemplateSectionMapper sectionMapper;

    private SeatCraftTemplateService service;

    @BeforeEach
    void setUp() {
        service = new SeatCraftTemplateService(venueMapper, userRefMapper, templateMapper, sectionMapper);
    }

    @Test
    void ensureDefaultsCreatesThreeTemplatesAndDefaultSectionsWhenMissing() {
        when(userRefMapper.selectById(2002L)).thenReturn(user(2002L, "admin"));
        when(venueMapper.selectById(1L)).thenReturn(activeVenue(1L));
        when(templateMapper.selectList(any())).thenReturn(List.of());

        List<VenueSeatLayoutTemplate> templates = service.ensureDefaults(2002L, 1L);

        assertEquals(3, templates.size());
        assertTrue(templates.stream().anyMatch(template -> "concert".equals(template.getTemplateType())));
        assertTrue(templates.stream().anyMatch(template -> "cinema".equals(template.getTemplateType())));
        assertTrue(templates.stream().anyMatch(template -> "custom".equals(template.getTemplateType())));
        verify(templateMapper, times(3)).insert(any(VenueSeatLayoutTemplate.class));
        verify(sectionMapper, atLeastOnce()).insert(any(VenueSeatLayoutTemplateSection.class));
    }

    private UserRef user(Long id, String role) {
        UserRef user = new UserRef();
        user.setId(id);
        user.setRole(role);
        return user;
    }

    private Venue activeVenue(Long id) {
        Venue venue = new Venue();
        venue.setId(id);
        venue.setStatus(1);
        return venue;
    }
}
