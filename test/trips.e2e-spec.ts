import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, cleanupDatabase, createAuthenticatedUser } from './test-utils';

describe('Trips (E2E)', () => {
  let app: INestApplication;
  let server: any;
  let authToken: string;
  let userId: string;
  let vehicleId: string;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();
  });

  beforeEach(async () => {
    await cleanupDatabase(app);
    const auth = await createAuthenticatedUser(server);
    authToken = auth.token;
    userId = auth.userId;

    // Create a test vehicle for trips
    const vehicleResponse = await request(server)
      .post('/api/vehicles')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Test Car',
        type: 'CAR',
        fuelType: 'GASOLINE',
        averageConsumption: 12.5,
        tankCapacity: 50,
      });

    vehicleId = vehicleResponse.body.id;
  });

  afterAll(async () => {
    await cleanupDatabase(app);
    await app.close();
  });

  describe('POST /api/trips', () => {
    it('should create a new trip successfully', async () => {
      const tripDto = {
        name: 'Road Trip',
        origin: 'São Paulo, SP',
        destination: 'Rio de Janeiro, RJ',
        vehicleId: vehicleId,
        status: 'PLANNED',
        travelersCount: 2,
        fuelPrice: 5.50,
      };

      const response = await request(server)
        .post('/api/trips')
        .set('Authorization', `Bearer ${authToken}`)
        .send(tripDto)
        .expect(201);

      expect(response.body).toMatchObject({
        name: tripDto.name,
        origin: tripDto.origin,
        destination: tripDto.destination,
        vehicleId: tripDto.vehicleId,
      });
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('userId');
      expect(response.body.userId).toBe(userId);
    });

    it('should create trip with minimal required fields', async () => {
      const tripDto = {
        name: 'Simple Trip',
        origin: 'City A',
        destination: 'City B',
        vehicleId: vehicleId,
      };

      const response = await request(server)
        .post('/api/trips')
        .set('Authorization', `Bearer ${authToken}`)
        .send(tripDto)
        .expect(201);

      expect(response.body).toMatchObject(tripDto);
      expect(response.body.status).toBe('DRAFT'); // Default status
    });

    it('should fail without authentication', async () => {
      const tripDto = {
        name: 'Road Trip',
        origin: 'São Paulo, SP',
        destination: 'Rio de Janeiro, RJ',
        vehicleId: vehicleId,
      };

      await request(server).post('/api/trips').send(tripDto).expect(401);
    });

    it('should fail with missing required fields', async () => {
      const tripDto = {
        name: 'Road Trip',
        // missing origin, destination, vehicleId
      };

      await request(server)
        .post('/api/trips')
        .set('Authorization', `Bearer ${authToken}`)
        .send(tripDto)
        .expect(400);
    });

    it('should fail with invalid vehicle id', async () => {
      const tripDto = {
        name: 'Road Trip',
        origin: 'City A',
        destination: 'City B',
        vehicleId: '00000000-0000-0000-0000-000000000000',
      };

      await request(server)
        .post('/api/trips')
        .set('Authorization', `Bearer ${authToken}`)
        .send(tripDto)
        .expect(404); // Vehicle not found
    });
  });

  describe('GET /api/trips', () => {
    it('should return all user trips', async () => {
      // Create multiple trips
      const trip1 = {
        name: 'Trip 1',
        origin: 'City A',
        destination: 'City B',
        vehicleId: vehicleId,
      };

      const trip2 = {
        name: 'Trip 2',
        origin: 'City C',
        destination: 'City D',
        vehicleId: vehicleId,
      };

      await request(server)
        .post('/api/trips')
        .set('Authorization', `Bearer ${authToken}`)
        .send(trip1);

      await request(server)
        .post('/api/trips')
        .set('Authorization', `Bearer ${authToken}`)
        .send(trip2);

      const response = await request(server)
        .get('/api/trips')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(2);
    });

    it('should return empty array when user has no trips', async () => {
      const response = await request(server)
        .get('/api/trips')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(0);
    });

    it('should include vehicle data in response', async () => {
      await request(server)
        .post('/api/trips')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Trip with Vehicle',
          origin: 'City A',
          destination: 'City B',
          vehicleId: vehicleId,
        });

      const response = await request(server)
        .get('/api/trips')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body[0]).toHaveProperty('vehicle');
      expect(response.body[0].vehicle).toMatchObject({
        id: vehicleId,
        name: 'Test Car',
      });
    });

    it('should fail without authentication', async () => {
      await request(server).get('/api/trips').expect(401);
    });

    it('should only return trips belonging to the authenticated user', async () => {
      // Create trip for first user
      await request(server)
        .post('/api/trips')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'User 1 Trip',
          origin: 'City A',
          destination: 'City B',
          vehicleId: vehicleId,
        });

      // Create second user
      const auth2 = await createAuthenticatedUser(server, {
        email: 'user2@example.com',
        password: 'password123',
        name: 'User 2',
      });

      // Create vehicle for second user
      const vehicle2Response = await request(server)
        .post('/api/vehicles')
        .set('Authorization', `Bearer ${auth2.token}`)
        .send({
          name: 'User 2 Car',
          type: 'CAR',
          fuelType: 'GASOLINE',
          averageConsumption: 10.0,
          tankCapacity: 45,
        });

      // Create trip for second user
      await request(server)
        .post('/api/trips')
        .set('Authorization', `Bearer ${auth2.token}`)
        .send({
          name: 'User 2 Trip',
          origin: 'City C',
          destination: 'City D',
          vehicleId: vehicle2Response.body.id,
        });

      // First user should only see their trip
      const response = await request(server)
        .get('/api/trips')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].name).toBe('User 1 Trip');
    });
  });

  describe('GET /api/trips/:id', () => {
    let tripId: string;

    beforeEach(async () => {
      const createResponse = await request(server)
        .post('/api/trips')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Trip',
          origin: 'City A',
          destination: 'City B',
          vehicleId: vehicleId,
        });

      tripId = createResponse.body.id;
    });

    it('should return trip by id', async () => {
      const response = await request(server)
        .get(`/api/trips/${tripId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: tripId,
        name: 'Test Trip',
        origin: 'City A',
        destination: 'City B',
      });
      expect(response.body).toHaveProperty('vehicle');
    });

    it('should fail when trip does not exist', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      await request(server)
        .get(`/api/trips/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should fail when accessing another user trip', async () => {
      const auth2 = await createAuthenticatedUser(server, {
        email: 'user2@example.com',
        password: 'password123',
        name: 'User 2',
      });

      await request(server)
        .get(`/api/trips/${tripId}`)
        .set('Authorization', `Bearer ${auth2.token}`)
        .expect(403);
    });

    it('should fail without authentication', async () => {
      await request(server).get(`/api/trips/${tripId}`).expect(401);
    });
  });

  describe('PATCH /api/trips/:id', () => {
    let tripId: string;

    beforeEach(async () => {
      const createResponse = await request(server)
        .post('/api/trips')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Original Trip',
          origin: 'City A',
          destination: 'City B',
          vehicleId: vehicleId,
          status: 'DRAFT',
        });

      tripId = createResponse.body.id;
    });

    it('should update trip successfully', async () => {
      const updateDto = {
        name: 'Updated Trip',
        status: 'PLANNED',
      };

      const response = await request(server)
        .patch(`/api/trips/${tripId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateDto)
        .expect(200);

      expect(response.body).toMatchObject({
        id: tripId,
        name: 'Updated Trip',
        status: 'PLANNED',
        origin: 'City A', // unchanged
      });
    });

    it('should fail when updating non-existent trip', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      await request(server)
        .patch(`/api/trips/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'New Name' })
        .expect(404);
    });

    it('should fail when updating another user trip', async () => {
      const auth2 = await createAuthenticatedUser(server, {
        email: 'user2@example.com',
        password: 'password123',
        name: 'User 2',
      });

      await request(server)
        .patch(`/api/trips/${tripId}`)
        .set('Authorization', `Bearer ${auth2.token}`)
        .send({ name: 'Hacked Name' })
        .expect(403);
    });
  });

  describe('DELETE /api/trips/:id', () => {
    let tripId: string;

    beforeEach(async () => {
      const createResponse = await request(server)
        .post('/api/trips')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'To Delete',
          origin: 'City A',
          destination: 'City B',
          vehicleId: vehicleId,
        });

      tripId = createResponse.body.id;
    });

    it('should delete trip successfully', async () => {
      const response = await request(server)
        .delete(`/api/trips/${tripId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message');

      // Verify trip is deleted
      await request(server)
        .get(`/api/trips/${tripId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should fail when deleting non-existent trip', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      await request(server)
        .delete(`/api/trips/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should fail when deleting another user trip', async () => {
      const auth2 = await createAuthenticatedUser(server, {
        email: 'user2@example.com',
        password: 'password123',
        name: 'User 2',
      });

      await request(server)
        .delete(`/api/trips/${tripId}`)
        .set('Authorization', `Bearer ${auth2.token}`)
        .expect(403);
    });
  });
});
