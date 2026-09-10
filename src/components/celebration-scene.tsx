'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

const PARTICLE_COUNT = 90;
export const CELEBRATION_DURATION_MS = 1400;
const DURATION_S = CELEBRATION_DURATION_MS / 1000;
const GRAVITY = -3.2;

function randomVelocities(): Float32Array {
  const velocities = new Float32Array(PARTICLE_COUNT * 3);
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.2 + Math.random() * 2.2;
    velocities[i * 3] = Math.cos(angle) * speed;
    velocities[i * 3 + 1] = 1.5 + Math.random() * 1.5;
    velocities[i * 3 + 2] = Math.sin(angle) * speed;
  }
  return velocities;
}

function Burst({ onDone }: { onDone: () => void }) {
  const pointsRef = useRef<THREE.Points>(null);
  const startRef = useRef<number | null>(null);
  const doneRef = useRef(false);
  // Randomized per-particle outward velocity -- generated in a layout
  // effect (commit phase, not render) rather than useMemo, since Math.random
  // is an impure call and render must stay pure. `positions` itself starts
  // at all-zero (a pure allocation) and is fully recomputed every frame in
  // useFrame below, so it never needs to be random.
  const velocitiesRef = useRef<Float32Array>(
    new Float32Array(PARTICLE_COUNT * 3),
  );
  const positions = useMemo(() => new Float32Array(PARTICLE_COUNT * 3), []);

  useLayoutEffect(() => {
    velocitiesRef.current = randomVelocities();
  }, []);

  useFrame((state) => {
    if (doneRef.current) return;
    if (startRef.current === null) startRef.current = state.clock.elapsedTime;
    const elapsed = state.clock.elapsedTime - startRef.current;
    const progress = elapsed / DURATION_S;

    if (progress >= 1) {
      doneRef.current = true;
      onDone();
      return;
    }

    const geometry = pointsRef.current?.geometry;
    const positionAttribute = geometry?.attributes.position as
      THREE.BufferAttribute | undefined;

    if (positionAttribute) {
      const velocities = velocitiesRef.current;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        positionAttribute.setXYZ(
          i,
          velocities[i * 3] * elapsed,
          velocities[i * 3 + 1] * elapsed + 0.5 * GRAVITY * elapsed * elapsed,
          velocities[i * 3 + 2] * elapsed,
        );
      }
      positionAttribute.needsUpdate = true;
    }

    const material = pointsRef.current?.material as
      THREE.PointsMaterial | undefined;
    if (material) material.opacity = 1 - progress;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute args={[positions, 3]} attach="attributes-position" />
      </bufferGeometry>
      <pointsMaterial
        blending={THREE.AdditiveBlending}
        color="#f0cf85"
        depthWrite={false}
        opacity={1}
        size={0.14}
        sizeAttenuation
        transparent
      />
    </points>
  );
}

/** A brief gold particle burst, meant to be mounted for ~1.4s then torn down. */
export function CelebrationScene({ onDone }: { onDone: () => void }) {
  return (
    <Canvas
      camera={{ fov: 50, position: [0, 1, 6] }}
      gl={{ alpha: true, antialias: true }}
      style={{ height: '100%', width: '100%' }}
    >
      <Burst onDone={onDone} />
    </Canvas>
  );
}
