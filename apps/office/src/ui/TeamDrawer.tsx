import { useState } from 'react'
import { motion } from 'framer-motion'
import { useHQ, teamById } from '../store'
import { WF_STEPS } from '../lib/demo'
import { Sparkline, Ring, ago } from './bits'
import { decide } from '../lib/supabase'

const TABS = ['Visão geral', 'Tarefas', 'Agenda', 'Configurações'] as const

export function TeamDrawer({ teamId }: { teamId: string }) {
  const team = teamById(teamId)!
  const { agents: all, tasks: allTasks, skills: allSkills, schedule, events, set } = useHQ()
  const [tab, setTab] = useState<(typeof TABS)[number]>('Visão geral')
  const agents = all.filter((a) => a.team_id === teamId)
  const tasks = allTasks.filter((t) => t.team_id === teamId)
  const subs = tasks.filter((t) => t.parent_id && t.status === 'running').sort((a, b) => a.titulo.localeCompare(b.titulo))
  const skills = allSkills.filter((k) => k.team_id === teamId)
  const lead = agents.find((a) => a.is_lead)
  const runningSkills = skills.filter((k) => k.state === 'running').length
  const toolRuns = events.filter((e) => e.team_id === teamId && e.type === 'tool_run').length
  const today = new Date().toISOString().slice(0, 10)
  const doneToday = tasks.filter((t) => t.status === 'done' && t.updated_at.slice(0, 10) === today).length

  return (
    <motion.aside initial={{ x: 460, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 460, opacity: 0 }} transition={{ type: 'spring', damping: 28, stiffness: 260 }}
      className="glass absolute bottom-3 right-3 top-[76px] z-30 flex w-[min(430px,calc(100vw-24px))] flex-col overflow-hidden rounded-2xl">
      <div className="relative px-5 pb-3 pt-4" style={{ background: `linear-gradient(135deg, ${team.cor}33, transparent 70%)` }}>
        <button onClick={() => set({ selectedTeam: null })} className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-lg text-white/60 hover:bg-white/10">✕</button>
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl text-xl" style={{ background: team.cor, boxShadow: `0 0 22px ${team.cor}88` }}>{team.icon}</div>
          <div>
            <h2 className="text-lg font-bold leading-tight">{team.nome}</h2>
            <p className="font-mono text-[11px] text-white/55">{agents.length + subs.length} agentes · líder: {lead?.nome ?? '—'}</p>
          </div>
        </div>
        <div className="mt-4 flex gap-1">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`rounded-lg px-2.5 py-1 text-xs font-medium ${tab === t ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white'}`}>{t}</button>
          ))}
        </div>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-5 pb-6 pt-2 scroll-thin">
        {tab === 'Visão geral' && (
          <>
            <div className="grid grid-cols-3 gap-2">
              {[['Tarefas hoje', String(tasks.length + doneToday)], ['Rodando', String(tasks.filter((t) => t.status === 'running').length)], ['Entrega média', `${18 + team.id.length}min`]].map(([k, v], i) => (
                <div key={k} className="rounded-xl bg-white/5 p-2.5 ring-1 ring-white/5">
                  <div className="text-[10px] uppercase tracking-wide text-white/45">{k}</div>
                  <div className="font-mono text-lg font-bold">{v}</div>
                  <Sparkline color={team.cor} seed={i + team.id.length} w={100} />
                </div>
              ))}
            </div>

            <Section title="Ferramentas conectadas">
              <div className="grid grid-cols-2 gap-2">
                {team.tools.map((tool, i) => (
                  <div key={tool} className="rounded-xl bg-white/5 p-2.5 ring-1 ring-white/5">
                    <div className="text-[13px] font-semibold">{toolIcon(tool)} {tool}</div>
                    <div className="mt-1 flex justify-between font-mono text-[10px]">
                      <span className="text-emerald-300">● Conectado · MCP</span>
                      <span className="text-white/45">{i === 0 ? toolRuns : Math.floor(toolRuns / 2)} ao vivo</span>
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            <Section title="Skills" right={`${runningSkills} rodando em paralelo`}>
              <div className="space-y-2">
                {skills.map((k) => (
                  <div key={k.skill}>
                    <div className="mb-1 flex justify-between font-mono text-[11px]">
                      <span className="text-white/80">{k.skill}</span>
                      <span className={k.state === 'running' ? 'text-white' : 'text-white/35'}>{k.state === 'running' ? `${Math.round(k.progress)}%` : 'idle'}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/8 bg-white/10">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${k.state === 'running' ? k.progress : 0}%`, background: team.cor, boxShadow: `0 0 8px ${team.cor}` }} />
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            {subs.length > 0 && (
              <Section title="Sub-agentes em paralelo" right={`${subs.length} contextos isolados`}>
                <div className="space-y-1.5">
                  {subs.map((t, i) => {
                    const step = WF_STEPS.indexOf(t.etapa)
                    return (
                      <motion.div key={t.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                        className="rounded-xl bg-white/5 px-3 py-2 ring-1 ring-white/5">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[11px]">Sub-agente {i + 1} · <span className="text-white/60">{t.titulo}</span></span>
                          <span className="font-mono text-[10px] text-white/45">{Math.round(t.progress)}%</span>
                        </div>
                        <div className="mt-1.5 flex gap-1">
                          {WF_STEPS.map((s, j) => (
                            <span key={s} className="chip transition-colors duration-500"
                              style={j <= step ? { background: `${team.cor}33`, borderColor: team.cor, color: '#fff' } : { borderColor: '#ffffff1a', color: '#ffffff55' }}>
                              {s}
                            </span>
                          ))}
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              </Section>
            )}

            <Section title="Agentes">
              <div className="space-y-1.5">
                {agents.map((a) => (
                  <div key={a.id} className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2 ring-1 ring-white/5">
                    <span className="avatar !h-8 !w-8 !text-xs" style={{ background: team.cor }}>{a.nome[0].toUpperCase()}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[12px] font-semibold">{a.nome}</span>
                        {a.is_lead && <span className="rounded bg-amber-300/20 px-1 font-mono text-[9px] font-bold text-amber-200">LEAD</span>}
                      </div>
                      <div className="truncate text-[11px] text-white/50">{a.papel}</div>
                      <div className="truncate text-[11px] text-white/80">→ {a.doing_now}</div>
                    </div>
                    <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium ${a.status === 'working' ? 'bg-emerald-400/15 text-emerald-300' : 'bg-white/10 text-white/45'}`}>
                      {a.status === 'working' ? 'trabalhando' : 'ocioso'}
                    </span>
                  </div>
                ))}
              </div>
            </Section>
          </>
        )}

        {tab === 'Tarefas' && (
          <div className="space-y-2 pt-2">
            {tasks.length === 0 && <p className="text-sm text-white/45">Nenhuma tarefa.</p>}
            {tasks.map((t) => (
              <div key={t.id} onClick={() => set({ detailTask: t.id })} className="flex cursor-pointer items-center gap-3 rounded-xl bg-white/5 p-3 ring-1 ring-white/5 hover:bg-white/10">
                {t.status === 'done' ? <span className="grid h-11 w-11 place-items-center text-xl text-emerald-400">✓</span> : <Ring value={t.progress} color={team.cor} />}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium">{t.titulo}</div>
                  <div className="font-mono text-[10px] text-white/45">{t.etapa} · {t.status} · {ago(t.updated_at)}</div>
                </div>
                {t.status === 'waiting' && <button onClick={(e) => { e.stopPropagation(); decide(t.id, 'approved') }} className="rounded-lg bg-amber-400 px-2.5 py-1 text-xs font-bold text-night-950">Aprovar</button>}
              </div>
            ))}
          </div>
        )}

        {tab === 'Agenda' && (
          <div className="space-y-1.5 pt-2">
            {(teamId === 'social' || teamId.startsWith('producao') ? schedule.filter((s) => s.data === today) : []).map((s) => (
              <div key={s.id} className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2 font-mono text-xs">
                <span className="text-white">{s.horario}</span><span className="text-white/60">{s.pagina}</span><span className="flex-1 text-white/80">{s.titulo}</span><span className="text-white/45">{s.status}</span>
              </div>
            ))}
            {!(teamId === 'social' || teamId.startsWith('producao')) && <p className="text-sm text-white/45">Este time não tem posts agendados.</p>}
          </div>
        )}

        {tab === 'Configurações' && (
          <div className="space-y-3 pt-2 font-mono text-[11px] text-white/70">
            <p>Arquivo dos agentes: <span className="text-white">.claude/agents/{agents.map((a) => a.nome).join('.md, ')}.md</span></p>
            <p>Operação: <span className="text-white">{team.operacao}</span></p>
            <p>Regras no cérebro: <span className="text-white">{team.id === 'acervo' ? 'acervo-virais' : team.operacao === 'agencia-lucas' ? 'cliente-*' : 'regras-worldframe'}</span></p>
            <p>Aprovação humana: <span className="text-amber-200">{team.id === 'social' ? 'obrigatória' : 'não'}</span></p>
          </div>
        )}
      </div>
    </motion.aside>
  )
}

function Section({ title, right, children }: { title: string; right?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-white/50">{title}</h3>
        {right && <span className="font-mono text-[10px] text-white/40">{right}</span>}
      </div>
      {children}
    </section>
  )
}

function toolIcon(t: string) {
  if (t.includes('Drive')) return '🟢'
  if (t.includes('Higgsfield')) return '🎞️'
  if (t.includes('Cérebro')) return '🧠'
  if (t.includes('Supabase')) return '⚡'
  return '🛠️'
}
