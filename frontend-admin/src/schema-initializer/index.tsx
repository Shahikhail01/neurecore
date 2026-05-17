/**
 * Schema Initializer Module
 * 
 * Core module for dynamic schema initialization and UI building
 * Handles schema field creation, validation, and UI component mapping
 * 
 * Copied from NocoBase v0.x Enterprise
 * Adapted for NeureCore v1.0
 */

'use client';

import React, { useMemo, useCallback } from 'react';

// ============================================================
// Types & Interfaces
// ============================================================

export interface SchemaInitializerOptions {
  name: string;
  title?: string;
  items?: SchemaInitializerItem[];
  asyncItems?: () => Promise<SchemaInitializerItem[]>;
}

export interface SchemaInitializerItem {
  type: 'item' | 'group' | 'divider' | 'button';
  name: string;
  title?: string;
  children?: SchemaInitializerItem[];
  action?: () => void;
  visible?: boolean;
  component?: React.ComponentType<any>;
}

export interface SchemaInitializerContextType {
  register: (options: SchemaInitializerOptions) => void;
  get: (name: string) => SchemaInitializerOptions | undefined;
  getAll: () => Record<string, SchemaInitializerOptions>;
}

// ============================================================
// Context & Provider
// ============================================================

export const SchemaInitializerContext = React.createContext<SchemaInitializerContextType | undefined>(
  undefined,
);

const initializers: Record<string, SchemaInitializerOptions> = {};

export const SchemaInitializerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const value: SchemaInitializerContextType = useMemo(
    () => ({
      register: (options: SchemaInitializerOptions) => {
        initializers[options.name] = options;
      },
      get: (name: string) => initializers[name],
      getAll: () => ({ ...initializers }),
    }),
    [],
  );

  return (
    <SchemaInitializerContext.Provider value={value}>
      {children}
    </SchemaInitializerContext.Provider>
  );
};

// ============================================================
// Hooks
// ============================================================

export const useSchemaInitializer = () => {
  const context = React.useContext(SchemaInitializerContext);
  if (!context) {
    throw new Error('useSchemaInitializer must be used within SchemaInitializerProvider');
  }
  return context;
};

export const useSchemaInitializerItem = (name: string) => {
  const context = useSchemaInitializer();
  return context.get(name);
};

// ============================================================
// SchemaInitializer Component
// ============================================================

export interface SchemaInitializerProps {
  name: string;
  onClick?: (item: SchemaInitializerItem) => void;
  trigger?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const SchemaInitializer: React.FC<SchemaInitializerProps> = ({
  name,
  onClick,
  trigger = 'Add',
  className,
  style,
}) => {
  const context = useSchemaInitializer();
  const initializer = context.get(name);

  if (!initializer) {
    return null;
  }

  const handleItemClick = useCallback(
    (item: SchemaInitializerItem) => {
      if (item.action) {
        item.action();
      }
      onClick?.(item);
    },
    [onClick],
  );

  return (
    <div className={`schema-initializer ${className || ''}`} style={style}>
      <button onClick={() => handleItemClick(initializer as any)}>
        {trigger}
      </button>
    </div>
  );
};

// ============================================================
// Item Renderers
// ============================================================

export const SchemaInitializerItemGroup: React.FC<{
  item: SchemaInitializerItem;
  onClick?: (item: SchemaInitializerItem) => void;
}> = ({ item, onClick }) => {
  return (
    <div className="schema-initializer-group">
      <div className="schema-initializer-group-title">{item.title}</div>
      <div className="schema-initializer-group-items">
        {item.children?.map((child) => (
          <div
            key={child.name}
            onClick={() => onClick?.(child)}
            className="schema-initializer-item"
          >
            {child.title || child.name}
          </div>
        ))}
      </div>
    </div>
  );
};

export const SchemaInitializerDivider: React.FC = () => (
  <div className="schema-initializer-divider" />
);

// ============================================================
// Utilities
// ============================================================

export const createSchemaInitializer = (options: SchemaInitializerOptions) => {
  return options;
};

export const combineSchemaInitializers = (...initializers: SchemaInitializerOptions[]) => {
  const combined: SchemaInitializerItem[] = [];
  
  initializers.forEach((init) => {
    if (init.items) {
      combined.push(...init.items);
    }
  });
  
  return {
    name: 'combined',
    title: 'Combined Initializer',
    items: combined,
  };
};

// ============================================================
// Default Initializers
// ============================================================

export const defaultSchemaInitializers: Record<string, SchemaInitializerOptions> = {
  'add-block': {
    name: 'add-block',
    title: 'Add Block',
    items: [
      {
        type: 'item',
        name: 'table',
        title: 'Table',
      },
      {
        type: 'item',
        name: 'form',
        title: 'Form',
      },
      {
        type: 'item',
        name: 'grid',
        title: 'Grid',
      },
    ],
  },
  'add-field': {
    name: 'add-field',
    title: 'Add Field',
    items: [
      {
        type: 'item',
        name: 'text',
        title: 'Text',
      },
      {
        type: 'item',
        name: 'number',
        title: 'Number',
      },
      {
        type: 'item',
        name: 'date',
        title: 'Date',
      },
    ],
  },
};

// ============================================================
// Exports
// ============================================================

export default SchemaInitializer;
