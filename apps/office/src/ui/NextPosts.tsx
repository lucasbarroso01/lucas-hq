import { useEffect, useRef, useState } from 'react'
import { useHQ } from '../store'
import { EXP, nowBR, toMin } from '../lib/expediente'
import { ST } from './AgendaView'

const AVISO = EXP.limites.aviso_antes_post_min

function useNow() {
  const [n, setN] = useState(nowBR)
  useEffect(() => { const t = setInterval(() => setN(nowBR()), 1000); return () => clearInterval(t) }, [])
  return n
}

const countdown = (secs: number) => {
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60
  return h ? `${h}h ${String(m).padStart(2, '0')}min` : `${m}min ${String(s).padStart(2, '0')}s`
}

/** Painel da tela Office: posts de hoje com contagem regressiva para o próximo. */
export function NextPosts() {
  const schedule = useHQ((s) => s.schedule)
  const now = useNow()
  const nowSec = now.min * 60 + now.sec
  const today = schedule.filter((s) => s.data === now.date).sort((a, b) => a.horario.localeCompare(b.horario))
  const upcoming = today.filter((s) => toMin(s.horario) * 60 > nowSec && s.status !== 'postado')
  const next = upcoming[0]
  return (
    <div className="glass absolute bottom-4 left-4 z-20 w-[270px] rounded-2xl p-3">
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-white/55">Próximos posts de hoje</h3>
        <span className="font-mono text-[10px] text-white/35">Brasília</span>
      </div>
      {next ? (
        <div className="mb-2 rounded-xl px-3 py-2" style={{ background: `${EXP.paginas[next.pagina].cor}33`, border: `1px solid ${EXP.paginas[next.pagina].cor}88` }}>
          <div className="font-mono text-[10px] text-white/70">próximo em</div>
          <div className="font-mono text-2xl font-bold tabular-nums">{countdown(toMin(next.horario) * 60 - nowSec)}</div>
          <div className="truncate text-[12px] text-white/85">{next.horario} · {next.pagina} · {next.titulo}</div>
        </div>
      ) : <p className="mb-2 text-sm text-white/40">Nenhum post restante hoje.</p>}
      <div className="space-y-1">
        {today.map((s) => {
          const past = toMin(s.horario) * 60 <= nowSec
          return (
            <div key={s.id} className={`flex items-center gap-2 font-mono text-[11px] ${past && s.status !== 'postado' ? 'text-rose-200' : past ? 'text-white/35' : 'text-white/80'}`}>
              <span className="h-2 w-2 rounded-full" style={{ background: EXP.paginas[s.pagina]?.cor }} />
              <span>{s.horario}</span>
              <span className="flex-1 truncate">{s.titulo}</span>
              <span title={ST[s.status]?.label}>{ST[s.status]?.icon}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** "Hora de postar" 15 min antes de cada post: toast e, se permitido, notificação do navegador. */
export function PostAlarm() {
  const schedule = useHQ((s) => s.schedule)
  const pushToast = useHQ((s) => s.pushToast)
  const fired = useRef(new Set<string>())
  useEffect(() => {
    const check = () => {
      const { date, min } = nowBR()
      for (const s of schedule) {
        if (s.data !== date || s.status === 'postado' || fired.current.has(s.id)) continue
        const left = toMin(s.horario) - min
        if (left <= AVISO && left >= 0) {
          fired.current.add(s.id)
          const text = `Hora de postar: ${s.titulo} · ${s.pagina}`
          pushToast(null, `${text} (${s.horario})`)
          try { if ('Notification' in window && Notification.permission === 'granted') new Notification('Lucas HQ', { body: `${text} às ${s.horario}` }) } catch { /* ignore */ }
        }
      }
    }
    check()
    const t = setInterval(check, 30_000)
    return () => clearInterval(t)
  }, [schedule, pushToast])
  return null
}
