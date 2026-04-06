/**
 * Animation & Transition Utilities - Phase 7
 *
 * Provides reusable animation and transition helpers for polish and micro-interactions.
 * Includes fade, slide, and scale animations with customizable timing.
 *
 * Features:
 * - CSS class utilities for common animations
 * - Animation hooks for JavaScript control
 * - Staggered animations for lists
 * - Smooth page transitions
 */

"use client";

import React from "react";

/**
 * Animation configuration
 */
export interface AnimationConfig {
  /** Duration in milliseconds */
  duration: number;
  /** Easing function */
  easing: "ease" | "ease-in" | "ease-out" | "ease-in-out" | "linear";
  /** Delay in milliseconds */
  delay: number;
}

/**
 * Default animation configs
 */
export const ANIMATION_CONFIGS = {
  fast: { duration: 150, easing: "ease-out", delay: 0 },
  normal: { duration: 300, easing: "ease-out", delay: 0 },
  slow: { duration: 500, easing: "ease-out", delay: 0 },
  stagger: { duration: 150, easing: "ease-out", delay: 0 },
} as const;

/**
 * CSS class mappings for common animations
 */
export const ANIMATION_CLASSES = {
  fadeIn: "animate-fade-in",
  fadeOut: "animate-fade-out",
  slideInUp: "animate-slide-in-up",
  slideInDown: "animate-slide-in-down",
  slideInLeft: "animate-slide-in-left",
  slideInRight: "animate-slide-in-right",
  scaleIn: "animate-scale-in",
  scaleOut: "animate-scale-out",
  pulse: "animate-pulse",
  bounce: "animate-bounce",
} as const;

/**
 * Hook to apply staggered animation to list items
 *
 * @example
 * const { getItemProps } = useStaggeredAnimation(items.length);
 * items.map((item, idx) => (
 *   <div key={item.id} {...getItemProps(idx)}>
 *     {item.name}
 *   </div>
 * ))
 */
export function useStaggeredAnimation(
  itemCount: number,
  staggerMs: number = 50,
) {
  return {
    getItemProps: (index: number) => ({
      style: {
        animationDelay: `${index * staggerMs}ms`,
      } as React.CSSProperties,
      className: ANIMATION_CLASSES.fadeIn,
    }),
  };
}

/**
 * Hook for fade animations with callbacks
 *
 * @example
 * const { isVisible, ref } = useFadeAnimation();
 * <div ref={ref} className={isVisible ? 'opacity-100' : 'opacity-0'}>
 *   Content
 * </div>
 */
export function useFadeAnimation() {
  const [isVisible, setIsVisible] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.1 },
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  return { isVisible, ref };
}

/**
 * Hook for controlling animations programmatically
 *
 * @example
 * const { animate, isAnimating } = useAnimation();
 * const handleClick = async () => {
 *   await animate('slideInUp');
 * };
 */
export function useAnimation() {
  const [isAnimating, setIsAnimating] = React.useState(false);

  const animate = React.useCallback(
    (animationClass: string, duration: number = 300) => {
      return new Promise<void>((resolve) => {
        setIsAnimating(true);
        setTimeout(() => {
          setIsAnimating(false);
          resolve();
        }, duration);
      });
    },
    [],
  );

  return { animate, isAnimating };
}

/**
 * Delay utility for animations
 *
 * @example
 * await delay(300);
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Tailwind animation configurations to add to tailwind.config.js
 *
 * Add to theme.extend.animation:
 * ```
 * fadeIn: 'fadeIn 0.3s ease-out',
 * fadeOut: 'fadeOut 0.3s ease-out',
 * slideInUp: 'slideInUp 0.3s ease-out',
 * slideInDown: 'slideInDown 0.3s ease-out',
 * slideInLeft: 'slideInLeft 0.3s ease-out',
 * slideInRight: 'slideInRight 0.3s ease-out',
 * scaleIn: 'scaleIn 0.3s ease-out',
 * scaleOut: 'scaleOut 0.3s ease-out',
 * ```
 *
 * Add to theme.extend.keyframes:
 * ```
 * fadeIn: {
 *   '0%': { opacity: '0' },
 *   '100%': { opacity: '1' },
 * },
 * fadeOut: {
 *   '0%': { opacity: '1' },
 *   '100%': { opacity: '0' },
 * },
 * slideInUp: {
 *   '0%': { transform: 'translateY(10px)', opacity: '0' },
 *   '100%': { transform: 'translateY(0)', opacity: '1' },
 * },
 * slideInDown: {
 *   '0%': { transform: 'translateY(-10px)', opacity: '0' },
 *   '100%': { transform: 'translateY(0)', opacity: '1' },
 * },
 * slideInLeft: {
 *   '0%': { transform: 'translateX(-10px)', opacity: '0' },
 *   '100%': { transform: 'translateX(0)', opacity: '1' },
 * },
 * slideInRight: {
 *   '0%': { transform: 'translateX(10px)', opacity: '0' },
 *   '100%': { transform: 'translateX(0)', opacity: '1' },
 * },
 * scaleIn: {
 *   '0%': { transform: 'scale(0.95)', opacity: '0' },
 *   '100%': { transform: 'scale(1)', opacity: '1' },
 * },
 * scaleOut: {
 *   '0%': { transform: 'scale(1)', opacity: '1' },
 *   '100%': { transform: 'scale(0.95)', opacity: '0' },
 * },
 * ```
 */
export const TAILWIND_ANIMATION_CONFIG = {
  extend: {
    animation: {
      "fade-in": "fadeIn 0.3s ease-out",
      "fade-out": "fadeOut 0.3s ease-out",
      "slide-in-up": "slideInUp 0.3s ease-out",
      "slide-in-down": "slideInDown 0.3s ease-out",
      "slide-in-left": "slideInLeft 0.3s ease-out",
      "slide-in-right": "slideInRight 0.3s ease-out",
      "scale-in": "scaleIn 0.3s ease-out",
      "scale-out": "scaleOut 0.3s ease-out",
    },
    keyframes: {
      fadeIn: {
        "0%": { opacity: "0" },
        "100%": { opacity: "1" },
      },
      fadeOut: {
        "0%": { opacity: "1" },
        "100%": { opacity: "0" },
      },
      slideInUp: {
        "0%": { transform: "translateY(10px)", opacity: "0" },
        "100%": { transform: "translateY(0)", opacity: "1" },
      },
      slideInDown: {
        "0%": { transform: "translateY(-10px)", opacity: "0" },
        "100%": { transform: "translateY(0)", opacity: "1" },
      },
      slideInLeft: {
        "0%": { transform: "translateX(-10px)", opacity: "0" },
        "100%": { transform: "translateX(0)", opacity: "1" },
      },
      slideInRight: {
        "0%": { transform: "translateX(10px)", opacity: "0" },
        "100%": { transform: "translateX(0)", opacity: "1" },
      },
      scaleIn: {
        "0%": { transform: "scale(0.95)", opacity: "0" },
        "100%": { transform: "scale(1)", opacity: "1" },
      },
      scaleOut: {
        "0%": { transform: "scale(1)", opacity: "1" },
        "100%": { transform: "scale(0.95)", opacity: "0" },
      },
    },
  },
};
