import { TEAMS } from '../data/seed'

export const RING_RADIUS = 19
export const ROAD_RADIUS = 12.5
export const ROOM_W = 9
export const ROOM_D = 7

export interface RoomPos { x: number; z: number; angle: number }

/** Rooms sit on a ring around the brain; angle 0 points toward the camera's top-left. */
export const ROOM_POS: Record<string, RoomPos> = Object.fromEntries(
  TEAMS.map((t, i) => {
    const angle = -Math.PI * 0.75 + (i / TEAMS.length) * Math.PI * 2
    return [t.id, { x: Math.cos(angle) * RING_RADIUS, z: Math.sin(angle) * RING_RADIUS, angle }]
  }),
)

/** Point where a room's spur road meets the ring road. */
export function ringPoint(angle: number, r = ROAD_RADIUS): [number, number] {
  return [Math.cos(angle) * r, Math.sin(angle) * r]
}

/** Walking path between two rooms: door → spur → arc along ring road → spur → door. */
export function handoffPath(from: string, to: string): [number, number][] {
  const a = ROOM_POS[from], b = ROOM_POS[to]
  if (!a || !b) return []
  const doorR = RING_RADIUS - ROOM_D / 2 - 0.4
  const pts: [number, number][] = [ringPoint(a.angle, doorR), ringPoint(a.angle)]
  let d = b.angle - a.angle
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  const steps = Math.max(2, Math.ceil(Math.abs(d) / 0.12))
  for (let i = 1; i < steps; i++) pts.push(ringPoint(a.angle + (d * i) / steps))
  pts.push(ringPoint(b.angle), ringPoint(b.angle, doorR))
  return pts
}
