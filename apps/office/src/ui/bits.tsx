import { useMemo } from 'react'

export function Sparkline({ color, seed, w = 90, h = 26 }: { color: string; seed: number; w?: number; h?: number }) {
  const d = useMemo(() => {
    let r = seed * 7919 + 17
    const pts = Array.from({ length: 14 }, (_, i) => {
      r = (r * 9301 + 49297) % 233280
      return [(i / 13) * w, h - 3 - (r / 233280) * (h - 6) * (0.4 + i / 22)]
    })
    return 'M' + pts.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' L')
  }, [seed, w, h])
  return (
    <svg width={w} height={h}>
      <defs>
        <linearGradient id={`g${seed}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity={0.4} /><stop offset="1" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={`${d} L${w},${h} L0,${h} Z`} fill={`url(#g${seed})`} />
      <path d={d} fill="none" stroke={color} strokeWidth={1.6} />
    </svg>
  )
}

export function Ring({ value, color, size = 44 }: { value: number; color: string; size?: number }) {
  const r = size / 2 - 4, c = 2 * Math.PI * r
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} stroke="#ffffff18" strokeWidth={4} fill="none" />
      <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={4} fill="none" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} style={{ transition: 'stroke-dashoffset .6s' }} />
      <text x="50%" y="50%" transform={`rotate(90 ${size / 2} ${size / 2})`} textAnchor="middle" dominantBaseline="central"
        className="fill-white font-mono text-[10px] font-bold">{Math.round(value)}%</text>
    </svg>
  )
}

export function ago(iso: string) {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (m < 1) return 'agora'
  if (m < 60) return `há ${m}min`
  return `há ${Math.round(m / 60)}h`
}
