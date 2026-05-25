package com.omni.ticket.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.omni.ticket.entity.Artist;
import com.omni.ticket.mapper.ArtistMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ArtistAdminServiceTest {
    @Mock
    private ArtistMapper artistMapper;

    @Test
    void listManageableAllowsAdminToQueryAllArtists() {
        ArtistAdminService service = new ArtistAdminService(artistMapper);
        Page<Artist> page = new Page<>(1, 10);
        page.setRecords(List.of(artist(1L, 2003L)));
        when(artistMapper.selectPage(any(), any())).thenReturn(page);

        Page<Artist> result = service.listManageable(2002L, "admin", 1, 10, "周", "approved", "normal");

        assertEquals(1, result.getRecords().size());
        verify(artistMapper).selectPage(any(Page.class), any(LambdaQueryWrapper.class));
    }

    @Test
    void listManageableLimitsOrganizerToOwnSubmissions() {
        ArtistAdminService service = new ArtistAdminService(artistMapper);
        Page<Artist> page = new Page<>(1, 10);
        page.setRecords(List.of(artist(2L, 2003L)));
        when(artistMapper.selectPage(any(), any())).thenReturn(page);

        Page<Artist> result = service.listManageable(2003L, "organizer", 1, 10, null, null, null);

        assertEquals(1, result.getRecords().size());
        verify(artistMapper).selectPage(any(Page.class), any(LambdaQueryWrapper.class));
    }

    private Artist artist(Long id, Long submittedBy) {
        Artist artist = new Artist();
        artist.setId(id);
        artist.setName("测试艺人" + id);
        artist.setSubmittedBy(submittedBy);
        artist.setStatus(1);
        artist.setReviewStatus("pending");
        artist.setRiskStatus("normal");
        return artist;
    }
}
