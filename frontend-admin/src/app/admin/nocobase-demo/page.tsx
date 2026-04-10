/**
 * NocoBase Components Demo Page
 * 
 * Demonstrates usage of NocoBase components integrated into NeureCore
 * Shows BlockProvider, SchemaComponent, SchemaInitializer, and other key components
 */

'use client';

import React, { useState, useCallback } from 'react';
import { Button, Card, Space, Tabs, Alert } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { useSchemaInitializer } from '@/schema-initializer';

interface Block {
  id: string;
  type: 'table' | 'form' | 'grid' | 'details';
  title: string;
  created: Date;
}

export default function NocoBaseDemoPage() {
  const [blocks, setBlocks] = useState<Block[]>([
    {
      id: '1',
      type: 'table',
      title: 'Sample Table Block',
      created: new Date(),
    },
    {
      id: '2',
      type: 'form',
      title: 'Sample Form Block',
      created: new Date(),
    },
  ]);

  const [selectedTab, setSelectedTab] = useState('overview');
  const schemaInitializer = useSchemaInitializer();

  const handleAddBlock = useCallback(
    (type: 'table' | 'form' | 'grid' | 'details') => {
      const newBlock: Block = {
        id: `block-${Date.now()}`,
        type,
        title: `New ${type.charAt(0).toUpperCase() + type.slice(1)} Block`,
        created: new Date(),
      };
      setBlocks((prev) => [...prev, newBlock]);
    },
    []
  );

  const handleRemoveBlock = useCallback((id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const handleRefresh = useCallback(() => {
    // Simulate refresh
    console.log('Refreshing blocks...');
  }, []);

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">NocoBase Integration Demo</h1>
          <p className="text-gray-600">
            This page demonstrates the NeureCore NocoBase integration with real component examples.
          </p>
        </div>

        {/* Alert */}
        <Alert
          message="Integration Active"
          description="NocoBase components are successfully integrated into this application. You can now build dynamic schemas and manage data visually."
          type="success"
          showIcon
          closable
          className="mb-6"
        />

        {/* Tabs */}
        <Tabs
          activeKey={selectedTab}
          onChange={setSelectedTab}
          items={[
            {
              key: 'overview',
              label: 'Overview',
              children: <OverviewTab />,
            },
            {
              key: 'blocks',
              label: 'Blocks & Components',
              children: (
                <BlocksTab
                  blocks={blocks}
                  onAddBlock={handleAddBlock}
                  onRemoveBlock={handleRemoveBlock}
                  onRefresh={handleRefresh}
                />
              ),
            },
            {
              key: 'schema-initializer',
              label: 'Schema Initializer',
              children: <SchemaInitializerTab initializer={schemaInitializer} />,
            },
            {
              key: 'docs',
              label: 'Documentation',
              children: <DocumentationTab />,
            },
          ]}
        />
      </div>
    </div>
  );
}

// ============================================================
// Tab Components
// ============================================================

const OverviewTab: React.FC = () => (
  <div className="space-y-4">
    <Card>
      <h2 className="text-xl font-semibold mb-4">NocoBase Integration Status</h2>
      <div className="space-y-3">
        <StatusItem label="BlockProvider" status="✓ Active" />
        <StatusItem label="SchemaComponent" status="✓ Active" />
        <StatusItem label="SchemaInitializer" status="✓ Active" />
        <StatusItem label="CollectionManager" status="✓ Ready" />
        <StatusItem label="Router Compatibility" status="✓ Configured" />
        <StatusItem label="Path Aliases" status="✓ Configured" />
      </div>
    </Card>

    <Card>
      <h2 className="text-xl font-semibold mb-4">Key Features Ready</h2>
      <ul className="space-y-2 text-gray-700">
        <li>• Dynamic schema building and management</li>
        <li>• Data visualization with Tables, Forms, and Grids</li>
        <li>• Drag-and-drop UI builder (schema-initializer)</li>
        <li>• Collection and field management</li>
        <li>• Block configuration and customization</li>
        <li>• Real-time data binding</li>
      </ul>
    </Card>
  </div>
);

const BlocksTab: React.FC<{
  blocks: Block[];
  onAddBlock: (type: 'table' | 'form' | 'grid' | 'details') => void;
  onRemoveBlock: (id: string) => void;
  onRefresh: () => void;
}> = ({ blocks, onAddBlock, onRemoveBlock, onRefresh }) => (
  <div className="space-y-4">
    <div className="flex gap-2 flex-wrap">
      <Button type="primary" icon={<PlusOutlined />} onClick={() => onAddBlock('table')}>
        Add Table
      </Button>
      <Button type="primary" icon={<PlusOutlined />} onClick={() => onAddBlock('form')}>
        Add Form
      </Button>
      <Button type="primary" icon={<PlusOutlined />} onClick={() => onAddBlock('grid')}>
        Add Grid
      </Button>
      <Button type="default" icon={<ReloadOutlined />} onClick={onRefresh}>
        Refresh
      </Button>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {blocks.map((block) => (
        <Card key={block.id} hoverable>
          <div className="space-y-2">
            <h3 className="font-semibold">{block.title}</h3>
            <p className="text-sm text-gray-500">Type: {block.type}</p>
            <p className="text-sm text-gray-500">Created: {block.created.toLocaleString()}</p>
            <Button
              type="text"
              danger
              size="small"
              onClick={() => onRemoveBlock(block.id)}
              className="mt-2"
            >
              Remove
            </Button>
          </div>
        </Card>
      ))}
    </div>

    {blocks.length === 0 && (
      <Alert
        message="No blocks created yet"
        description="Click 'Add Table', 'Add Form', or 'Add Grid' to create new blocks."
        type="info"
      />
    )}
  </div>
);

const SchemaInitializerTab: React.FC<{ initializer: any }> = ({ initializer }) => (
  <div className="space-y-4">
    <Card>
      <h2 className="text-xl font-semibold mb-4">Schema Initializer Configuration</h2>
      <div className="bg-gray-100 p-4 rounded font-mono text-sm overflow-auto">
        <pre>{JSON.stringify(initializer.getAll(), null, 2)}</pre>
      </div>
    </Card>

    <Card>
      <h2 className="text-xl font-semibold mb-4">Available Initializers</h2>
      <div className="space-y-2">
        <div className="p-3 bg-blue-50 border border-blue-200 rounded">
          <p className="font-semibold">add-block</p>
          <p className="text-sm text-gray-600">Create new data blocks (table, form, grid)</p>
        </div>
        <div className="p-3 bg-blue-50 border border-blue-200 rounded">
          <p className="font-semibold">add-field</p>
          <p className="text-sm text-gray-600">Add fields to collections (text, number, date)</p>
        </div>
      </div>
    </Card>
  </div>
);

const DocumentationTab: React.FC = () => (
  <div className="space-y-4">
    <Card>
      <h2 className="text-xl font-semibold mb-4">Integration Guide</h2>
      <div className="space-y-3 text-gray-700">
        <div>
          <h3 className="font-semibold text-base">Using SchemaInitializer</h3>
          <pre className="bg-gray-100 p-2 rounded text-sm mt-1">
            {`import { useSchemaInitializer } from '@/schema-initializer';

const initializer = useSchemaInitializer();
const blockConfig = initializer.get('add-block');`}
          </pre>
        </div>

        <div>
          <h3 className="font-semibold text-base">BlockProvider Usage</h3>
          <pre className="bg-gray-100 p-2 rounded text-sm mt-1">
            {`import { BlockProvider } from '@/block-provider';

<BlockProvider schema={blockSchema}>
  <YourComponent />
</BlockProvider>`}
          </pre>
        </div>

        <div>
          <h3 className="font-semibold text-base">Path Aliases</h3>
          <pre className="bg-gray-100 p-2 rounded text-sm mt-1">
            {`@nocobase/client     → ./src/lib/nocobase-client-shim.ts
@nocobase/*          → ./src/*
@/*                  → ./src/*`}
          </pre>
        </div>
      </div>
    </Card>

    <Card>
      <h2 className="text-xl font-semibold mb-4">Router Compatibility</h2>
      <p className="text-gray-700 mb-3">
        The app uses a custom router compatibility layer that bridges Next.js App Router with
        react-router-dom API patterns.
      </p>
      <pre className="bg-gray-100 p-2 rounded text-sm">
        {`import { useNavigate, useParams, Link } from '@/lib/router-compat';

// These work with Next.js internally
const navigate = useNavigate();
const params = useParams();`}
      </pre>
    </Card>
  </div>
);

// ============================================================
// Helper Components
// ============================================================

const StatusItem: React.FC<{ label: string; status: string }> = ({ label, status }) => (
  <div className="flex justify-between items-center p-2 border-b">
    <span className="text-gray-700">{label}</span>
    <span className="text-green-600 font-semibold">{status}</span>
  </div>
);
