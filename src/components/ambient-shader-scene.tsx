'use client';

import { ShaderGradient, ShaderGradientCanvas } from '@shadergradient/react';

/**
 * The actual WebGL scene. Kept in its own module (rather than inlined in
 * ambient-background.tsx) so it can be `next/dynamic(..., { ssr: false })`
 * imported as a single chunk, keeping Three.js out of the initial bundle.
 */
export function AmbientShaderScene({
  animate,
  boost = false,
}: {
  animate: boolean;
  /** Briefly brighter + faster, for a task-completion milestone pulse. */
  boost?: boolean;
}) {
  return (
    <ShaderGradientCanvas
      pixelDensity={1}
      pointerEvents="none"
      powerPreference="low-power"
      style={{ width: '100%', height: '100%' }}
    >
      <ShaderGradient
        animate={animate ? 'on' : 'off'}
        brightness={boost ? 1.15 : 0.8}
        cAzimuthAngle={180}
        cDistance={2.8}
        cPolarAngle={80}
        cameraZoom={9.1}
        color1="#d9b872"
        color2="#8a6a2f"
        color3="#1c1914"
        envPreset="dawn"
        grain="off"
        lightType="3d"
        positionX={0}
        positionY={0}
        positionZ={0}
        reflection={0.1}
        rotationX={50}
        rotationY={0}
        rotationZ={-60}
        type="waterPlane"
        uAmplitude={0}
        uDensity={1.5}
        uFrequency={0}
        uSpeed={boost ? 0.4 : 0.15}
        uStrength={boost ? 2 : 1.5}
      />
    </ShaderGradientCanvas>
  );
}
