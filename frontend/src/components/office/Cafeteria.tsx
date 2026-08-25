import { useMemo } from "react";

import { createSignMaterial, getTiledVoxelMaterial, getVoxelMaterial } from "@/lib/voxelMaterials";

interface CafeteriaProps {
  /** Center X of this zone within the back strip (cafeteria/cabin/rec share the row). */
  zoneCenterX: number;
  /** Width available to this zone. */
  zoneWidth: number;
  /** Z of the food counter (nearest the back wall). */
  counterZ: number;
  /** Z of the tables (between the divider and the counter). */
  tablesZ: number;
  /** Z of the divider fence — used only to size the carpet's depth. */
  dividerZ: number;
}

function CoffeeMachine({ x, z }: { x: number; z: number }) {
  const iron = getVoxelMaterial("iron");
  const dark = getVoxelMaterial("dark_oak");
  const monitorScreen = getVoxelMaterial("monitor_screen");

  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.75, 0]} material={iron}>
        <boxGeometry args={[0.4, 0.7, 0.35]} />
      </mesh>
      <mesh position={[0, 0.95, 0.18]} material={monitorScreen}>
        <boxGeometry args={[0.14, 0.1, 0.02]} />
      </mesh>
      <mesh position={[0, 0.42, 0.1]} material={dark}>
        <boxGeometry args={[0.3, 0.06, 0.22]} />
      </mesh>
    </group>
  );
}

function Table({ x, z }: { x: number; z: number }) {
  const oak = getVoxelMaterial("oak");
  const darkOak = getVoxelMaterial("dark_oak");
  const seats: [number, number][] = [
    [x - 1.1, z],
    [x + 1.1, z],
    [x, z - 1.1],
    [x, z + 1.1],
  ];

  return (
    <group>
      <mesh position={[x, 0.85, z]} material={oak}>
        <boxGeometry args={[1.6, 0.08, 1.6]} />
      </mesh>
      <mesh position={[x, 0.42, z]} material={darkOak}>
        <boxGeometry args={[0.2, 0.84, 0.2]} />
      </mesh>
      {seats.map(([sx, sz]) => (
        <mesh key={`${sx}-${sz}`} position={[sx, 0.3, sz]} material={oak}>
          <boxGeometry args={[0.45, 0.3, 0.45]} />
        </mesh>
      ))}
    </group>
  );
}

export function Cafeteria({ zoneCenterX, zoneWidth, counterZ, tablesZ, dividerZ }: CafeteriaProps) {
  const quartz = getVoxelMaterial("quartz");

  const carpetWidth = Math.min(zoneWidth - 1, 6.5);
  const carpetDepth = Math.max(1, dividerZ - counterZ - 0.8);
  const carpetCenterZ = (dividerZ + counterZ) / 2;
  const carpetMat = useMemo(
    () => getTiledVoxelMaterial("red_wool", carpetWidth, carpetDepth),
    [carpetWidth, carpetDepth],
  );

  const cakeMaterials = useMemo(() => {
    const side = getVoxelMaterial("cake_side");
    const top = getVoxelMaterial("cake_top");
    const bottom = getVoxelMaterial("dark_oak");
    return [side, side, top, bottom, side, side];
  }, []);

  const counterWidth = Math.min(zoneWidth - 1, 6);
  const signMat = useMemo(() => createSignMaterial("CAFETERIA"), []);

  return (
    <group position={[zoneCenterX, 0, 0]}>
      <mesh position={[0, 0.02, carpetCenterZ]} rotation={[-Math.PI / 2, 0, 0]} material={carpetMat}>
        <planeGeometry args={[carpetWidth, carpetDepth]} />
      </mesh>

      <mesh position={[0, 0.5, counterZ]} material={quartz}>
        <boxGeometry args={[counterWidth, 1, 1.4]} />
      </mesh>
      {[-1.6, 0, 1.6].map((cx) => (
        <mesh key={cx} position={[cx, 1.2, counterZ]} material={cakeMaterials}>
          <boxGeometry args={[0.5, 0.28, 0.5]} />
        </mesh>
      ))}
      <CoffeeMachine x={counterWidth / 2 - 0.5} z={counterZ} />
      <mesh position={[0, 1.9, counterZ + 0.72]} material={signMat}>
        <boxGeometry args={[1.4, 0.7, 0.06]} />
      </mesh>

      <Table x={-1.7} z={tablesZ} />
      <Table x={1.7} z={tablesZ} />
    </group>
  );
}
