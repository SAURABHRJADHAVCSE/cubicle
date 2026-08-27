"use client";

import { useMemo } from "react";

import { createSignMaterial, getTiledVoxelMaterial, getVoxelMaterial, preventZFighting } from "@/lib/voxelMaterials";

interface CafeteriaProps {
  position: [number, number, number];
  onSelect?: () => void;
}

const ROOM_WIDTH = 5.4;
const ROOM_DEPTH = 4.2;
const ROOM_HEIGHT = 2.4;

function VendingMachine({ x, z }: { x: number; z: number }) {
  const vendingMat = getVoxelMaterial("vending_machine");
  const iron = getVoxelMaterial("iron");

  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.95, 0]} material={vendingMat} castShadow receiveShadow>
        <boxGeometry args={[0.8, 1.9, 0.65]} />
      </mesh>
      <mesh position={[0, 1.93, 0]} material={iron}>
        <boxGeometry args={[0.82, 0.06, 0.67]} />
      </mesh>
      <pointLight position={[0, 1.2, 0.38]} color="#38bdf8" intensity={0.4} distance={1.8} />
    </group>
  );
}

function WaterCooler({ x, z }: { x: number; z: number }) {
  const iron = getVoxelMaterial("iron");
  const glass = getVoxelMaterial("glass");
  const seaLantern = getVoxelMaterial("sea_lantern");

  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.45, 0]} material={iron} castShadow>
        <boxGeometry args={[0.35, 0.9, 0.35]} />
      </mesh>
      <mesh position={[0, 1.1, 0]} material={glass} castShadow>
        <cylinderGeometry args={[0.16, 0.16, 0.4, 12]} />
      </mesh>
      <mesh position={[0, 1.1, 0]} material={seaLantern}>
        <cylinderGeometry args={[0.12, 0.12, 0.35, 12]} />
      </mesh>
    </group>
  );
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
    [x - 0.75, z],
    [x + 0.75, z],
    [x, z - 0.75],
    [x, z + 0.75],
  ];

  return (
    <group>
      <mesh position={[x, 0.85, z]} material={oak}>
        <boxGeometry args={[1.3, 0.08, 1.3]} />
      </mesh>
      <mesh position={[x, 0.42, z]} material={darkOak}>
        <boxGeometry args={[0.18, 0.84, 0.18]} />
      </mesh>
      {seats.map(([sx, sz]) => (
        <mesh key={`${sx}-${sz}`} position={[sx, 0.3, sz]} material={oak}>
          <boxGeometry args={[0.36, 0.3, 0.36]} />
        </mesh>
      ))}
    </group>
  );
}

export function Cafeteria({ position, onSelect }: CafeteriaProps) {
  const quartz = getVoxelMaterial("quartz");
  const oakMat = useMemo(
    () => preventZFighting(getTiledVoxelMaterial("oak", ROOM_WIDTH, ROOM_DEPTH)),
    [],
  );
  const glassMat = useMemo(
    () => getTiledVoxelMaterial("glass", ROOM_WIDTH, ROOM_HEIGHT),
    [],
  );

  const cakeMaterials = useMemo(() => {
    const side = getVoxelMaterial("cake_side");
    const top = getVoxelMaterial("cake_top");
    const bottom = getVoxelMaterial("dark_oak");
    return [side, side, top, bottom, side, side];
  }, []);

  const signMat = useMemo(() => createSignMaterial("CAFETERIA"), []);

  return (
    <group
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.();
      }}
    >
      {/* Wood Tile Subfloor Box */}
      <mesh position={[0, 0.06, 0]} material={oakMat} receiveShadow>
        <boxGeometry args={[ROOM_WIDTH, 0.04, ROOM_DEPTH]} />
      </mesh>

      {/* Glass Walls with Door Gap */}
      <mesh position={[0, ROOM_HEIGHT / 2, -ROOM_DEPTH / 2]} material={glassMat}>
        <boxGeometry args={[ROOM_WIDTH, ROOM_HEIGHT, 0.08]} />
      </mesh>
      <mesh
        position={[-ROOM_WIDTH / 2, ROOM_HEIGHT / 2, 0]}
        rotation={[0, Math.PI / 2, 0]}
        material={glassMat}
      >
        <boxGeometry args={[ROOM_DEPTH, ROOM_HEIGHT, 0.08]} />
      </mesh>

      {/* Signboard */}
      <mesh position={[0, ROOM_HEIGHT + 0.15, ROOM_DEPTH / 2 + 0.05]} material={signMat}>
        <boxGeometry args={[1.8, 0.5, 0.06]} />
      </mesh>

      {/* Food Counter */}
      <mesh position={[0, 0.5, -0.9]} material={quartz}>
        <boxGeometry args={[3.6, 1.0, 1.0]} />
      </mesh>
      {[-1.0, 0, 1.0].map((cx) => (
        <mesh key={cx} position={[cx, 1.15, -0.9]} material={cakeMaterials}>
          <boxGeometry args={[0.4, 0.25, 0.4]} />
        </mesh>
      ))}
      <CoffeeMachine x={1.3} z={-0.9} />
      <WaterCooler x={-1.5} z={-0.9} />
      <VendingMachine x={2.1} z={-0.9} />

      {/* Dining Tables */}
      <Table x={-1.3} z={0.8} />
      <Table x={1.3} z={0.8} />
    </group>
  );
}
