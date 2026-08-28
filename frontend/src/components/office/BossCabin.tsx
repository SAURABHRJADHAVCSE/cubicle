"use client";

import { modernMaterials } from "@/lib/modernMaterials";

interface BossCabinProps {
  position: [number, number, number];
}

const WIDTH = 5.4;
const DEPTH = 3.55;
const HEIGHT = 2.15;
const FRAME = 0.07;

function GlassPanel({
  width,
  position,
  rotationY = 0,
}: {
  width: number;
  position: [number, number, number];
  rotationY?: number;
}) {
  const glass = modernMaterials.cabinGlass();
  const frame = modernMaterials.cabinFrame();

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, HEIGHT / 2, 0]} material={glass}>
        <boxGeometry args={[width, HEIGHT, 0.045]} />
      </mesh>
      {[0, HEIGHT].map((y) => (
        <mesh key={y} position={[0, y, 0]} material={frame} castShadow>
          <boxGeometry args={[width + FRAME, FRAME, 0.085]} />
        </mesh>
      ))}
      {[-width / 2, width / 2].map((x) => (
        <mesh key={x} position={[x, HEIGHT / 2, 0]} material={frame} castShadow>
          <boxGeometry args={[FRAME, HEIGHT, 0.085]} />
        </mesh>
      ))}
    </group>
  );
}

export function BossCabin({ position }: BossCabinProps) {
  const floor = modernMaterials.rug();
  const wall = modernMaterials.wallWarmGrey();
  const frame = modernMaterials.cabinFrame();
  const desk = modernMaterials.cabinDeskWood();
  const chair = modernMaterials.cabinChairLeather();
  const visitorChair = modernMaterials.sofaFabric();
  const metal = modernMaterials.deskLegMetal();
  const screen = modernMaterials.monitorScreen();
  const storage = modernMaterials.storageCabinet();
  const art = modernMaterials.wallArt();
  const doorGap = 1.15;
  const frontPanelWidth = (WIDTH - doorGap) / 2;

  return (
    <group position={position}>
      <mesh position={[0, 0.025, 0]} material={floor} receiveShadow>
        <boxGeometry args={[WIDTH, 0.035, DEPTH]} />
      </mesh>

      <mesh position={[0, HEIGHT / 2, -DEPTH / 2]} material={wall} castShadow receiveShadow>
        <boxGeometry args={[WIDTH, HEIGHT, 0.12]} />
      </mesh>
      <mesh position={[0, 0.05, -DEPTH / 2 + 0.075]} material={frame}>
        <boxGeometry args={[WIDTH, 0.1, 0.08]} />
      </mesh>

      <GlassPanel width={DEPTH} position={[-WIDTH / 2, 0, 0]} rotationY={Math.PI / 2} />
      <GlassPanel width={DEPTH} position={[WIDTH / 2, 0, 0]} rotationY={Math.PI / 2} />
      <GlassPanel
        width={frontPanelWidth}
        position={[-(doorGap + frontPanelWidth) / 2, 0, DEPTH / 2]}
      />
      <GlassPanel
        width={frontPanelWidth}
        position={[(doorGap + frontPanelWidth) / 2, 0, DEPTH / 2]}
      />

      <group position={[0, 0, -0.55]}>
        <mesh position={[0, 0.76, 0]} material={desk} castShadow receiveShadow>
          <boxGeometry args={[2.35, 0.09, 0.82]} />
        </mesh>
        {[-0.98, 0.98].flatMap((x) =>
          [-0.31, 0.31].map((z) => (
            <mesh key={`${x}-${z}`} position={[x, 0.39, z]} material={metal} castShadow>
              <boxGeometry args={[0.065, 0.72, 0.065]} />
            </mesh>
          )),
        )}
        <mesh position={[0, 0.83, -0.25]} material={metal}>
          <boxGeometry args={[0.04, 0.18, 0.04]} />
        </mesh>
        <mesh position={[0, 1.08, -0.25]} material={screen}>
          <boxGeometry args={[0.7, 0.42, 0.04]} />
        </mesh>
      </group>

      <group position={[0, 0, -1.28]}>
        <mesh position={[0, 0.49, 0]} material={chair} castShadow receiveShadow>
          <boxGeometry args={[0.65, 0.09, 0.58]} />
        </mesh>
        <mesh position={[0, 0.87, -0.23]} material={chair} castShadow>
          <boxGeometry args={[0.66, 0.72, 0.1]} />
        </mesh>
        <mesh position={[0, 0.24, 0]} material={metal}>
          <cylinderGeometry args={[0.04, 0.04, 0.46, 10]} />
        </mesh>
        <mesh position={[0, 0.03, 0]} material={metal}>
          <cylinderGeometry args={[0.28, 0.28, 0.045, 16]} />
        </mesh>
      </group>

      {[-0.62, 0.62].map((x) => (
        <group key={x} position={[x, 0, 0.72]} rotation={[0, Math.PI, 0]}>
          <mesh position={[0, 0.43, 0]} material={visitorChair} castShadow receiveShadow>
            <boxGeometry args={[0.5, 0.09, 0.48]} />
          </mesh>
          <mesh position={[0, 0.69, 0.18]} material={visitorChair} castShadow>
            <boxGeometry args={[0.5, 0.5, 0.08]} />
          </mesh>
          {[-0.19, 0.19].flatMap((legX) =>
            [-0.17, 0.17].map((legZ) => (
              <mesh key={`${legX}-${legZ}`} position={[legX, 0.2, legZ]} material={metal}>
                <cylinderGeometry args={[0.022, 0.022, 0.4, 8]} />
              </mesh>
            )),
          )}
        </group>
      ))}

      <mesh position={[WIDTH / 2 - 0.34, 0.48, -0.85]} material={storage} castShadow receiveShadow>
        <boxGeometry args={[0.5, 0.92, 1.05]} />
      </mesh>
      {[-0.58, 0, 0.58].map((x) => (
        <mesh key={x} position={[x, 1.45, -DEPTH / 2 + 0.07]} material={art}>
          <boxGeometry args={[0.38, 0.42, 0.035]} />
        </mesh>
      ))}
    </group>
  );
}
