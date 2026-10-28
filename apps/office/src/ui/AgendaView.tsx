import { useMemo, useState } from 'react'
import { useHQ } from '../store'
import { EXP, faixas, nowBR, toMin } from '../lib/expediente'
import { markPosted } from '../lib/supabase'
import { Page } from './TasksView'
import type { ScheduleItem, ScheduleStatus } from '../data/types'

const DOW = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const DIAS_YAML = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom']
export const ST: Record<ScheduleStatus, { icon: string; label: string; cls: string }> = {
  planejado: { icon: '🗓️', label: 'planejado', cls: 'text-white/70' },
  pronto: { icon: '📁', label: 'pronto no Drive', cls: 'text-sky-200' },
  aprovado: { icon: '👍', label: 'aprovado', cls: 'text-amber-200' },
  postado: { icon: '✅', label: 'postado', cls: 'text-emerald-200' },
  atrasado: { icon: '⏰', label: 'atrasado', cls: 'text-rose-200' },
}

// Timeline from 04:00 to 24:00 (the silence window has no work, but the pets approval band crosses it).
const T0 = 4 * 60, T1 = 24 * 60
const pct = (m: number) => ((Math.min(Math.max(m, T0), T1) - T0) / (T1 - T0)) * 100

function weekOf(date: string) {
  const d = new Date(`${date}T12:00:00`)
  const monday = new Date(d); monday.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => { const x = new Date(monday); x.setDate(monday.getDate() + i); return x.toISOString().slice(0, 10) })
}

export function AgendaView() {
  const schedule = useHQ((s) => s.schedule)
  const { date: today, min: nowMin } = nowBR()
  const [mode, setMode] = useState<'semana' | 'dia'>('dia')
  const [day, setDay] = useState(today)
  const week = useMemo(() => weekOf(day), [day])
  const shift = (n: number) => { const d = new Date(`${day}T12:00:00`); d.setDate(d.getDate() + n * (mode === 'semana' ? 7 : 1)); setDay(d.toISOString().slice(0, 10)) }
  const days = mode === 'semana' ? week : [day]
  const todays = schedule.filter((s) => s.data === day).sort((a, b) => a.horario.localeCompare(b.horario))

  return (
    <Page title="Agenda" subtitle={`${Object.entries(EXP.paginas).map(([p, c]) => `${p} ${c.posts.length}/dia`).join(' · ')} · horário de Brasília`}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl bg-white/5 p-1 ring-1 ring-white/10">
          {(['dia', 'semana'] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} className={`rounded-lg px-3 py-1 text-xs font-medium capitalize ${mode === m ? 'bg-white/15 text-white' : 'text-white/55'}`}>{m}</button>
          ))}
        </div>
        <button onClick={() => shift(-1)} className="rounded-lg px-2 py-1 text-sm ring-1 ring-white/10 hover:bg-white/10">‹</button>
        <button onClick={() => setDay(today)} className="rounded-lg px-2.5 py-1 text-xs ring-1 ring-white/10 hover:bg-white/10">Hoje</button>
        <button onClick={() => shift(1)} className="rounded-lg px-2 py-1 text-sm ring-1 ring-white/10 hover:bg-white/10">›</button>
        <span className="font-mono text-xs text-white/60">{mode === 'dia' ? fmt(day) : `${fmt(week[0])} – ${fmt(week[6])}`}</span>
        <div className="ml-auto flex flex-wrap gap-3 text-[11px] text-white/60">
          {Object.entries(EXP.paginas).map(([p, c]) => <span key={p} className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: c.cor }} />{p}</span>)}
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-white/15" />turno de agente</span>
          {Object.values(ST).map((s) => <span key={s.label}>{s.icon} {s.label}</span>)}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="glass overflow-x-auto rounded-2xl p-3">
          <div className="flex min-w-[640px]">
            <Hours h={mode === 'dia' ? 1440 : 960} />
            {days.map((d) => (
              <DayColumn key={d} date={d} wide={mode === 'dia'} items={schedule.filter((s) => s.data === d)}
                nowMin={d === today ? nowMin : null} label={`${DOW[(new Date(`${d}T12:00:00`).getDay() + 6) % 7]} ${d.slice(8)}/${d.slice(5, 7)}`}
                onPick={mode === 'semana' ? () => { setDay(d); setMode('dia') } : undefined} />
            ))}
          </div>
        </div>

        <aside className="glass h-fit rounded-2xl p-4">
          <h3 className="text-sm font-bold">Relatório do dia</h3>
          <p className="mb-3 font-mono text-[10px] text-white/45">{fmt(day)} · social-scheduler</p>
          <div className="space-y-1.5">
            {todays.length === 0 && <p className="text-sm text-white/40">Nenhum post nesse dia.</p>}
            {todays.map((s) => <PostRow key={s.id} s={s} />)}
          </div>
        </aside>
      </div>
    </Page>
  )
}

function Hours({ h }: { h: number }) {
  return (
    <div className="relative mr-1 mt-6 w-10 shrink-0" style={{ height: h }}>
      {Array.from({ length: (T1 - T0) / 60 + 1 }, (_, i) => T0 + i * 60).map((m) => (
        <span key={m} className="absolute right-1 -translate-y-1/2 font-mono text-[10px] text-white/35" style={{ top: `${pct(m)}%` }}>{String(m / 60).padStart(2, '0')}:00</span>
      ))}
    </div>
  )
}

