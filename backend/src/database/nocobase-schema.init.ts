/**
 * NocoDB Schema Initialization Script
 * Creates all collections and configures NocoDB for NeureCore
 * Location: src/database/nocobase-schema.init.ts
 *
 * Run this once during setup:
 * npm run schema:init
 */

import { NocoDB } from 'nocodb/sdk';
import { Logger } from '@nestjs/common';

const logger = new Logger('NocoDB Schema Init');

/**
 * Collection definitions matching NeureCore domain models
 */
const COLLECTIONS_SCHEMA = {
  agents: {
    title: 'Agents',
    description: 'AI Agents in NeureCore',
    fields: [
      {
        column_name: 'id',
        uidt: 'SingleLineText',
        pk: true,
      },
      {
        column_name: 'name',
        uidt: 'SingleLineText',
        required: true,
        is_system: false,
      },
      {
        column_name: 'status',
        uidt: 'SingleSelect',
        options: [
          { title: 'active' },
          { title: 'inactive' },
          { title: 'sleeping' },
        ],
        default: 'active',
      },
      {
        column_name: 'mood',
        uidt: 'Number',
        colOptions: { precision: 3, scale: 0 },
        default: 50,
      },
      {
        column_name: 'version',
        uidt: 'SingleLineText',
      },
      {
        column_name: 'tenantId',
        uidt: 'SingleLineText',
        required: true,
      },
      {
        column_name: 'departmentId',
        uidt: 'SingleLineText',
      },
      {
        column_name: 'createdAt',
        uidt: 'DateTime',
        default_value: 'now()',
        system: false,
      },
      {
        column_name: 'updatedAt',
        uidt: 'DateTime',
        default_value: 'now()',
        system: false,
      },
      {
        column_name: 'createdBy',
        uidt: 'SingleLineText',
      },
    ],
  },

  tasks: {
    title: 'Tasks',
    description: 'Tasks assigned to agents',
    fields: [
      {
        column_name: 'id',
        uidt: 'SingleLineText',
        pk: true,
      },
      {
        column_name: 'title',
        uidt: 'SingleLineText',
        required: true,
      },
      {
        column_name: 'description',
        uidt: 'LongText',
      },
      {
        column_name: 'status',
        uidt: 'SingleSelect',
        options: [
          { title: 'pending' },
          { title: 'in_progress' },
          { title: 'completed' },
          { title: 'failed' },
        ],
        default: 'pending',
      },
      {
        column_name: 'agentId',
        uidt: 'SingleLineText',
        required: true,
      },
      {
        column_name: 'assignedTo',
        uidt: 'SingleLineText',
      },
      {
        column_name: 'deadline',
        uidt: 'DateTime',
      },
      {
        column_name: 'cost',
        uidt: 'Decimal',
        colOptions: { precision: 10, scale: 2 },
        default: 0,
      },
      {
        column_name: 'priority',
        uidt: 'SingleSelect',
        options: [
          { title: 'low' },
          { title: 'medium' },
          { title: 'high' },
          { title: 'critical' },
        ],
      },
      {
        column_name: 'createdAt',
        uidt: 'DateTime',
        default_value: 'now()',
      },
      {
        column_name: 'updatedAt',
        uidt: 'DateTime',
        default_value: 'now()',
      },
    ],
  },

  approvals: {
    title: 'Approvals',
    description: 'Approval workflows',
    fields: [
      {
        column_name: 'id',
        uidt: 'SingleLineText',
        pk: true,
      },
      {
        column_name: 'title',
        uidt: 'SingleLineText',
        required: true,
      },
      {
        column_name: 'description',
        uidt: 'LongText',
      },
      {
        column_name: 'status',
        uidt: 'SingleSelect',
        options: [
          { title: 'pending' },
          { title: 'approved' },
          { title: 'rejected' },
        ],
        default: 'pending',
      },
      {
        column_name: 'requestedBy',
        uidt: 'SingleLineText',
        required: true,
      },
      {
        column_name: 'expiresAt',
        uidt: 'DateTime',
      },
      {
        column_name: 'priority',
        uidt: 'SingleSelect',
        options: [
          { title: 'low' },
          { title: 'medium' },
          { title: 'high' },
          { title: 'urgent' },
        ],
      },
      {
        column_name: 'relatedTaskId',
        uidt: 'SingleLineText',
      },
      {
        column_name: 'createdAt',
        uidt: 'DateTime',
        default_value: 'now()',
      },
      {
        column_name: 'updatedAt',
        uidt: 'DateTime',
        default_value: 'now()',
      },
    ],
  },

  departments: {
    title: 'Departments',
    description: 'Organization departments',
    fields: [
      {
        column_name: 'id',
        uidt: 'SingleLineText',
        pk: true,
      },
      {
        column_name: 'name',
        uidt: 'SingleLineText',
        required: true,
      },
      {
        column_name: 'managerId',
        uidt: 'SingleLineText',
      },
      {
        column_name: 'budget',
        uidt: 'Decimal',
        colOptions: { precision: 12, scale: 2 },
      },
      {
        column_name: 'active',
        uidt: 'Checkbox',
        default: true,
      },
      {
        column_name: 'createdAt',
        uidt: 'DateTime',
        default_value: 'now()',
      },
      {
        column_name: 'updatedAt',
        uidt: 'DateTime',
        default_value: 'now()',
      },
    ],
  },

  cost_tracking: {
    title: 'Cost Tracking',
    description: 'Track costs by agent and type',
    fields: [
      {
        column_name: 'id',
        uidt: 'SingleLineText',
        pk: true,
      },
      {
        column_name: 'agentId',
        uidt: 'SingleLineText',
        required: true,
      },
      {
        column_name: 'amount',
        uidt: 'Decimal',
        colOptions: { precision: 12, scale: 2 },
        required: true,
      },
      {
        column_name: 'type',
        uidt: 'SingleSelect',
        options: [
          { title: 'token_usage' },
          { title: 'api_call' },
          { title: 'storage' },
          { title: 'compute' },
        ],
      },
      {
        column_name: 'period',
        uidt: 'SingleLineText',
      },
      {
        column_name: 'metadata',
        uidt: 'JSON',
      },
      {
        column_name: 'createdAt',
        uidt: 'DateTime',
        default_value: 'now()',
      },
    ],
  },
};

