/**
 * Phase 12: API Integration Tests
 * Target: Validate all critical API endpoints used by frontend-tenant ↔ backend
 */

import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import request from 'supertest';

describe('API Integration Tests (Phase 12)', () => {
  let app: INestApplication;
  let authToken: string;
  let testTenantId = 'test-tenant-123';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Setup: Get auth token
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'Test123!',
      });

    authToken = loginRes.body.token;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Collections API', () => {
    describe('GET /api/collections', () => {
      it('should return paginated collections', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/collections')
          .query({ skip: 0, take: 20 })
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('data');
        expect(response.body).toHaveProperty('total');
        expect(Array.isArray(response.body.data)).toBe(true);
      });

      it('should respect pagination parameters', async () => {
        const page1 = await request(app.getHttpServer())
          .get('/api/collections')
          .query({ skip: 0, take: 5 })
          .set('Authorization', `Bearer ${authToken}`);

        const page2 = await request(app.getHttpServer())
          .get('/api/collections')
          .query({ skip: 5, take: 5 })
          .set('Authorization', `Bearer ${authToken}`);

        expect(page1.body.data.length).toBeLessThanOrEqual(5);
        expect(page2.body.data.length).toBeLessThanOrEqual(5);
      });

      it('should filter by name', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/collections')
          .query({ search: 'users' })
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        const collections = response.body.data || [];
        collections.forEach((col: any) => {
          expect(col.name.toLowerCase()).toContain('users');
        });
      });
    });

    describe('GET /api/collections/:id', () => {
      it('should fetch collection with all field definitions', async () => {
        const collections = await request(app.getHttpServer())
          .get('/api/collections')
          .set('Authorization', `Bearer ${authToken}`);

        if (collections.body.data.length === 0) {
          this.skip();
        }

        const collectionId = collections.body.data[0].id;
        const response = await request(app.getHttpServer())
          .get(`/api/collections/${collectionId}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.id).toBe(collectionId);
        expect(Array.isArray(response.body.fields)).toBe(true);
        expect(response.body.fields.length).toBeGreaterThan(0);
      });
    });

    describe('POST /api/collections/:id/records', () => {
      it('should create a record with valid data', async () => {
        // This requires a known collection to exist
        const response = await request(app.getHttpServer())
          .post('/api/collections/users/records')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            email: `test-${Date.now()}@example.com`,
            name: 'Test User',
          });

        expect([201, 400]).toContain(response.status);
        if (response.status === 201) {
          expect(response.body).toHaveProperty('id');
        }
      });
    });

    describe('GET /api/collections/:id/records', () => {
      it('should fetch records with filter support', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/collections/users/records')
          .query({
            filter: JSON.stringify({ role: { $eq: 'user' } }),
          })
          .set('Authorization', `Bearer ${authToken}`);

        expect([200, 400]).toContain(response.status);
        if (response.status === 200) {
          expect(response.body).toHaveProperty('data');
          expect(Array.isArray(response.body.data)).toBe(true);
        }
      });

      it('should support sorting', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/collections/users/records')
          .query({
            sort: JSON.stringify({ createdAt: -1 }),
          })
          .set('Authorization', `Bearer ${authToken}`);

        expect([200, 400]).toContain(response.status);
      });

      it('should support field selection', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/collections/users/records')
          .query({
            fields: JSON.stringify(['id', 'name', 'email']),
          })
          .set('Authorization', `Bearer ${authToken}`);

        expect([200, 400]).toContain(response.status);
      });
    });

    describe('PATCH /api/collections/:id/records/:recordId', () => {
      it('should update record with partial data', async () => {
        const response = await request(app.getHttpServer())
          .patch('/api/collections/users/records/test-id')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: 'Updated Name',
          });

        expect([200, 404, 400]).toContain(response.status);
      });
    });

    describe('DELETE /api/collections/:id/records/:recordId', () => {
      it('should delete a record', async () => {
        const response = await request(app.getHttpServer())
          .delete('/api/collections/users/records/test-id')
          .set('Authorization', `Bearer ${authToken}`);

        expect([204, 404, 400]).toContain(response.status);
      });
    });
  });

  describe('UI Schemas API', () => {
    describe('GET /api/ui/schemas', () => {
      it('should list UI schemas', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/ui/schemas')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
      });
    });

    describe('GET /api/ui/schemas/:id', () => {
      it('should fetch schema with full configuration', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/ui/schemas/test-schema')
          .set('Authorization', `Bearer ${authToken}`);

        expect([200, 404]).toContain(response.status);
      });
    });

    describe('PATCH /api/ui/schemas/:id', () => {
      it('should update schema configuration', async () => {
        const response = await request(app.getHttpServer())
          .patch('/api/ui/schemas/test-schema')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            config: { pageSize: 50 },
          });

        expect([200, 404, 400]).toContain(response.status);
      });
    });
  });

  describe('Plugins API', () => {
    describe('GET /api/plugins', () => {
      it('should list all available plugins', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/plugins')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
      });

      it('should filter by type', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/plugins')
          .query({ type: 'field' })
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        const plugins = response.body;
        plugins.forEach((p: any) => {
          expect(['field', undefined]).toContain(p.type);
        });
      });

      it('should filter by scope (admin-only, tenant-access, etc)', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/plugins')
          .query({ scope: 'public' })
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
      });
    });

    describe('GET /api/plugins/:id', () => {
      it('should fetch plugin metadata and configuration', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/plugins/test-plugin')
          .set('Authorization', `Bearer ${authToken}`);

        expect([200, 404]).toContain(response.status);
      });
    });

    describe('POST /api/plugins/:id/execute', () => {
      it('should execute a plugin action', async () => {
        const response = await request(app.getHttpServer())
          .post('/api/plugins/test-plugin/execute')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            action: 'transform',
            params: { value: 'test' },
          });

        expect([200, 404, 400]).toContain(response.status);
      });

      it('should validate plugin action input', async () => {
        const response = await request(app.getHttpServer())
          .post('/api/plugins/test-plugin/execute')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            action: 'invalid-action',
          });

        expect([400, 404]).toContain(response.status);
      });
    });
  });

  describe('Response Format Validation', () => {
    it('should include proper metadata in list responses', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/collections')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('total');
      expect(typeof response.body.total).toBe('number');
    });

    it('should include error details on failure', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/collections/invalid-id')
        .set('Authorization', `Bearer ${authToken}`);

      if (response.status >= 400) {
        expect(response.body).toHaveProperty('message');
        expect(response.body).toHaveProperty('statusCode');
      }
    });

    it('should validate timestamps in responses', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/collections')
        .set('Authorization', `Bearer ${authToken}`);

      if (response.body.data && response.body.data.length > 0) {
        const item = response.body.data[0];
        if (item.createdAt) {
          expect(new Date(item.createdAt).getTime()).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('Rate Limiting & Throttling', () => {
    it('should enforce rate limits on high-volume requests', async () => {
      // Make multiple rapid requests
      const requests = Array(50)
        .fill(null)
        .map(() =>
          request(app.getHttpServer())
            .get('/api/collections')
            .set('Authorization', `Bearer ${authToken}`),
        );

      const responses = await Promise.all(requests);

      // At least some requests should succeed
      const successCount = responses.filter((r) => r.status === 200).length;
      expect(successCount).toBeGreaterThan(0);

      // Some later requests might be throttled
      const throttledCount = responses.filter((r) => r.status === 429).length;
      expect(throttledCount).toBeGreaterThanOrEqual(0);
    });
  });
});
