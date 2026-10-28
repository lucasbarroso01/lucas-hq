import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import { useHQ, type Walker } from '../store'
import { RING_RADIUS, ROOM_POS, handoffPath, ringPoint } from '../lib/layout'
import { Character } from './Character'

const PULSE_MS = 1400
const SLOTS = 12

/** Light particles travelling between rooms and the brain (write = in, read = out). */
export function Pulses() {
  const refs = useRef<(Group | null)[]>([])
  useFrame(() => {
    const now = performance.now()
    const live = useHQ.getState().pulses.filter((p) => now - p.born < PULSE_MS).slice(-SLOTS)
    refs.current.forEach((g, i) => {
      if (!g) return
      const p = live[i]
      if (!p) { g.visible = false; return }
      const pos = ROOM_POS[p.team_id]
      if (!pos) { g.visible = false; return }
      let k = (now - p.born) / PULSE_MS
      if (p.dir === 'out') k = 1 - k
      // quadratic curve matching EnergyLines: room → mid → brain
      const [x0, z0] = ringPoint(pos.angle, RING_RADIUS - 2)
      const a = { x: x0, y: 3.4, z: z0 }, m = { x: x0 * 0.55, y: 4.2, z: z0 * 0.55 }, b = { x: 0, y: 2.8, z: 0 }
      const u = 1 - k
      g.position.set(
        u * u * a.x + 2 * u * k * m.x + k * k * b.x,
        u * u * a.y + 2 * u * k * m.y + k * k * b.y,
        u * u * a.z + 2 * u * k * m.z + k * k * b.z,
      )
      g.visible = true
      const color = useHQ.getState().teams.find((t) => t.id === p.team_id)?.cor ?? '#fff'
      ;(g.children[0] as any).material.color.set(color)
    })
  })
  return (
    <group>
      {Array.from({ length: SLOTS }, (_, i) => (
        <group key={i} ref={(g) => { refs.current[i] = g }} visible={false}>
          <mesh>
            <sphereGeometry args={[0.22, 12, 10]} />
            <meshBasicMaterial color="#fff" toneMapped={false} />
          </mesh>
          <mesh scale={1.9}>
            <sphereGeometry args={[0.22, 12, 10]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.25} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

const WALK_SPEED = 4.2 // world units per second

function WalkerMesh({ w }: { w: Walker }) {
  const g = useRef<Group>(null)
  const path = useRef(handoffPath(w.from, w.to))
  const lengths = useRef<number[]>([])
  if (!lengths.current.length) {
    let acc = 0
    lengths.current = path.current.map((p, i) => {
      if (i) acc += Math.hypot(p[0] - path.current[i - 1][0], p[1] - path.current[i - 1][1])
      return acc
    })
  }
  useFrame(() => {
    if (!g.current) return
    const pts = path.current, L = lengths.current
    const total = L[L.length - 1] || 1
    const d = Math.min(total, ((performance.now() - w.born) / 1000) * WALK_SPEED)
    let i = 1
    while (i < L.length - 1 && L[i] < d) i++
    const seg = L[i] - L[i - 1] || 1
    const k = (d - L[i - 1]) / seg
    const x = pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k
    const z = pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k
    g.current.position.set(x, -0.36, z)
    g.current.rotation.y = Math.atan2(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
    g.current.visible = d < total
  })
  return (
    <group ref={g}>
      <Character color={w.color} seed={w.id.length} mode="walking" scale={0.95} />
      {/* the task being handed off */}
      <mesh position={[0, 0.95, 0.3]}>
        <boxGeometry args={[0.32, 0.24, 0.12]} />
        <meshStandardMaterial color={w.color} emissive={w.color} emissiveIntensity={2.5} toneMapped={false} />
      </mesh>
    </group>
  )
}

export function Walkers() {
  const walkers = useHQ((s) => s.walkers)
  return <>{walkers.map((w) => <WalkerMesh key={w.id} w={w} />)}</>
}
