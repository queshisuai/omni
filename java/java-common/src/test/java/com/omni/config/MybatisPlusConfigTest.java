package com.omni.config;

import com.baomidou.mybatisplus.annotation.DbType;
import com.baomidou.mybatisplus.core.incrementer.IKeyGenerator;
import com.baomidou.mybatisplus.extension.incrementer.PostgreKeyGenerator;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;

class MybatisPlusConfigTest {

    @Test
    void registersPostgresqlKeyGeneratorForSequenceIds() {
        try (AnnotationConfigApplicationContext context = new AnnotationConfigApplicationContext(MybatisPlusConfig.class)) {
            IKeyGenerator keyGenerator = context.getBean(IKeyGenerator.class);

            assertInstanceOf(PostgreKeyGenerator.class, keyGenerator);
            assertEquals(DbType.POSTGRE_SQL, keyGenerator.dbType());
        }
    }
}
