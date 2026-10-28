import { useHQ } from '../store'
import { RING_RADIUS, ROAD_RADIUS, ROOM_POS } from '../lib/layout'

const SIZE = 150
const WORLD = (RING_RADIUS + 8) * 2
// world (x,z) → minimap px, rotated 45° so it matches the isometric view
function toMap(x: number, z: number): [number, number] {
  const c = Math.SQRT1_2
  const u = (x - z) * c, v = (x + z) * c
  return [SIZE / 2 + (u / WORLD) * SIZE, SIZE / 2 + (v / WORLD) * SIZE]
}

export function MiniMap() {
  const { teams, camera, agents } = useHQ()
  const [cx, cy] = toMap(camera.x, camera.z)
  // visible ground area of the ortho camera (vertical is stretched by the iso tilt)
  const px = 21 * camera.zoom
  const w = Math.min(SIZE, (innerWidth / px / WORLD) * SIZE), h = Math.min(SIZE, ((innerHeight / px) * 1.73 / WORLD) * SIZE)
  const fly = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const u = ((e.clientX - r.left - SIZE / 2) / SIZE) * WORLD, v = ((e.clientY - r.top - SIZE / 2) / SIZE) * WORLD
    const c = Math.SQRT1_2
    window.dispatchEvent(new CustomEvent('hq:fly', { detail: { x: (u + v) * c, z: (v - u) * c } }))
  }
  return (
    <div className="glass absolute bottom-4 right-4 z-20 rounded-2xl p-2.5">
      <svg width={SIZE} height={SIZE} onClick={fly} className="cursor-crosshair">
        <circle cx={SIZE / 2} cy={SIZE / 2} r={(SIZE / WORLD) * ROAD_RADIUS} fill="none" stroke="#2c3350" strokeWidth={4} />
        <circle cx={SIZE / 2} cy={SIZE / 2} r={6} fill="#7cc8ff" style={{ filter: 'drop-shadow(0 0 6px #7cc8ff)' }} />
        {teams.map((t) => {
          const p = ROOM_POS[t.id]
          const [x, y] = toMap(p.x, p.z)
          const busy = agents.some((a) => a.team_id === t.id && a.status === 'working')
          return <rect key={t.id} x={x - 7} y={y - 7} width={14} height={14} rx={3} fill={t.cor} opacity={busy ? 1 : 0.5} transform={`rotate(45 ${x} ${y})`} />
        })}
        <rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} fill="#ffffff10" stroke="#fff" strokeOpacity={0.8} strokeWidth={1.2} rx={3} />
      </svg>
      <div className="mt-1 flex justify-between font-mono text-[10px] text-white/50">
        <span>MAPA</span><span>{Math.round(camera.zoom * 100)}%</span>
      </div>
    </div>
  )
}
