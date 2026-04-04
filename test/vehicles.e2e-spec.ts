import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, cleanupDatabase, createAuthenticatedUser } from './test-utils';

describe('Vehicles (E2E)', () => {
  let app: INestApplication;
  let server: any;
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();
  });

  beforeEach(async () => {
    await cleanupDatabase(app);
    const auth = await createAuthenticatedUser(server);
    authToken = auth.token;
    userId = auth.userId;
  });

  afterAll(async () => {
    await cleanupDatabase(app);
    await app.close();
  });

  describe('POST /api/vehicles', () => {
    it('should create a new vehicle successfully', async () => {
      const vehicleDto = {
        name: 'My Car',
        type: 'CAR',
        fuelType: 'GASOLINE',
        averageConsumption: 12.5,
        tankCapacity: 50,
        brand: 'Toyota',
        model: 'Corolla',
        year: 2020,
      };

      const response = await request(server)
        .post('/api/vehicles')
        .set('Authorization', `Bearer ${authToken}`)
        .send(vehicleDto)
        .expect(201);

      expect(response.body).toMatchObject({
        name: vehicleDto.name,
        type: vehicleDto.type,
        fuelType: vehicleDto.fuelType,
        averageConsumption: vehicleDto.averageConsumption,
        tankCapacity: vehicleDto.tankCapacity,
        brand: vehicleDto.brand,
        model: vehicleDto.model,
        year: vehicleDto.year,
      });
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('userId');
      expect(response.body.userId).toBe(userId);
    });

    it('should create vehicle with only required fields', async () => {
      const vehicleDto = {
        name: 'Basic Car',
        type: 'CAR',
        fuelType: 'GASOLINE',
        averageConsumption: 10.0,
        tankCapacity: 45,
      };

      const response = await request(server)
        .post('/api/vehicles')
        .set('Authorization', `Bearer ${authToken}`)
        .send(vehicleDto)
        .expect(201);

      expect(response.body).toMatchObject(vehicleDto);
    });

    it('should fail without authentication', async () => {
      const vehicleDto = {
        name: 'My Car',
        type: 'CAR',
        fuelType: 'GASOLINE',
        averageConsumption: 12.5,
        tankCapacity: 50,
      };

      await request(server).post('/api/vehicles').send(vehicleDto).expect(401);
    });

    it('should fail with invalid vehicle type', async () => {
      const vehicleDto = {
        name: 'My Car',
        type: 'INVALID_TYPE',
        fuelType: 'GASOLINE',
        averageConsumption: 12.5,
        tankCapacity: 50,
      };

      const response = await request(server)
        .post('/api/vehicles')
        .set('Authorization', `Bearer ${authToken}`)
        .send(vehicleDto)
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    it('should fail with missing required fields', async () => {
      const vehicleDto = {
        name: 'My Car',
        type: 'CAR',
        // missing fuelType, averageConsumption, tankCapacity
      };

      await request(server)
        .post('/api/vehicles')
        .set('Authorization', `Bearer ${authToken}`)
        .send(vehicleDto)
        .expect(400);
    });

    it('should fail with negative consumption', async () => {
      const vehicleDto = {
        name: 'My Car',
        type: 'CAR',
        fuelType: 'GASOLINE',
        averageConsumption: -5,
        tankCapacity: 50,
      };

      await request(server)
        .post('/api/vehicles')
        .set('Authorization', `Bearer ${authToken}`)
        .send(vehicleDto)
        .expect(400);
    });
  });

  describe('GET /api/vehicles', () => {
    it('should return all user vehicles', async () => {
      // Create multiple vehicles
      const vehicle1 = {
        name: 'Car 1',
        type: 'CAR',
        fuelType: 'GASOLINE',
        averageConsumption: 12.5,
        tankCapacity: 50,
      };

      const vehicle2 = {
        name: 'Van 1',
        type: 'VAN',
        fuelType: 'DIESEL',
        averageConsumption: 15.0,
        tankCapacity: 80,
      };

      await request(server)
        .post('/api/vehicles')
        .set('Authorization', `Bearer ${authToken}`)
        .send(vehicle1);

      await request(server)
        .post('/api/vehicles')
        .set('Authorization', `Bearer ${authToken}`)
        .send(vehicle2);

      const response = await request(server)
        .get('/api/vehicles')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(2);
      expect(response.body[0].name).toBe('Van 1'); // Should be ordered by createdAt desc
      expect(response.body[1].name).toBe('Car 1');
    });

    it('should return empty array when user has no vehicles', async () => {
      const response = await request(server)
        .get('/api/vehicles')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(0);
    });

    it('should fail without authentication', async () => {
      await request(server).get('/api/vehicles').expect(401);
    });

    it('should only return vehicles belonging to the authenticated user', async () => {
      // Create vehicle for first user
      await request(server)
        .post('/api/vehicles')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'User 1 Car',
          type: 'CAR',
          fuelType: 'GASOLINE',
          averageConsumption: 12.5,
          tankCapacity: 50,
        });

      // Create second user
      const auth2 = await createAuthenticatedUser(server, {
        email: 'user2@example.com',
        password: 'password123',
        name: 'User 2',
      });

      // Create vehicle for second user
      await request(server)
        .post('/api/vehicles')
        .set('Authorization', `Bearer ${auth2.token}`)
        .send({
          name: 'User 2 Car',
          type: 'CAR',
          fuelType: 'GASOLINE',
          averageConsumption: 10.0,
          tankCapacity: 45,
        });

      // First user should only see their vehicle
      const response = await request(server)
        .get('/api/vehicles')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].name).toBe('User 1 Car');
    });
  });

  describe('GET /api/vehicles/:id', () => {
    let vehicleId: string;

    beforeEach(async () => {
      const createResponse = await request(server)
        .post('/api/vehicles')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Vehicle',
          type: 'CAR',
          fuelType: 'GASOLINE',
          averageConsumption: 12.5,
          tankCapacity: 50,
        });

      vehicleId = createResponse.body.id;
    });

    it('should return vehicle by id', async () => {
      const response = await request(server)
        .get(`/api/vehicles/${vehicleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: vehicleId,
        name: 'Test Vehicle',
        type: 'CAR',
      });
    });

    it('should fail when vehicle does not exist', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      await request(server)
        .get(`/api/vehicles/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should fail when accessing another user vehicle', async () => {
      // Create second user
      const auth2 = await createAuthenticatedUser(server, {
        email: 'user2@example.com',
        password: 'password123',
        name: 'User 2',
      });

      // Try to access first user's vehicle
      await request(server)
        .get(`/api/vehicles/${vehicleId}`)
        .set('Authorization', `Bearer ${auth2.token}`)
        .expect(403);
    });

    it('should fail without authentication', async () => {
      await request(server).get(`/api/vehicles/${vehicleId}`).expect(401);
    });
  });

  describe('PATCH /api/vehicles/:id', () => {
    let vehicleId: string;

    beforeEach(async () => {
      const createResponse = await request(server)
        .post('/api/vehicles')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Original Name',
          type: 'CAR',
          fuelType: 'GASOLINE',
          averageConsumption: 12.5,
          tankCapacity: 50,
        });

      vehicleId = createResponse.body.id;
    });

    it('should update vehicle successfully', async () => {
      const updateDto = {
        name: 'Updated Name',
        averageConsumption: 11.0,
      };

      const response = await request(server)
        .patch(`/api/vehicles/${vehicleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateDto)
        .expect(200);

      expect(response.body).toMatchObject({
        id: vehicleId,
        name: 'Updated Name',
        averageConsumption: 11.0,
        type: 'CAR', // unchanged
        tankCapacity: 50, // unchanged
      });
    });

    it('should fail when updating non-existent vehicle', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      await request(server)
        .patch(`/api/vehicles/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'New Name' })
        .expect(404);
    });

    it('should fail when updating another user vehicle', async () => {
      const auth2 = await createAuthenticatedUser(server, {
        email: 'user2@example.com',
        password: 'password123',
        name: 'User 2',
      });

      await request(server)
        .patch(`/api/vehicles/${vehicleId}`)
        .set('Authorization', `Bearer ${auth2.token}`)
        .send({ name: 'Hacked Name' })
        .expect(403);
    });
  });

  describe('DELETE /api/vehicles/:id', () => {
    let vehicleId: string;

    beforeEach(async () => {
      const createResponse = await request(server)
        .post('/api/vehicles')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'To Delete',
          type: 'CAR',
          fuelType: 'GASOLINE',
          averageConsumption: 12.5,
          tankCapacity: 50,
        });

      vehicleId = createResponse.body.id;
    });

    it('should delete vehicle successfully', async () => {
      const response = await request(server)
        .delete(`/api/vehicles/${vehicleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message');

      // Verify vehicle is deleted
      await request(server)
        .get(`/api/vehicles/${vehicleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should fail when deleting non-existent vehicle', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      await request(server)
        .delete(`/api/vehicles/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should fail when deleting another user vehicle', async () => {
      const auth2 = await createAuthenticatedUser(server, {
        email: 'user2@example.com',
        password: 'password123',
        name: 'User 2',
      });

      await request(server)
        .delete(`/api/vehicles/${vehicleId}`)
        .set('Authorization', `Bearer ${auth2.token}`)
        .expect(403);
    });
  });
});
