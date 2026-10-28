import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group, Mesh } from 'three'

const SKIN = ['#f1c7a3', '#d9a27c', '#a86f4c', '#7a4a2f', '#f3d5b9']
const HAIR = ['#2b1d14', '#55331c', '#111111', '#a8652d', '#d8b56a']

interface Props { color: string; seed: number; mode: 'typing' | 'idle' | 'walking'; scale?: number }

/** Low-poly person. Seated (typing/idle) or walking; seed varies skin and hair. */
export function Character({ color, seed, mode, scale = 1 }: Props) {
  const head = useRef<Group>(null)
  const armL = useRef<Mesh>(null)
  const armR = useRef<Mesh>(null)
  const legL = useRef<Mesh>(null)
  const legR = useRef<Mesh>(null)
  const body = useRef<Group>(null)
  const skin = SKIN[seed % SKIN.length]
  const hair = HAIR[(seed * 7) % HAIR.length]
  const seated = mode !== 'walking'

  useFrame(({ clock }) => {
    const t = clock.elapsedTime + seed * 1.3
    if (mode === 'typing') {
      if (armL.current) armL.current.rotation.x = -1.2 + Math.sin(t * 18) * 0.12
      if (armR.current) armR.current.rotation.x = -1.2 + Math.sin(t * 18 + 1.7) * 0.12
      if (head.current) { head.current.rotation.y = Math.sin(t * 0.9) * 0.25; head.current.rotation.x = 0.12 + Math.sin(t * 2.3) * 0.05 }
    } else if (mode === 'idle') {
      if (armL.current) armL.current.rotation.x = -0.3
      if (armR.current) armR.current.rotation.x = -0.3
      if (head.current) { head.current.rotation.y = Math.sin(t * 0.3) * 0.5; head.current.rotation.x = -0.05 }
    } else {
      const s = Math.sin(t * 9)
      if (armL.current) armL.current.rotation.x = -0.9 + s * 0.15
      if (armR.current) armR.current.rotation.x = -0.9 - s * 0.15
      if (legL.current) legL.current.rotation.x = s * 0.6
      if (legR.current) legR.current.rotation.x = -s * 0.6
      if (body.current) body.current.position.y = Math.abs(Math.cos(t * 9)) * 0.05
    }
  })

  return (
    <group scale={scale}>
      <group ref={body}>
        {/* legs */}
        <mesh ref={legL} position={[-0.11, seated ? 0.45 : 0.42, seated ? 0.18 : 0]} rotation={[seated ? -Math.PI / 2 : 0, 0, 0]} castShadow>
          <boxGeometry args={[0.16, 0.42, 0.16]} />
          <meshStandardMaterial color="#2a3150" flatShading />
        </mesh>
        <mesh ref={legR} position={[0.11, seated ? 0.45 : 0.42, seated ? 0.18 : 0]} rotation={[seated ? -Math.PI / 2 : 0, 0, 0]} castShadow>
          <boxGeometry args={[0.16, 0.42, 0.16]} />
          <meshStandardMaterial color="#2a3150" flatShading />
        </mesh>
        {/* torso */}
        <mesh position={[0, 0.85, 0]} castShadow>
          <boxGeometry args={[0.42, 0.52, 0.26]} />
          <meshStandardMaterial color={color} flatShading />
        </mesh>
        {/* arms pivot at shoulders */}
        <group position={[-0.27, 1.06, 0]}>
          <mesh ref={armL} castShadow>
            <boxGeometry args={[0.11, 0.42, 0.11]} />
            <meshStandardMaterial color={color} flatShading />
          </mesh>
        </group>
        <group position={[0.27, 1.06, 0]}>
          <mesh ref={armR} castShadow>
            <boxGeometry args={[0.11, 0.42, 0.11]} />
            <meshStandardMaterial color={color} flatShading />
          </mesh>
        </group>
        {/* head */}
        <group ref={head} position={[0, 1.3, 0]}>
          <mesh castShadow>
            <icosahedronGeometry args={[0.19, 0]} />
            <meshStandardMaterial color={skin} flatShading />
          </mesh>
          <mesh position={[0, 0.08, -0.03]} scale={[1.05, 0.7, 1.05]}>
            <icosahedronGeometry args={[0.2, 0]} />
            <meshStandardMaterial color={hair} flatShading />
          </mesh>
        </group>
      </group>
    </group>
  )
}
