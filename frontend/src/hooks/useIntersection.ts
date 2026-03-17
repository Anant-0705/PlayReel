import { useEffect, useRef, useState } from 'react';

/**
 * Tracks if an element is currently intersecting the viewport past a certain threshold.
 * For the GameReel, a threshold of 0.6 means the game starts playing when 60% is visible.
 */
export function useIntersection<T extends HTMLElement>(threshold = 0.6) {
  const ref = useRef<T>(null);
  const [isIntersecting, setIsIntersecting] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting);
      },
      {
        root: null, // viewport
        rootMargin: '0px',
        threshold
      }
    );

    observer.observe(element);
    return () => observer.unobserve(element);
  }, [threshold]);

  return { ref, isIntersecting };
}
