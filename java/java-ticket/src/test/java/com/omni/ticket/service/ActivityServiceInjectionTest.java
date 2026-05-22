package com.omni.ticket.service;

import com.omni.ticket.mapper.ActivityMapper;
import com.omni.ticket.mapper.ArtistMapper;
import com.omni.ticket.mapper.CategoryMapper;
import com.omni.ticket.mapper.SessionMapper;
import com.omni.ticket.mapper.TicketTypeMapper;
import com.omni.ticket.mapper.VenueMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.AutowiredAnnotationBeanPostProcessor;
import org.springframework.beans.factory.config.ConstructorArgumentValues;
import org.springframework.beans.factory.support.RootBeanDefinition;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.Mockito.mock;

class ActivityServiceInjectionTest {
    @Test
    void springCanCreateActivityServiceWithConstructorInjection() {
        try (AnnotationConfigApplicationContext context = new AnnotationConfigApplicationContext()) {
            context.registerBean(AutowiredAnnotationBeanPostProcessor.class);
            context.registerBean(ActivityMapper.class, () -> mock(ActivityMapper.class));
            context.registerBean(CategoryMapper.class, () -> mock(CategoryMapper.class));
            context.registerBean(ArtistMapper.class, () -> mock(ArtistMapper.class));
            context.registerBean(SessionMapper.class, () -> mock(SessionMapper.class));
            context.registerBean(VenueMapper.class, () -> mock(VenueMapper.class));
            context.registerBean(TicketTypeMapper.class, () -> mock(TicketTypeMapper.class));
            context.registerBean(ActivityArtistService.class, () -> mock(ActivityArtistService.class));
            context.registerBeanDefinition(ActivityService.class.getName(), new RootBeanDefinition(ActivityService.class));

            context.refresh();

            assertNotNull(context.getBean(ActivityService.class));
        }
    }
}
