/**
 * Optional decorative 3D scene (solar orb) for login/dashboard.
 * Lazy-loaded; uses Three.js. pointer-events: none so it does not capture clicks.
 */
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useTheme } from '../contexts/ThemeContext';

const SolarScene3D: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { isDark } = useTheme();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    camera.position.z = 4;

    const geometry = new THREE.SphereGeometry(0.6, 32, 32);
    const material = new THREE.MeshPhongMaterial({
      color: 0xf59e0b,
      emissive: 0xf97316,
      emissiveIntensity: 0.4,
      shininess: 30,
    });
    const sphere = new THREE.Mesh(geometry, material);
    scene.add(sphere);

    const ambientColor = isDark ? 0x1e293b : 0xf1f5f9;
    scene.add(new THREE.AmbientLight(ambientColor, 0.6));
    const pointLight = new THREE.PointLight(0xffffff, 0.8, 20);
    pointLight.position.set(2, 2, 2);
    scene.add(pointLight);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    const resize = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener('resize', resize);

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frameId: number;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      if (!prefersReducedMotion) sphere.rotation.y += 0.008;
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(frameId);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [isDark]);

  return (
    <div
      ref={containerRef}
      className="solar-scene-3d"
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    />
  );
};

export default SolarScene3D;
