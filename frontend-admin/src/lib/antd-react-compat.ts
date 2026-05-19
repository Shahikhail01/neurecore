'use client';

import { unstableSetRender } from 'antd/es/config-provider/UnstableContext';
import type { ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';

const roots = new WeakMap<Element | DocumentFragment, Root>();

unstableSetRender((node: ReactNode, container: Element | DocumentFragment) => {
  const existingRoot = roots.get(container);
  const root = existingRoot ?? createRoot(container);

  if (!existingRoot) {
    roots.set(container, root);
  }

  root.render(node);

  return async () => {
    await Promise.resolve();
    root.unmount();
    roots.delete(container);
  };
});