"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useEffect, useState } from "react";

import { Office } from "@/components/office/Office";

import type { CameraPreset, SelectedObjectType } from "@/components/office/TycoonHUD";

interface OfficeCanvasProps {
  onContextLost?: () => void;
  onSelectObject?: (obj: SelectedObjectType) => void;
  activePreset?: CameraPreset;
}

/** Coarse mobile/low-end check — narrow viewport or few CPU cores. Defaults
 * to the full-quality desktop path until this resolves post-mount, so SSR
 * output stays consistent (see the theme/localStorage guards elsewhere in
 * this app for the same idiom). Shadows + a higher dpr are real battery and
 * thermal cost on a phone, so this scene shouldn't render them there. */
function useIsLowPowerDevice(): boolean {
  const [isLowPower, setIsLowPower] = useState(false);
  useEffect(() => {
    const narrow = window.innerWidth < 768;
    const fewCores = (navigator.hardwareConcurrency ?? 8) <= 4;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLowPower(narrow && fewCores);
  }, []);
  return isLowPower;
}

export function OfficeCanvas({ onContextLost, onSelectObject, activePreset }: OfficeCanvasProps) {
  const isLowPower = useIsLowPowerDevice();

  return (
    <Canvas
      shadows={!isLowPower}
      dpr={isLowPower ? 1 : [1, 1.5]}
      camera={{ fov: 38, near: 0.1, far: 150 }}
      gl={{ logarithmicDepthBuffer: true, antialias: !isLowPower, alpha: false }}
      className="!absolute inset-0 cursor-grab active:cursor-grabbing"
      onCreated={({ gl }) => {
        gl.domElement.addEventListener(
          "webglcontextlost",
          (event) => {
            event.preventDefault();
            onContextLost?.();
          },
          { once: true },
        );
      }}
    >
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.05}
        minDistance={5}
        maxDistance={45}
        maxPolarAngle={Math.PI / 2.05}
        minPolarAngle={Math.PI / 6}
      />
      <Office onSelectObject={onSelectObject} activePreset={activePreset} />
    </Canvas>
  );
}
