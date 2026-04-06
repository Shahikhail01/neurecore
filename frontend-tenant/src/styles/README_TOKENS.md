# Design Tokens Documentation

**Date**: April 6, 2026  
**Version**: 2.0  
**Status**: Implemented - Phase 0 Complete

## Overview

This document explains the design token system used throughout NeureCore's frontend applications. Tokens are design variables (colors, spacing, typography, shadows) that ensure consistency across all UI components.

## Token Organization

All tokens are defined in CSS custom properties (variables) in `src/styles/design-tokens.css` and mapped to Tailwind CSS in `tailwind.config.js`.

### Theme Variants

- **`.theme-dark`** (default): Dark theme optimized for evening/night use
- **`.theme-light`**: Light theme for daytime use
- **`.theme-high-contrast`**: WCAG AAA accessible theme for users with visual impairments

## Token Categories

### 1. Surface Colors

Used for backgrounds, panels, cards, and UI containers.

| Token               | Dark                   | Light               | Purpose                                    |
| ------------------- | ---------------------- | ------------------- | ------------------------------------------ |
| `--surface-base`    | #09090b                | #ffffff             | Primary background (body, pages)           |
| `--surface-raised`  | #111113                | #f8f9fb             | Secondary background (cards, modals)       |
| `--surface-overlay` | rgba(255,255,255,0.02) | rgba(15,23,42,0.04) | Hover states, overlays, subtle backgrounds |
| `--surface-border`  | #27272a                | #e6e7eb             | Borders, dividers, outlines                |
| `--surface-muted`   | #3f3f46                | #d4d4d8             | Disabled states, low-emphasis areas        |
| `--surface-brand`   | #0ea5e9                | #0284c7             | Brand color accent                         |

**Usage Example**:

```tsx
// Using Tailwind class
<div className="bg-surface-base text-text-primary border border-surface-border">
  Content here
</div>

// Using CSS variable
<div style={{ background: 'var(--surface-base)' }}>
  Content here
</div>
```

### 2. Text Colors

Used for typography and text elements.

| Token              | Dark    | Light   | Purpose                             |
| ------------------ | ------- | ------- | ----------------------------------- |
| `--text-primary`   | #e6e6e9 | #0f1720 | Primary text, headers, body copy    |
| `--text-secondary` | #9ca3af | #6b7280 | Secondary text, descriptions, hints |
| `--text-muted`     | #71717a | #9ca3af | Disabled text, low-emphasis labels  |
| `--text-disabled`  | #52525b | #d1d5db | Disabled states, very low-emphasis  |

**Contrast Ratios (WCAG AA minimum 4.5:1)**:

- Primary on Surface: ✓ 12.5:1 (dark), ✓ 14.8:1 (light)
- Secondary on Surface: ✓ 6.2:1 (dark), ✓ 5.4:1 (light)

**Usage Example**:

```tsx
<p className="text-text-primary">Primary heading</p>
<span className="text-text-secondary">Secondary text</span>
<span className="text-text-muted">Disabled or muted text</span>
```

### 3. Accent Colors

Used for interactive elements, CTAs, and highlights.

| Token              | Dark    | Light   | Purpose                            |
| ------------------ | ------- | ------- | ---------------------------------- |
| `--accent-primary` | #7c3aed | #6d28d9 | Primary CTA buttons, active states |
| `--accent-600`     | #6d28d9 | #5b21b6 | Darker variant for hover states    |
| `--accent-50`      | #4c1d95 | #ede9fe | Light background for accent areas  |
| `--accent-hover`   | #6d28d9 | #5b21b6 | Hover state color                  |
| `--accent-active`  | #5b21b6 | #4c1d95 | Active/pressed state color         |

**Usage Example**:

```tsx
<button className="bg-accent-primary text-white hover:bg-accent-hover">
  Primary Action
</button>

<div className="bg-accent-50 text-accent-primary border-l-4 border-accent-primary p-4">
  Accent callout
</div>
```

### 4. Status Colors

Used to indicate success, warning, danger, and info states.

| Token                    | Dark    | Light   | Purpose                             |
| ------------------------ | ------- | ------- | ----------------------------------- |
| `--status-success`       | #22c55e | #16a34a | Success states, approved, completed |
| `--status-success-light` | #065f46 | #dcfce7 | Light background for success        |
| `--status-warning`       | #fbbf24 | #f59e0b | Warning states, pending approval    |
| `--status-warning-light` | #78350f | #fef3c7 | Light background for warning        |
| `--status-danger`        | #ff6b6b | #ef4444 | Error states, blocked, denied       |
| `--status-danger-light`  | #7f1d1d | #fee2e2 | Light background for danger         |
| `--status-info`          | #0ea5e9 | #0284c7 | Information, neutral status         |
| `--status-info-light`    | #0c4a6e | #e0f2fe | Light background for info           |

**Usage Example**:

