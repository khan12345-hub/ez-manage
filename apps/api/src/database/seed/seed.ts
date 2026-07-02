import {NestFactory} from '@nestjs/core';
import {SeedModule} from './seed.module';
import {SeedService} from './seed.service';
import * as dotenv from 'dotenv';

dotenv.config();
async function bootstrap(){
    const app = await NestFactory.createApplicationContext(SeedModule);
    const seedService = app.get(SeedService);
    await seedService.seed();
    await app.close();
}

bootstrap();