/**
 * Initialize NocoDB collections
 */
export async function initializeNocoCoreSchema(noco: NocoDB): Promise<void> {
  logger.log('Starting NocoDB schema initialization...');

  try {
    const db = noco.db();

    for (const [collectionName, schema] of Object.entries(COLLECTIONS_SCHEMA)) {
      try {
        logger.log(`Creating collection: ${collectionName}`);
        // Create collection with fields
        // Note: Actual implementation depends on NocoDB SDK version
        // This is a template - adjust based on your NocoDB SDK
        await db.collection(collectionName).create({
          ...schema,
        });
        logger.log(`✓ Collection created: ${collectionName}`);
      } catch (error: any) {
        if (error.message?.includes('already exists')) {
          logger.log(`⚠ Collection already exists: ${collectionName}`);
        } else {
          logger.error(`✗ Error creating collection ${collectionName}:`, error);
          throw error;
        }
      }
    }

    logger.log('✓ NocoDB schema initialization completed successfully');
  } catch (error) {
    logger.error('✗ Schema initialization failed:', error);
    throw error;
  }
}

/**
 * Seed sample data for testing
 */
export async function seedSampleData(noco: NocoDB): Promise<void> {
  logger.log('Seeding sample data...');

  try {
    const db = noco.db();

    // Sample tenant ID
    const tenantId = 'tenant-demo-001';

    // Create sample agent
    const agent = await db.collection('agents').repository().create({
      id: 'agent-001',
      name: 'Demo Agent',
      status: 'active',
      mood: 75,
      version: '1.0.0',
      tenantId,
      createdBy: 'system',
    });

    logger.log(`✓ Sample agent created: ${agent.id}`);

    // Create sample task
    const task = await db.collection('tasks').repository().create({
      id: 'task-001',
      title: 'Process Demo Data',
      status: 'pending',
      agentId: agent.id,
      cost: 10.5,
      priority: 'medium',
    });

    logger.log(`✓ Sample task created: ${task.id}`);

    // Create sample approval
    const approval = await db
      .collection('approvals')
      .repository()
      .create({
        id: 'approval-001',
        title: 'Demo Approval Request',
        status: 'pending',
        requestedBy: 'system',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        priority: 'medium',
        relatedTaskId: task.id,
      });

    logger.log(`✓ Sample approval created: ${approval.id}`);

    logger.log('✓ Sample data seeded successfully');
  } catch (error) {
    logger.error('✗ Seeding failed:', error);
    throw error;
  }
}
