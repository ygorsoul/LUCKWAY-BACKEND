import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { DatabaseService } from '../src/database/database.service';
import request from 'supertest';

/**
 * Creates a test application instance
 */
export async function createTestApp(): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  app.setGlobalPrefix('api');

  await app.init();
  return app;
}

/**
 * Cleans up test database
 */
export async function cleanupDatabase(app: INestApplication): Promise<void> {
  const db = app.get(DatabaseService);

  // Delete in order to respect foreign key constraints
  await db.trip.deleteMany({});
  await db.vehicle.deleteMany({});
  await db.user.deleteMany({});
}

/**
 * Helper to create a test user and return auth token
 */
export async function createAuthenticatedUser(
  server: any,
  userData: { email: string; password: string; name: string } = {
    email: 'test@example.com',
    password: 'password123',
    name: 'Test User',
  },
): Promise<{ token: string; userId: string; user: any }> {
  const response = await request(server).post('/api/auth/register').send(userData);

  return {
    token: response.body.accessToken,
    userId: response.body.user.id,
    user: response.body.user,
  };
}
