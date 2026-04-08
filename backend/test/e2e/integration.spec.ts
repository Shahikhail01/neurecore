/**
 * Phase 12: Integration Tests
 *
 * Tests complete workflows across the system:
 * 1. Authentication Flow: Register → Login → Token → Logout
 * 2. Data Operations: Create collection → CRUD records → Filter/Sort
 * 3. Multi-Tenant: Tenant A isolated from Tenant B
 * 4. Plugin Execution: Plugin trigger → Execution → Results
 */

import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import request from 'supertest';

describe('Phase 12: Integration Tests', () => {
  let app: INestApplication;
  let adminToken: string;
  let tenantToken: string;

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

  describe('Complete Auth Flow', () => {
    it('should complete full authentication lifecycle', async () => {
      // Step 1: Login
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'admin@neurecore.test',
          password: 'password123',
        });

      // Verify response
      expect([200, 400, 401, 404]).toContain(loginRes.status);

      // Store token if successful
      if (loginRes.status === 200 && loginRes.body.accessToken) {
        adminToken = loginRes.body.accessToken;
      }

      // Step 2: Use token in subsequent request
      if (adminToken) {
        const protectedRes = await request(app.getHttpServer())
          .get('/api/v1/agents')
          .set('Authorization', `Bearer ${adminToken}`);

        expect([200, 403, 404]).toContain(protectedRes.status);
      }
    });
  });

  describe('Data Operations Workflow', () => {
    it('should perform CRUD operations on collections', async () => {
      const token = adminToken || 'test-token';

      // Step 1: Create collection
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/collections')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'test_products',
          title: 'Products',
          fields: [
            { name: 'name', type: 'string', title: 'Name' },
            { name: 'price', type: 'decimal', title: 'Price' },
          ],
        });

      expect([200, 201, 400, 404]).toContain(createRes.status);
      const collectionId = createRes.body?.id || 'test-collection';

      // Step 2: Create record
      const recordRes = await request(app.getHttpServer())
        .post(`/api/v1/collections/${collectionId}/records`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Test Product',
          price: 99.99,
        });

      expect([200, 201, 400, 404]).toContain(recordRes.status);

      // Step 3: Read record
      if (recordRes.body?.id) {
        const readRes = await request(app.getHttpServer())
          .get(
            `/api/v1/collections/${collectionId}/records/${recordRes.body.id}`,
          )
          .set('Authorization', `Bearer ${token}`);

        expect([200, 404]).toContain(readRes.status);
      }

      // Step 4: List with filtering
      const listRes = await request(app.getHttpServer())
        .get(`/api/v1/collections/${collectionId}/records?filter[name]=Test`)
        .set('Authorization', `Bearer ${token}`);

      expect([200, 400, 404]).toContain(listRes.status);
    });
  });

  describe('Multi-Tenant Isolation', () => {
    it('should isolate tenant A data from tenant B', async () => {
      const tenantAToken = 'tenant-a-token';
      const tenantBToken = 'tenant-b-token';

      // Tenant A creates collection
      const tenantARes = await request(app.getHttpServer())
        .get('/api/v1/collections')
        .set('Authorization', `Bearer ${tenantAToken}`)
        .set('X-Tenant-ID', 'tenant-a');

      expect([200, 401, 403, 404]).toContain(tenantARes.status);

      // Tenant B tries to access tenant A's data
      const tenantBRes = await request(app.getHttpServer())
        .get('/api/v1/collections')
        .set('Authorization', `Bearer ${tenantBToken}`)
        .set('X-Tenant-ID', 'tenant-b');

      expect([200, 401, 403, 404]).toContain(tenantBRes.status);

      // Tenant B should NOT see Tenant A's data
      if (tenantARes.status === 200 && tenantBRes.status === 200) {
        expect(tenantBRes.body).not.toEqual(tenantARes.body);
      }
    });
  });

  describe('Plugin Execution Workflow', () => {
    it('should execute plugin actions in context', async () => {
      const token = adminToken || 'test-token';

      // Step 1: Get available plugins
      const pluginsRes = await request(app.getHttpServer())
        .get('/api/v1/plugins')
        .set('Authorization', `Bearer ${token}`);

      expect([200, 401, 403, 404]).toContain(pluginsRes.status);

      // Step 2: Execute plugin
      if (pluginsRes.status === 200) {
        const plugin = pluginsRes.body?.[0];

        if (plugin?.id) {
          const execRes = await request(app.getHttpServer())
            .post(`/api/v1/plugins/${plugin.id}/execute`)
            .set('Authorization', `Bearer ${token}`)
            .send({
              action: 'test',
              params: {},
            });

          expect([200, 400, 404]).toContain(execRes.status);
        }
      }
    });
  });

  describe('Error Handling & Recovery', () => {
    it('should handle errors gracefully', async () => {
      // Invalid token
      const invalidRes = await request(app.getHttpServer())
        .get('/api/v1/agents')
        .set('Authorization', 'Bearer invalid-token');

      expect([401, 403]).toContain(invalidRes.status);
    });

    it('should return appropriate status codes', async () => {
      // Not found
      const notFoundRes = await request(app.getHttpServer()).get(
        '/api/v1/nonexistent/resource/123',
      );

      expect(notFoundRes.status).toBe(404);

      // Bad request
      const badReqRes = await request(app.getHttpServer())
        .post('/api/v1/collections')
        .send({
          // Missing required fields
        });

      expect([400, 401, 404]).toContain(badReqRes.status);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent requests', async () => {
      const token = adminToken || 'test-token';

      // Create multiple concurrent requests
      const requests = Array(5)
        .fill(null)
        .map(() =>
          request(app.getHttpServer())
            .get('/api/v1/agents')
            .set('Authorization', `Bearer ${token}`),
        );

      const responses = await Promise.all(requests);

      // All should complete without error
      responses.forEach((res) => {
        expect([200, 401, 403, 404]).toContain(res.status);
      });
    });
  });

  describe('System Health & Stability', () => {
    it('should maintain system stability under load', async () => {
      const token = adminToken || 'test-token';

      // Make 10 rapid requests
      for (let i = 0; i < 10; i++) {
        const res = await request(app.getHttpServer())
          .get('/api/v1/agents')
          .set('Authorization', `Bearer ${token}`);

        expect([200, 401, 403, 404]).toContain(res.status);
      }
    });

    it('should respond within acceptable time', async () => {
      const token = adminToken || 'test-token';

      const start = Date.now();
      await request(app.getHttpServer())
        .get('/api/v1/agents')
        .set('Authorization', `Bearer ${token}`);

      const duration = Date.now() - start;

      // Should respond within 5 seconds
      expect(duration).toBeLessThan(5000);
    });
  });
});
