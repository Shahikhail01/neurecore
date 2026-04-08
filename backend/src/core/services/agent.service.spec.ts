/**
 * Unit tests for AgentService
 * SOLID: Liskov Substitution - Tests work with mocks
 * Location: src/core/services/agent.service.spec.ts
 */

import { Test, TestingModule } from '@nestjs/testing';
import { AgentService } from './agent.service';
import {
  MockAgentRepository,
  MockEventBus,
  MockLogger,
} from '../../testing/mocks';
import { IAgentRepository, IEventBus, ILogger } from '../domain/interfaces';
import { AgentStatus } from '../domain/models';

describe('AgentService', () => {
  let service: AgentService;
  let agentRepository: IAgentRepository;
  let eventBus: IEventBus;
  let logger: ILogger;

  beforeEach(async () => {
    agentRepository = new MockAgentRepository();
    eventBus = new MockEventBus();
    logger = new MockLogger();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentService,
        {
          provide: IAgentRepository,
          useValue: agentRepository,
        },
        {
          provide: IEventBus,
          useValue: eventBus,
        },
        {
          provide: ILogger,
          useValue: logger,
        },
      ],
    }).compile();

    service = module.get<AgentService>(AgentService);
  });

  describe('createAgent', () => {
    it('should create an agent', async () => {
      const result = await service.createAgent({
        name: 'Test Agent',
        version: '1.0.0',
        tenantId: 'tenant-1',
        createdBy: 'user-1',
      });

      expect(result.id).toBeDefined();
      expect(result.name).toBe('Test Agent');
      expect(result.status).toBe(AgentStatus.ACTIVE);
    });

    it('should emit event when agent is created', async () => {
      const mockEventBus = eventBus as any;
      mockEventBus.emittedEvents = [];

      await service.createAgent({
        name: 'Test Agent',
        version: '1.0.0',
        tenantId: 'tenant-1',
        createdBy: 'user-1',
      });

      expect(mockEventBus.emittedEvents).toHaveLength(1);
      expect(mockEventBus.emittedEvents[0].event).toBe('agent.created');
    });
  });

  describe('updateAgentStatus', () => {
    it('should update agent status', async () => {
      const agent = await service.createAgent({
        name: 'Test',
        version: '1.0.0',
        tenantId: 'tenant-1',
        createdBy: 'user-1',
      });

      const updated = await service.updateAgentStatus(
        agent.id,
        AgentStatus.INACTIVE,
      );

      expect(updated.status).toBe(AgentStatus.INACTIVE);
    });
  });

  describe('updateAgentMood', () => {
    it('should update agent mood', async () => {
      const agent = await service.createAgent({
        name: 'Test',
        version: '1.0.0',
        tenantId: 'tenant-1',
        createdBy: 'user-1',
      });

      const updated = await service.updateAgentMood(agent.id, 85);

      expect(updated.mood).toBe(85);
    });

    it('should reject mood outside 0-100 range', async () => {
      const agent = await service.createAgent({
        name: 'Test',
        version: '1.0.0',
        tenantId: 'tenant-1',
        createdBy: 'user-1',
      });

      await expect(service.updateAgentMood(agent.id, 150)).rejects.toThrow(
        'Mood must be between 0 and 100',
      );
    });
  });

  describe('getAgentById', () => {
    it('should return agent by id', async () => {
      const created = await service.createAgent({
        name: 'Test',
        version: '1.0.0',
        tenantId: 'tenant-1',
        createdBy: 'user-1',
      });

      const found = await service.getAgentById(created.id);

      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
    });

    it('should return null if agent not found', async () => {
      const found = await service.getAgentById('nonexistent-id');

      expect(found).toBeNull();
    });
  });

  describe('deleteAgent', () => {
    it('should delete agent', async () => {
      const agent = await service.createAgent({
        name: 'Test',
        version: '1.0.0',
        tenantId: 'tenant-1',
        createdBy: 'user-1',
      });

      await service.deleteAgent(agent.id);

      const found = await service.getAgentById(agent.id);
      expect(found).toBeNull();
    });

    it('should emit event when agent is deleted', async () => {
      const agent = await service.createAgent({
        name: 'Test',
        version: '1.0.0',
        tenantId: 'tenant-1',
        createdBy: 'user-1',
      });

      const mockEventBus = eventBus as any;
      mockEventBus.emittedEvents = [];

      await service.deleteAgent(agent.id);

      expect(mockEventBus.emittedEvents).toHaveLength(1);
      expect(mockEventBus.emittedEvents[0].event).toBe('agent.deleted');
    });
  });
});
