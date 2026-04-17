"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";

interface StepViewerProps {
  geometry: {
    vertices: number[];
    normals: number[];
    indices: number[];
  };
}

export function StepViewer({ geometry }: StepViewerProps) {
  const vertices = new Float32Array(geometry.vertices);
  const normals = new Float32Array(geometry.normals);
  const indices = new Uint32Array(geometry.indices);

  return (
    <div style={{ width: "100%", height: "400px", background: "#0f172a", borderRadius: "1.5rem", overflow: "hidden" }}>
      <Canvas
        camera={{ position: [-5, -10, 5], up: [0, 0, 1] }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 10]} intensity={1} />
        <mesh>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              array={vertices}
              count={vertices.length / 3}
              itemSize={3}
              args={[vertices, 3]}
            />
            <bufferAttribute
              attach="attributes-normal"
              array={normals}
              count={normals.length / 3}
              itemSize={3}
              args={[normals, 3]}
            />
            <bufferAttribute
              attach="index"
              array={indices}
              count={indices.length}
              itemSize={1}
              args={[indices, 1]}
            />
          </bufferGeometry>
          <meshStandardMaterial color="#fbbf24" />
        </mesh>
        <OrbitControls />
      </Canvas>
    </div>
  );
}