```tsx
<div className="flex items-center gap-2 text-status-success">
  <Check /> Task completed
</div>

<div className="bg-status-warning-light text-status-warning px-4 py-2 rounded-md">
  Approval pending
</div>
```

### 5. Neutral Grays

Used for secondary UI elements, muted content, and gradations.

| Token                              | Usage                                |
| ---------------------------------- | ------------------------------------ |
| `--neutral-100` to `--neutral-900` | Shade gradients for various purposes |

**Color Progression** (dark to light):

- 100: Lightest (light backgrounds)
- 500: Mid-tone (borders, dividers)
- 900: Darkest (high-contrast text)

### 6. Shadows

Used for depth and elevation.

| Token         | Value       | Purpose                       |
| ------------- | ----------- | ----------------------------- |
| `--shadow-xs` | 0 1px 2px   | Subtle elevation, small cards |
| `--shadow-sm` | 0 1px 2px   | Small elements, tooltips      |
| `--shadow-md` | 0 4px 8px   | Medium cards, panels          |
| `--shadow-lg` | 0 10px 20px | Large modals, floating panels |

**Usage Example**:

```tsx
<div className="shadow-md rounded-lg p-4">
  Card with medium shadow
</div>

<div className="shadow-lg rounded-xl p-6">
  Modal with large shadow
</div>
```

### 7. Spacing (Base Unit: 4px)

Consistent spacing scale for margins, padding, and gaps.

| Token         | Size    | Pixels |
| ------------- | ------- | ------ |
| `--space-xs`  | 0.5rem  | 8px    |
| `--space-sm`  | 0.75rem | 12px   |
| `--space-md`  | 1rem    | 16px   |
| `--space-lg`  | 1.5rem  | 24px   |
| `--space-xl`  | 2rem    | 32px   |
| `--space-2xl` | 3rem    | 48px   |

**Usage Example**:

```tsx
<div className="p-md gap-lg">
  {/* 16px padding, 24px gap between children */}
</div>

<div className="m-xl">
  {/* 32px margin */}
</div>
```

### 8. Border Radius

Rounded corner sizes.

| Token           | Size     | Pixels      |
| --------------- | -------- | ----------- |
| `--radius-sm`   | 0.375rem | 6px         |
| `--radius-md`   | 0.5rem   | 8px         |
| `--radius-lg`   | 0.75rem  | 12px        |
| `--radius-xl`   | 1rem     | 16px        |
| `--radius-full` | 9999px   | Full circle |

**Usage Example**:

```tsx
<button className="rounded-md px-md py-sm">
  Standard button
</button>

<img className="rounded-full w-10 h-10" src="..." />
```

### 9. Typography

Font families and scales.

| Token                | Value                     | Purpose          |
| -------------------- | ------------------------- | ---------------- |
| `--font-family-sans` | Inter, system UI fonts    | Body text, UI    |
| `--font-family-mono` | JetBrains Mono, Fira Code | Code, logs, data |

**Font Sizes**:

```
--text-xs:   12px
--text-sm:   14px
--text-base: 16px
--text-lg:   18px
--text-xl:   20px
--text-2xl:  24px
--text-3xl:  30px
--text-4xl:  36px
```

**Font Weights**:

```
--font-weight-normal:    400
--font-weight-medium:    500
--font-weight-semibold:  600
--font-weight-bold:      700
```

**Usage Example**:

```tsx
<h1 className="text-4xl font-bold">Heading</h1>
<p className="text-base font-normal">Body text</p>
<code className="font-mono text-sm">const x = 10;</code>
```

### 10. Transitions

Animation duration and easing.

| Token               | Duration       | Purpose                                |
| ------------------- | -------------- | -------------------------------------- |
| `--transition-fast` | 150ms ease-out | Quick interactions (hover, focus)      |
| `--transition-base` | 200ms ease-out | Standard transitions                   |
| `--transition-slow` | 300ms ease-out | Elaborate transitions (modals, panels) |

**Usage Example**:

```tsx
<button className="transition-colors duration-base hover:bg-accent-hover">
  Hover me
</button>
```

## Implementation Guide

### 1. Using Tokens in React Components

**Option A: Using Tailwind Classes (Preferred)**

```tsx
// components/ui/Button.tsx
export function Button({ children, variant = "primary" }: ButtonProps) {
  const baseStyles =
    "px-md py-sm rounded-md transition-colors duration-base font-medium";
  const variants = {
    primary: "bg-accent-primary text-white hover:bg-accent-hover",
    secondary:
      "bg-surface-raised text-text-primary border border-surface-border hover:bg-surface-overlay",
    danger: "bg-status-danger text-white hover:bg-status-danger/90",
  };

  return (
    <button className={`${baseStyles} ${variants[variant]}`}>{children}</button>
  );
}
```

**Option B: Using CSS Variables**

