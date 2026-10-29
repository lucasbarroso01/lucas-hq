import { useHQ } from '../store'
import type { HQEvent, Task } from '../data/types'
import { SCHEDULE } from '../data/seed'

const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]
let seq = 0
const ev = (e: Omit<HQEvent, 'id' | 'ts'>): HQEvent => ({ ...e, id: `demo-${seq++}`, ts: new Date().toISOString() })

export const WF_STEPS = ['CORTE', 'LEGENDAS', 'CAPA', 'CHECK']

const PIPELINE: [string, string, string][] = [
  ['radar', 'roteiros', 'Radar · 5 temas novos para Roteiros'],
  ['roteiros', 'producao-wf', 'Roteiros · 5 ganchos prontos para quinta'],
  ['producao-wf', 'qualidade', 'Produção · wf_02.mp4 pronto para QA'],
  ['qualidade', 'social', 'Qualidade · wf_02 aprovado (nota 9)'],
  ['qualidade', 'producao-wf', 'Qualidade · devolvido: legenda saindo da borda'],
  ['social', 'analytics', 'Social · relatório do dia com horários'],
  ['radar', 'producao-pets', 'Radar · viral de pets na pasta de modelagem'],
  ['inbox-b2b', 'criacao-b2b', 'Inbox B2B · briefing Clínica Sorriso pronto'],
  ['analytics', 'roteiros', 'Analytics · ganchos com pergunta tiveram 2x views'],
]
const NOTES = [
  "tema 'cidades submersas' já usado", 'legenda: máx. 3 palavras por linha', 'gancho de 2s com número performa melhor',
  'Funny Pets: sem fala, câmera tremida', 'cliente prefere tom leve', 'wf_04 teve 48k views',
]
const DOING: Record<string, string[]> = {
  radar: ['escaneando tendências', 'lendo pasta de modelagem'],
  roteiros: ['escrevendo ganchos', 'revisando beat sheet'],
  'producao-wf': ['dividindo 5 vídeos', 'conferindo sub-agentes'],
  'producao-pets': ['montando cenas', 'aguardando aprovação'],
  qualidade: ['lendo frames.jpg', 'dando nota'],
  social: ['subindo no Drive', 'definindo horários'],
  analytics: ['registrando views', 'escrevendo lições'],
  'inbox-b2b': ['lendo pedido do cliente'],
  'criacao-b2b': ['criando formatos', 'escrevendo roteiro B2B'],
}

/** Fake but coherent activity so the office is alive without real agents (?demo=1). */
export function startDemo() {
  const hq = useHQ.getState()
  hq.set({ live: 'demo', schedule: SCHEDULE })
  ;(window as any).__hq = useHQ
  // Five parallel video-editor sub-agents in Produção Worldframe.
  const subs: Task[] = Array.from({ length: 5 }, (_, i) => ({
    id: `sub-${i + 1}`, team_id: 'producao-wf', agent_id: 'video-editor', operacao: 'maquina-viral',
    titulo: `wf_0${i + 1}.mp4`, etapa: WF_STEPS[0], status: 'running', progress: i * 6, parent_id: 'wf-batch',
    payload: { notes: `Título: wf_0${i + 1}\nGancho: "Essa cidade some do mapa toda noite"\nDuração: 38s\nLegenda: Você sabia? 🌍 #curiosidades` },
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }))
  subs.forEach(hq.upsertTask)

  const tick = () => {
    const s = useHQ.getState()
    if (s.pausa.pausado) return   // operação pausada: ninguém trabalha
    const r = Math.random()
    if (r < 0.28) {
      const [from, to, text] = pick(PIPELINE)
      s.ingestEvent(ev({ team_id: from, agent_id: null, type: 'handoff', payload: { to_team: to, text } }))
    } else if (r < 0.62) {
      const team = pick(s.teams).id
      const write = Math.random() < 0.5
      s.ingestEvent(ev({ team_id: team, agent_id: null, type: write ? 'brain_write' : 'brain_read', payload: { note: pick(NOTES) } }))
    } else {
      s.ingestEvent(ev({ team_id: pick(s.teams).id, agent_id: null, type: 'tool_run', payload: { tool: pick(['cut.py', 'captions.py', 'thumbnail.py', 'frames.py']) } }))
    }
    // agents flip between working/idle; keep ~60% busy
    for (const a of s.agents) {
      if (Math.random() < 0.15) {
        const working = Math.random() < 0.6
        s.upsertAgent({ ...a, status: working ? 'working' : 'idle', doing_now: working ? pick(DOING[a.team_id] ?? ['trabalhando']) : 'ocioso' })
      }
    }
    // skills
    for (const k of s.skills) {
      if (k.state === 'running') {
        const p = k.progress + 4 + Math.random() * 10
        s.upsertSkill(p >= 100 ? { ...k, progress: 0, state: 'idle' } : { ...k, progress: p })
      } else if (Math.random() < 0.08) s.upsertSkill({ ...k, state: 'running', progress: 2 })
    }
    // tasks & sub-agents progress
    for (const t of s.tasks) {
      if (t.status !== 'running') continue
      const p = Math.min(100, t.progress + 2 + Math.random() * 6)
      if (t.parent_id === 'wf-batch') {
        const etapa = p >= 100 ? WF_STEPS[3] : WF_STEPS[Math.min(3, Math.floor(p / 25))]
        if (etapa !== t.etapa || p >= 100) s.ingestEvent(ev({ team_id: t.team_id, agent_id: 'video-editor', type: 'tool_run', payload: { task: t.id, text: p >= 100 ? `${t.titulo} pronto · frames.jpg conferido` : `${etapa} · ${t.titulo}` } }))
        s.upsertTask({ ...t, progress: p >= 100 ? 0 : p, etapa: p >= 100 ? WF_STEPS[0] : etapa, updated_at: new Date().toISOString() })
      } else if (p >= 100) {
        s.upsertTask({ ...t, progress: 100, status: 'done', drive_url: 'https://drive.google.com', updated_at: new Date().toISOString() })
        s.pushToast(t.team_id, `${t.titulo} · concluído`)
      } else s.upsertTask({ ...t, progress: p, updated_at: new Date().toISOString() })
    }
  }
  tick()
  return window.setInterval(tick, 1800)
}
