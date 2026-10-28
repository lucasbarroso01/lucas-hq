import { useHQ } from '../store'
import { Page } from './TasksView'

const DOW = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const ST = {
  pronto: ['bg-sky-400/15 text-sky-200 ring-sky-400/30', 'pronto no Drive'],
  aguardando: ['bg-amber-400/15 text-amber-200 ring-amber-400/30', 'aguardando'],
  postado: ['bg-emerald-400/15 text-emerald-200 ring-emerald-400/30', 'postado'],
} as const

export function AgendaView() {
  const schedule = useHQ((s) => s.schedule)
  const days = [...new Set(schedule.map((s) => s.data))].sort().slice(0, 7)
  const today = new Date().toISOString().slice(0, 10)
  const todays = schedule.filter((s) => s.data === today).sort((a, b) => a.horario.localeCompare(b.horario))
  return (
    <Page title="Agenda" subtitle="Worldframe 5/dia · Funny Pets 1/dia">
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="grid grid-cols-7 gap-1.5 overflow-x-auto">
          {days.map((d, i) => (
            <div key={d} className={`min-w-[110px] rounded-2xl p-2 ring-1 ${d === today ? 'bg-white/[.07] ring-sky-300/40' : 'bg-white/[.03] ring-white/10'}`}>
              <div className="mb-2 flex items-baseline justify-between px-1">
                <span className="text-xs font-semibold">{DOW[i]}</span>
                <span className="font-mono text-[10px] text-white/40">{d.slice(8)}/{d.slice(5, 7)}</span>
              </div>
              <div className="space-y-1">
                {schedule.filter((s) => s.data === d).sort((a, b) => a.horario.localeCompare(b.horario)).map((s) => (
                  <div key={s.id} className={`rounded-lg px-1.5 py-1 ring-1 ${ST[s.status][0]}`}>
                    <div className="flex justify-between font-mono text-[10px]"><span>{s.horario}</span><span>{s.pagina === 'Worldframe' ? '🌍' : '🐶'}</span></div>
                    <div className="truncate text-[10.5px] opacity-80">{s.titulo}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <aside className="glass h-fit rounded-2xl p-4">
          <h3 className="text-sm font-bold">Relatório do dia</h3>
          <p className="mb-3 font-mono text-[10px] text-white/45">{today} · social-scheduler</p>
          <div className="space-y-1.5">
            {todays.map((s) => (
              <div key={s.id} className="flex items-center gap-2 font-mono text-[11px]">
                <span className="text-white">{s.horario}</span>
                <span className="flex-1 truncate text-white/70">{s.pagina} · {s.titulo}</span>
                <span className={`rounded px-1 text-[9px] ring-1 ${ST[s.status][0]}`}>{ST[s.status][1]}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-3 text-[10px] text-white/50">
            {Object.entries(ST).map(([k, [c, l]]) => <span key={k} className="flex items-center gap-1"><span className={`h-2 w-2 rounded-full ring-1 ${c}`} />{l}</span>)}
          </div>
        </aside>
      </div>
    </Page>
  )
}
