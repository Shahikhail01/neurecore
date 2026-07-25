'use client';

// GlassPanel — back-compat shim. The canonical implementation now lives in
// @neurecore/ui-visual. This file exists only so existing call-sites that
// import `@/components/home/GlassPanel` continue to compile and render the
// exact same component. New code should import from `@neurecore/ui-visual`.

export { GlassPanel } from '@neurecore/ui-visual';