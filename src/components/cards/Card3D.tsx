'use client';

import { useCallback, useEffect, useRef, type ReactNode } from 'react';

export interface Card3DBindings {
  ref: (element: HTMLElement | null) => void;
  'data-motion-reduced': boolean;
}

export interface Card3DProps {
  children: (bindings: Card3DBindings) => ReactNode;
  disabled?: boolean;
}

/** Pointer tracking changes CSS variables only; no React render per frame. */
export function Card3D({ children, disabled = false }: Card3DProps) {
  const elementRef = useRef<HTMLElement | null>(null);
  const attach = useCallback((element: HTMLElement | null) => {
    elementRef.current = element;
  }, []);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    let frame = 0;
    let releaseTimer: ReturnType<typeof setTimeout> | undefined;
    let rect: DOMRect | null = null;
    let pointerX = 0.5;
    let pointerY = 0.5;

    const allowed = () => !disabled && !reducedMotion.matches && finePointer.matches;
    const reset = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      rect = null;
      delete element.dataset.tilting;
      element.style.setProperty('--fc-rotate-x', '0deg');
      element.style.setProperty('--fc-rotate-y', '0deg');
      element.style.setProperty('--fc-pointer-x', '50%');
      element.style.setProperty('--fc-pointer-y', '50%');
      clearTimeout(releaseTimer);
      releaseTimer = setTimeout(() => { element.style.willChange = ''; }, 400);
    };
    const enter = (event: PointerEvent) => {
      if (!allowed() || event.pointerType === 'touch') return;
      rect = element.getBoundingClientRect();
      clearTimeout(releaseTimer);
      element.dataset.tilting = 'true';
      element.style.willChange = 'transform';
    };
    const move = (event: PointerEvent) => {
      if (!allowed() || event.pointerType === 'touch') return;
      if (!rect) enter(event);
      if (!rect || rect.width === 0 || rect.height === 0) return;
      pointerX = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
      pointerY = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        element.style.setProperty('--fc-rotate-x', `${((0.5 - pointerY) * 18).toFixed(2)}deg`);
        element.style.setProperty('--fc-rotate-y', `${((pointerX - 0.5) * 24).toFixed(2)}deg`);
        element.style.setProperty('--fc-pointer-x', `${(pointerX * 100).toFixed(2)}%`);
        element.style.setProperty('--fc-pointer-y', `${(pointerY * 100).toFixed(2)}%`);
      });
    };
    const motionChanged = () => { if (!allowed()) reset(); };
    const visibilityChanged = () => { if (document.hidden) reset(); };

    element.addEventListener('pointerenter', enter);
    element.addEventListener('pointermove', move);
    element.addEventListener('pointerleave', reset);
    element.addEventListener('pointercancel', reset);
    element.addEventListener('blur', reset);
    reducedMotion.addEventListener('change', motionChanged);
    finePointer.addEventListener('change', motionChanged);
    document.addEventListener('visibilitychange', visibilityChanged);
    window.addEventListener('resize', reset);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(releaseTimer);
      element.removeEventListener('pointerenter', enter);
      element.removeEventListener('pointermove', move);
      element.removeEventListener('pointerleave', reset);
      element.removeEventListener('pointercancel', reset);
      element.removeEventListener('blur', reset);
      reducedMotion.removeEventListener('change', motionChanged);
      finePointer.removeEventListener('change', motionChanged);
      document.removeEventListener('visibilitychange', visibilityChanged);
      window.removeEventListener('resize', reset);
      delete element.dataset.tilting;
      element.style.willChange = '';
      element.style.setProperty('--fc-rotate-x', '0deg');
      element.style.setProperty('--fc-rotate-y', '0deg');
    };
  }, [disabled]);

  return children({ ref: attach, 'data-motion-reduced': disabled });
}
