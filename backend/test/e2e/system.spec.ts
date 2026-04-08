/**
 * Phase 12: System E2E Tests
 * Target: Validate core system flows through both admin and tenant portals
 * Coverage: Authentication, data operations, plugin execution, UI schema management
 */

import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import request from 'supertest';

describe('System E2E Tests (Phase 12)', () => {
  let app: INestApplication;
  let adminAuthToken: string;
  let tenantAuthToken: string;
  let adminUserId: string;
  let tenantUserId: string;
  let collectionId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Authentication Flow', () => {
    it('should register a new admin user', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'admin@neurecore.test',
          password: 'TestAdmin123!',
          name: 'Admin User',
          tenantId: null, // Admin has no tenant
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('token');
      expect(response.body.user.email).toBe('admin@neurecore.test');

      adminAuthToken = response.body.token;
      adminUserId = response.body.user.id;
    });

    it('should register a new tenant user', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'user@tenant.test',
          password: 'TestUser123!',
          name: 'Tenant User',
          tenantId: 'tenant-001',
        });

      expect(response.status).toBe(201);
      expect(response.body.user.tenantId).toBe('tenant-001');

      tenantAuthToken = response.body.token;
      tenantUserId = response.body.user.id;
    });

    it('should login and receive valid JWT token', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'admin@neurecore.test',
          password: 'TestAdmin123!',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body.token).toMatch(/^Bearer\s/i);
    });

    it('should reject invalid credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'admin@neurecore.test',
          password: 'WrongPassword123!',
        });

      expect(response.status).toBe(401);
    });
  });

  describe('Admin Collection Management', () => {
    it('should create a new collection as admin', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/collections')
        .set('Authorization', `Bearer ${adminAuthToken}`)
        .send({
          name: 'test_products',
          title: 'Products',
          description: 'Test product collection',
          fields: [
            {
              name: 'name',
              type: 'string',
              title: 'Product Name',
              required: true,
            },
            {
              name: 'price',
              type: 'decimal',
              title: 'Price',
              required: true,
            },
            {
              name: 'stock',
              type: 'integer',
              title: 'Stock Quantity',
              default: 0,
            },
          ],
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('test_products');

      collectionId = response.body.id;
    });

    it('should list collections with pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/collections?skip=0&take=20')
        .set('Authorization', `Bearer ${adminAuthToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body).toHaveProperty('total');
    });

    it('should fetch collection schema', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/collections/${collectionId}`)
        .set('Authorization', `Bearer ${adminAuthToken}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(collectionId);
      expect(Array.isArray(response.body.fields)).toBe(true);
    });
  });

  describe('Data CRUD Operations', () => {
    let recordId: string;

    it('should create a new record', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/collections/${collectionId}/records`)
        .set('Authorization', `Bearer ${adminAuthToken}`)
        .send({
          name: 'Widget Pro',
          price: 99.99,
          stock: 150,
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('Widget Pro');

      recordId = response.body.id;
    });

    it('should read a record by ID', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/collections/${collectionId}/records/${recordId}`)
        .set('Authorization', `Bearer ${adminAuthToken}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(recordId);
    });

    it('should update a record', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/collections/${collectionId}/records/${recordId}`)
        .set('Authorization', `Bearer ${adminAuthToken}`)
        .send({
          price: 89.99,
          stock: 140,
        });

      expect(response.status).toBe(200);
      expect(response.body.price).toBe(89.99);
    });

    it('should query records with filters', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/collections/${collectionId}/records`)
        .query({
          filter: JSON.stringify({
            $and: [{ stock: { $gte: 100 } }],
          }),
        })
        .set('Authorization', `Bearer ${adminAuthToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should delete a record', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/api/collections/${collectionId}/records/${recordId}`)
        .set('Authorization', `Bearer ${adminAuthToken}`);

      expect(response.status).toBe(204);
    });
  });

  describe('Tenant Data Isolation', () => {
    it("should prevent tenant from accessing other tenant's collections", async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/collections/${collectionId}`)
        .set('Authorization', `Bearer ${tenantAuthToken}`);

      // Tenant should not see admin-created collections
      expect([403, 404]).toContain(response.status);
    });

    it('tenant should only see collections shared with their tenant', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/collections')
        .set('Authorization', `Bearer ${tenantAuthToken}`);

      expect(response.status).toBe(200);
      // All returned collections should be accessible to this tenant
      const collections = response.body.data || [];
      collections.forEach((col: any) => {
        expect(col.tenantId).toBe('tenant-001');
      });
    });
  });

  describe('UI Schema Management', () => {
    let schemaId: string;

    it('should create a UI view/block schema', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/collections/${collectionId}/ui-schemas`)
        .set('Authorization', `Bearer ${adminAuthToken}`)
        .send({
          name: 'products_grid_view',
          type: 'Grid',
          config: {
            columns: ['name', 'price', 'stock'],
            sortBy: 'name',
            pageSize: 50,
          },
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');

      schemaId = response.body.id;
    });

    it('should fetch UI schema', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/collections/${collectionId}/ui-schemas/${schemaId}`)
        .set('Authorization', `Bearer ${adminAuthToken}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(schemaId);
    });

    it('should update UI schema configuration', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/collections/${collectionId}/ui-schemas/${schemaId}`)
        .set('Authorization', `Bearer ${adminAuthToken}`)
        .send({
          config: {
            pageSize: 100,
            sortBy: 'price',
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.config.pageSize).toBe(100);
    });
  });

  describe('Plugin System', () => {
    it('should list available plugins', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/plugins')
        .set('Authorization', `Bearer ${adminAuthToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should fetch plugin metadata', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/plugins?type=field')
        .set('Authorization', `Bearer ${adminAuthToken}`);

      expect(response.status).toBe(200);
      const plugins = response.body;
      expect(plugins.length).toBeGreaterThan(0);
    });

    it('should not expose admin-only plugins to tenant', async () => {
      const adminPlugins = await request(app.getHttpServer())
        .get('/api/plugins?scope=admin')
        .set('Authorization', `Bearer ${adminAuthToken}`);

      const tenantPlugins = await request(app.getHttpServer())
        .get('/api/plugins?scope=admin')
        .set('Authorization', `Bearer ${tenantAuthToken}`);

      expect(adminPlugins.status).toBe(200);
      expect(tenantPlugins.status).toBe(403);
    });
  });

  describe('Error Handling', () => {
    it('should return 401 without authentication', async () => {
      const response = await request(app.getHttpServer()).get(
        '/api/collections',
      );

      expect(response.status).toBe(401);
    });

    it('should return 400 for invalid request body', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/collections/${collectionId}/records`)
        .set('Authorization', `Bearer ${adminAuthToken}`)
        .send({
          name: 123, // Should be string
          price: 'invalid', // Should be number
        });

      expect(response.status).toBe(400);
    });

    it('should return 404 for non-existent collection', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/collections/non-existent-id')
        .set('Authorization', `Bearer ${adminAuthToken}`);

      expect(response.status).toBe(404);
    });

    it('should return 409 for duplicate collection name', async () => {
      await request(app.getHttpServer())
        .post('/api/collections')
        .set('Authorization', `Bearer ${adminAuthToken}`)
        .send({
          name: 'duplicate_test',
          title: 'Duplicate Test',
          fields: [],
        });

      const response = await request(app.getHttpServer())
        .post('/api/collections')
        .set('Authorization', `Bearer ${adminAuthToken}`)
        .send({
          name: 'duplicate_test',
          title: 'Duplicate Test Again',
          fields: [],
        });

      expect(response.status).toBe(409);
    });
  });
});
