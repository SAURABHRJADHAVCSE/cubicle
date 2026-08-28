"use client";

import { Canvas } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { useEffect, useState } from "react";
import * as THREE from "three";

import { Office } from "@/components/office/Office";

interface OfficeCanvasProps {
  onContextLost?: () => void;
}

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

export function OfficeCanvas({ onContextLost }: OfficeCanvasProps) {
  const isLowPower = useIsLowPowerDevice();

  return (
    <Canvas
      orthographic
      shadows={!isLowPower}
      dpr={isLowPower ? 1 : [1, 1.5]}
      camera={{ position: [0, 14, 20], zoom: 60, near: 0.1, far: 80 }}
      gl={{ antialias: !isLowPower, alpha: false, powerPreference: "high-performance" }}
      className="!absolute inset-0"
      onCreated={({ gl }) => {
        gl.shadowMap.type = THREE.PCFSoftShadowMap;
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1;
        gl.outputColorSpace = THREE.SRGBColorSpace;
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
      {!isLowPower && (
        <Environment resolution={96} background={false} environmentIntensity={0.32}>
          <Lightformer
            form="rect"
            intensity={1.4}
            color="#fff4e6"
            scale={[14, 8, 1]}
            position={[0, 10, 4]}
            rotation={[Math.PI / 2, 0, 0]}
          />
          <Lightformer
            form="rect"
            intensity={0.55}
            color="#c7d2fe"
            scale={[8, 5, 1]}
            position={[8, 5, -5]}
            rotation={[0, -Math.PI / 3, 0]}
          />
        </Environment>
      )}
      <Office />
    </Canvas>
  );
}
