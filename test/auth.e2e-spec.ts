import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, cleanupDatabase } from './test-utils';

describe('Auth (E2E)', () => {
  let app: INestApplication;
  let server: any;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();
  });

  beforeEach(async () => {
    await cleanupDatabase(app);
  });

  afterAll(async () => {
    await cleanupDatabase(app);
    await app.close();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const registerDto = {
        email: 'newuser@example.com',
        password: 'password123',
        name: 'New User',
      };

      const response = await request(server)
        .post('/api/auth/register')
        .send(registerDto)
        .expect(201);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body.user).toMatchObject({
        email: registerDto.email,
        name: registerDto.name,
      });
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user).not.toHaveProperty('password');
      expect(typeof response.body.accessToken).toBe('string');
      expect(response.body.accessToken.length).toBeGreaterThan(0);
    });

    it('should fail with invalid email format', async () => {
      const response = await request(server)
        .post('/api/auth/register')
        .send({
          email: 'invalid-email',
          password: 'password123',
          name: 'Test User',
        })
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    it('should fail with missing required fields', async () => {
      const response = await request(server)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          // missing password and name
        })
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    it('should fail when email already exists', async () => {
      const registerDto = {
        email: 'duplicate@example.com',
        password: 'password123',
        name: 'First User',
      };

      // First registration
      await request(server)
        .post('/api/auth/register')
        .send(registerDto)
        .expect(201);

      // Second registration with same email
      const response = await request(server)
        .post('/api/auth/register')
        .send(registerDto)
        .expect(409);

      expect(response.body.message).toContain('Email already registered');
    });

    it('should fail with short password', async () => {
      const response = await request(server)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: '123',
          name: 'Test User',
        })
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('POST /api/auth/login', () => {
    const userCredentials = {
      email: 'login@example.com',
      password: 'password123',
      name: 'Login User',
    };

    beforeEach(async () => {
      // Create a user to login with
      await request(server).post('/api/auth/register').send(userCredentials);
    });

    it('should login successfully with valid credentials', async () => {
      const response = await request(server)
        .post('/api/auth/login')
        .send({
          email: userCredentials.email,
          password: userCredentials.password,
        })
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body.user.email).toBe(userCredentials.email);
      expect(response.body.user).not.toHaveProperty('password');
    });

    it('should fail with incorrect password', async () => {
      const response = await request(server)
        .post('/api/auth/login')
        .send({
          email: userCredentials.email,
          password: 'wrongpassword',
        })
        .expect(401);

      expect(response.body.message).toContain('Invalid credentials');
    });

    it('should fail with non-existent email', async () => {
      const response = await request(server)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123',
        })
        .expect(401);

      expect(response.body.message).toContain('Invalid credentials');
    });

    it('should fail with missing credentials', async () => {
      await request(server)
        .post('/api/auth/login')
        .send({
          email: userCredentials.email,
          // missing password
        })
        .expect(400);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user info when authenticated', async () => {
      // Register and get token
      const registerResponse = await request(server)
        .post('/api/auth/register')
        .send({
          email: 'me@example.com',
          password: 'password123',
          name: 'Me User',
        });

      const token = registerResponse.body.accessToken;

      // Get user info
      const response = await request(server)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toMatchObject({
        email: 'me@example.com',
        name: 'Me User',
      });
      expect(response.body).toHaveProperty('id');
      expect(response.body).not.toHaveProperty('password');
    });

    it('should fail without authentication token', async () => {
      const response = await request(server).get('/api/auth/me').expect(401);

      expect(response.body).toHaveProperty('message');
    });

    it('should fail with invalid token', async () => {
      const response = await request(server)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toHaveProperty('message');
    });
  });
});
