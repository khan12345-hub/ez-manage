// src/database/seed/seed.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module'; // Or whichever module contains your SeedService
import { SeedService } from './seed.service';

async function bootstrap() {
  // 1. Create the application context
  const app = await NestFactory.createApplicationContext(AppModule);
  
  // 2. Resolve the SeedService from the context
  const seedService = app.get(SeedService);

  try {
    console.log('Starting database seeding...');
    await seedService.seed();
    console.log('Seeding completed successfully!');
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

bootstrap();