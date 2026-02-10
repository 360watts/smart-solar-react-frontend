import React, { useEffect, useRef } from 'react';
import { useNavigation } from '../contexts/NavigationContext';

const NavigationProgress: React.FC = () => {
  const { isNavigating } = useNavigation();
  const progressRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (!isNavigating || !progressRef.current) return;

    progressRef.current.classList.remove('complete');
    progressRef.current.style.width = '0%';
    progressRef.current.style.opacity = '1';

    // Start animation
    setTimeout(() => {
      if (progressRef.current) {
        progressRef.current.style.width = '30%';
      }
    }, 50);

    animationRef.current = setTimeout(() => {
      if (progressRef.current) {
        progressRef.current.style.width = '60%';
      }
    }, 500);

    return () => {
      if (animationRef.current) clearTimeout(animationRef.current);
    };
  }, [isNavigating]);

  useEffect(() => {
    if (!isNavigating && progressRef.current) {
      progressRef.current.style.width = '100%';
      progressRef.current.classList.add('complete');
    }
  }, [isNavigating]);

  return <div ref={progressRef} className="navigation-progress" />;
};

export default NavigationProgress;
