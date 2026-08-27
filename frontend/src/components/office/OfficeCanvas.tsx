"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";

import { Office } from "@/components/office/Office";

import type { CameraPreset, SelectedObjectType } from "@/components/office/TycoonHUD";

interface OfficeCanvasProps {
  onContextLost?: () => void;
  onSelectObject?: (obj: SelectedObjectType) => void;
  activePreset?: CameraPreset;
}

export function OfficeCanvas({ onContextLost, onSelectObject, activePreset }: OfficeCanvasProps) {
  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
      camera={{ fov: 38, near: 0.1, far: 150 }}
      gl={{ logarithmicDepthBuffer: true, antialias: true, alpha: false }}
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