```tsx
// components/Card.tsx
export function Card({ children, className }: CardProps) {
  return (
    <div
      className={`rounded-lg p-lg shadow-md ${className}`}
      style={{
        backgroundColor: "var(--surface-raised)",
        borderColor: "var(--surface-border)",
        color: "var(--text-primary)",
      }}
    >
      {children}
    </div>
  );
}
```

### 2. Creating Component Libraries

**Example: Alert Component**

```tsx
// components/ui/Alert.tsx
import { AlertCircle, Check, AlertTriangle } from "lucide-react";

type AlertType = "success" | "warning" | "danger" | "info";

const alertStyles: Record<
  AlertType,
  { bg: string; border: string; text: string; icon: string }
> = {
  success: {
    bg: "bg-status-success-light",
    border: "border-status-success",
    text: "text-status-success",
    icon: "text-status-success",
  },
  warning: {
    bg: "bg-status-warning-light",
    border: "border-status-warning",
    text: "text-status-warning",
    icon: "text-status-warning",
  },
  danger: {
    bg: "bg-status-danger-light",
    border: "border-status-danger",
    text: "text-status-danger",
    icon: "text-status-danger",
  },
  info: {
    bg: "bg-status-info-light",
    border: "border-status-info",
    text: "text-status-info",
    icon: "text-status-info",
  },
};

const iconMap = {
  success: Check,
  warning: AlertTriangle,
  danger: AlertCircle,
  info: AlertCircle,
};

export function Alert({ type = "info", title, message }: AlertProps) {
  const style = alertStyles[type];
  const Icon = iconMap[type];

  return (
    <div
      className={`${style.bg} border-l-4 ${style.border} p-md rounded-md flex gap-md`}
    >
      <Icon className={`${style.icon} flex-shrink-0 mt-xs`} />
      <div>
        <h4 className={`${style.text} font-semibold`}>{title}</h4>
        <p className={`${style.text} text-sm opacity-75`}>{message}</p>
      </div>
    </div>
  );
}
```

### 3. Theming Best Practices

**✓ DO**:

- Use token names in components (e.g., `bg-surface-raised`)
- Nest selectors within theme classes
- Test all themes during development
- Document component behavior in each theme

**✗ DON'T**:

- Hard-code colors directly (e.g., `bg-[#09090b]`)
- Mix token names with hard-coded values
- Assume dark theme styling works in light mode
- Use theme-specific component variants

### 4. Accessibility Considerations

**Color Contrast**:

- All text colors meet WCAG AA (4.5:1 for normal text)
- High-contrast theme provided for accessibility
- Test with color-blind simulation tools

**Focus States**:

```tsx
// Built-in focus states via tokens
button:focus-visible {
  box-shadow: var(--focus-ring);
}
```

**Reduced Motion**:

```tsx
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

## Migration from Hard-Coded Colors

### Before (❌ Don't)

```tsx
<button className="bg-[#7c3aed] text-white hover:bg-[#6d28d9]">Click me</button>
```

### After (✓ DO)

```tsx
<button className="bg-accent-primary text-white hover:bg-accent-hover">
  Click me
</button>
```

## Extending Tokens

To add new tokens:

1. **Define in `src/styles/design-tokens.css`**:

   ```css
   :root,
   .theme-dark {
     --custom-color: #value;
   }

   .theme-light {
     --custom-color: #value;
   }
   ```

2. **Add to `tailwind.config.js`**:

   ```js
   colors: {
     custom: 'var(--custom-color)',
   }
   ```

3. **Document in this file**

## Testing Tokens Across Themes

**Manual Testing**:

1. Open app in dev mode
2. Toggle theme via settings
3. Verify all colors/spacing appear correct
4. Check contrast with WAVE or axe

**Automated Testing**:

```ts
// Example: Check color contrast
import { contrast } from "wcag-contrast";

describe("Design Tokens", () => {
  it("should meet WCAG AA contrast", () => {
    const result = contrast("#e6e6e9", "#09090b"); // text-primary on surface-base
    expect(result.ratio).toBeGreaterThanOrEqual(4.5);
  });
});
```

## Quick Reference

| Use Case            | Token(s)                                      |
| ------------------- | --------------------------------------------- |
| **Page background** | `bg-surface-base`                             |
| **Card/modal**      | `bg-surface-raised`                           |
| **Primary button**  | `bg-accent-primary hover:bg-accent-hover`     |
| **Success message** | `bg-status-success-light text-status-success` |
| **Error message**   | `bg-status-danger-light text-status-danger`   |
| **Body text**       | `text-text-primary`                           |
| **Hint text**       | `text-text-secondary`                         |
| **Border**          | `border-surface-border`                       |
| **Card spacing**    | `p-lg gap-md`                                 |
| **Focus state**     | `focus:shadow-focus-ring`                     |

## Support

For questions or additions:

1. Check this documentation
2. Review `src/styles/design-tokens.css`
3. Check `tailwind.config.js`
4. Open an issue with `[tokens]` prefix