function DayColumn({ date, items, wide, nowMin, label, onPick }: { date: string; items: ScheduleItem[]; wide: boolean; nowMin: number | null; label: string; onPick?: () => void }) {
  const dow = DIAS_YAML[(new Date(`${date}T12:00:00`).getDay() + 6) % 7]
  const bands = faixas().filter((f) => !f.turno.dias || f.turno.dias.includes(dow))
  // lay bands in 2 lanes so overlapping ones (pets approval vs. worldframe) stay readable
  return (
    <div className={`relative flex-1 border-l border-white/5 ${wide ? 'min-w-[420px]' : 'min-w-[110px]'}`}>
      <button onClick={onPick} disabled={!onPick} className="sticky top-0 z-10 h-6 w-full text-center text-xs font-semibold text-white/80 enabled:hover:text-white">{label}</button>
      <div className="relative" style={{ height: wide ? 1440 : 960 }}>
        {Array.from({ length: (T1 - T0) / 60 + 1 }, (_, i) => (
          <div key={i} className="absolute inset-x-0 border-t border-white/5" style={{ top: `${(i / ((T1 - T0) / 60)) * 100}%` }} />
        ))}
        {bands.map(({ turno, ini, fim }, i) => {
          const lane = turno.humano ? 1 : 0
          const short = turno.agente === 'lucas' ? 'Lucas' : turno.agente
          return (
            <div key={`${turno.id}-${i}`} title={`${turno.faz} (${turno.inicio}–${turno.prazo})`}
              className={`absolute overflow-hidden rounded-md px-1.5 text-[10px] leading-tight ${turno.humano ? 'bg-amber-200/10 text-amber-100/70 ring-1 ring-amber-200/20' : 'bg-white/10 text-white/60 ring-1 ring-white/10'}`}
              style={{ top: `${pct(ini)}%`, height: `calc(${pct(fim) - pct(ini)}% - 2px)`, left: wide ? `${lane * 26}%` : `${lane * 50}%`, width: wide ? '25%' : '48%' }}>
              {wide ? <><b className="font-semibold">{short}</b> {turno.inicio}–{turno.prazo}{turno.pagina ? ` · ${turno.pagina}` : ''}</> : short.split('-')[0]}
            </div>
          )
        })}
        {items.map((s) => {
          const cor = EXP.paginas[s.pagina]?.cor ?? '#888'
          const st = ST[s.status] ?? ST.planejado
          return (
            <div key={s.id} className="absolute z-[2] rounded-lg px-2 py-1 shadow-lg"
              style={{ top: `calc(${pct(toMin(s.horario))}% - 14px)`, left: wide ? '54%' : '4%', right: '4%', background: `${cor}${s.status === 'postado' ? '99' : 'dd'}`, border: `1px solid ${cor}` }}>
              <div className="flex items-center gap-1 font-mono text-[10px] text-white">
                <span>{st.icon}</span><b>{s.horario}</b>{wide && <span className="truncate opacity-90">· {s.pagina} · {s.titulo}</span>}
                {wide && (
                  <span className="ml-auto flex items-center gap-1">
                    {s.drive_url && <a href={s.drive_url} target="_blank" rel="noreferrer" className="rounded bg-black/30 px-1.5 hover:bg-black/50">▶ vídeo</a>}
                    {s.status !== 'postado' && s.status !== 'planejado' && <button onClick={() => markPosted(s.id)} className="rounded bg-black/30 px-1.5 hover:bg-black/50">marcar como postado</button>}
                  </span>
                )}
              </div>
              {wide && <div className="text-[10px] text-white/85">{st.label}</div>}
            </div>
          )
        })}
        {nowMin != null && nowMin >= T0 && (
          <div className="absolute inset-x-0 z-[3] border-t-2 border-rose-400" style={{ top: `${pct(nowMin)}%` }}>
            <span className="absolute -left-1 -top-1.5 h-3 w-3 rounded-full bg-rose-400" />
          </div>
        )}
      </div>
    </div>
  )
}

function PostRow({ s }: { s: ScheduleItem }) {
  const st = ST[s.status] ?? ST.planejado
  return (
    <div className="rounded-lg bg-white/5 px-2.5 py-1.5 ring-1 ring-white/5">
      <div className="flex items-center gap-2 font-mono text-[11px]">
        <span className="h-2 w-2 rounded-full" style={{ background: EXP.paginas[s.pagina]?.cor }} />
        <span className="text-white">{s.horario}</span>
        <span className="flex-1 truncate text-white/70">{s.pagina} · {s.titulo}</span>
        <span className={st.cls}>{st.icon}</span>
      </div>
      <div className="mt-1 flex items-center gap-2 pl-4 text-[10px]">
        <span className={st.cls}>{st.label}</span>
        {s.drive_url && <a href={s.drive_url} target="_blank" rel="noreferrer" className="text-sky-300 hover:underline">vídeo ↗</a>}
        {s.status !== 'postado' && s.status !== 'planejado' && (
          <button onClick={() => markPosted(s.id)} className="ml-auto rounded bg-emerald-400/20 px-1.5 py-0.5 text-emerald-200 hover:bg-emerald-400/30">marcar como postado</button>
        )}
      </div>
    </div>
  )
}

const fmt = (d: string) => `${d.slice(8)}/${d.slice(5, 7)}`
