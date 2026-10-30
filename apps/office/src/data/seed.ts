import type { Agent, ScheduleItem, SkillRuntime, Task, Team } from './types'
import { EXP, PAGINAS, nowBR, toMin } from '../lib/expediente'

export const TEAMS: Team[] = [
  { id: 'radar', nome: 'Radar', cor: '#3B6FE0', operacao: 'maquina-viral', icon: '📡',
    skills: ['temas.yaml', 'ig-viral'], tools: ['WebSearch', 'Cérebro', 'Acervo'] },
  { id: 'roteiros', nome: 'Roteiros', cor: '#E9B23A', operacao: 'maquina-viral', icon: '✍️',
    skills: ['ig-reel', 'faceless-video-direction', 'hypit-video', 'conector'], tools: ['Cérebro', 'Acervo'] },
  { id: 'producao-wf', nome: 'Produção Worldframe', cor: '#7B5CE0', operacao: 'maquina-viral', icon: '🎬',
    skills: ['hyperframes-video', 'hypit-video'],
    tools: ['produzir.py', 'Kokoro', 'Google Drive'] },
  { id: 'acervo', nome: 'Acervo de Virais', cor: '#E5893B', operacao: 'maquina-viral', icon: '🗂️',
    skills: ['hypit-video', 'ig-viral'], tools: ['tools/acervo.py', 'Cérebro'] },
  { id: 'qualidade', nome: 'Qualidade', cor: '#2BB673', operacao: 'maquina-viral', icon: '✅',
    skills: ['contact-sheet-qa'], tools: ['tools/frames.py', 'Cérebro'] },
  { id: 'social', nome: 'Social & Agenda', cor: '#D94BC8', operacao: 'maquina-viral', icon: '📅',
    skills: ['instagram-marketing'], tools: ['Google Drive', 'Supabase'] },
  { id: 'analytics', nome: 'Analytics', cor: '#22B8C9', operacao: 'maquina-viral', icon: '📈',
    skills: ['views-report'], tools: ['Cérebro', 'Supabase'] },
  { id: 'inbox-b2b', nome: 'Inbox B2B', cor: '#D9474B', operacao: 'agencia-lucas', icon: '📥',
    skills: ['briefing'], tools: ['Google Drive', 'Cérebro'] },
  { id: 'criacao-b2b', nome: 'Criação B2B', cor: '#9A5CF0', operacao: 'agencia-lucas', icon: '💡',
    skills: ['ig-reel-scripts', 'copy-humana'], tools: ['Google Drive', 'Cérebro'] },
]

const a = (id: string, team_id: string, papel: string, is_lead = false, doing_now = 'aguardando tarefa'): Agent =>
  ({ id, team_id, nome: id, papel, is_lead, status: 'idle', doing_now })

export const AGENTS: Agent[] = [
  a('radar-worldframe', 'radar', 'Pesquisa temas virais (Worldframe)', true),
  a('roteirista-lead', 'roteiros', 'Líder de roteiros', true),
  a('roteirista', 'roteiros', 'Sub-agente de ganchos'),
  a('editor-lead', 'producao-wf', 'Divide os 5 vídeos em sub-agentes', true),
  a('video-editor', 'producao-wf', 'Editor (corte, legenda, capa)'),
  a('curador-acervo', 'acervo', 'Ficha os virais que o Lucas manda (copy, tema, edição)', true),
  a('brand-checker', 'qualidade', 'QA pela folha de contato (nota ≥ 8)', true),
  a('social-scheduler', 'social', 'Sobe no Drive e define horários', true),
  a('analista', 'analytics', 'Registra views e lições', true),
  a('briefing', 'inbox-b2b', 'Transforma pedido em briefing', true),
  a('roteirista-b2b', 'criacao-b2b', 'Roteiros e formatos para clientes', true),
]

const now = Date.now()
const iso = (minAgo: number) => new Date(now - minAgo * 60000).toISOString()

export const TASKS: Task[] = [
  { id: 't1', team_id: 'roteiros', agent_id: 'roteirista-lead', operacao: 'maquina-viral', titulo: '5 ganchos Worldframe · quinta',
    etapa: 'GANCHOS', status: 'running', progress: 62, created_at: iso(40), updated_at: iso(2) },
  { id: 't2', team_id: 'acervo', agent_id: 'curador-acervo', operacao: 'maquina-viral', titulo: 'Acervo · 5 virais da semana',
    etapa: 'FICHAS', status: 'running', progress: 40, created_at: iso(90), updated_at: iso(20) },
  { id: 't3', team_id: 'social', agent_id: 'social-scheduler', operacao: 'maquina-viral', titulo: 'Worldframe · 5 vídeos de hoje no Drive',
    etapa: 'APROVAÇÃO', status: 'waiting', progress: 95, drive_url: 'https://drive.google.com', created_at: iso(200), updated_at: iso(30) },
  { id: 't4', team_id: 'qualidade', agent_id: 'brand-checker', operacao: 'maquina-viral', titulo: 'QA wf_03.mp4',
    etapa: 'CHECK', status: 'done', progress: 100, qa_score: 9, drive_url: 'https://drive.google.com', created_at: iso(180), updated_at: iso(120) },
  { id: 't5', team_id: 'inbox-b2b', agent_id: 'briefing', operacao: 'agencia-lucas', titulo: 'Briefing · Clínica Sorriso',
    etapa: 'BRIEFING', status: 'done', progress: 100, drive_url: 'https://drive.google.com', created_at: iso(300), updated_at: iso(150) },
  { id: 't6', team_id: 'radar', agent_id: 'radar-worldframe', operacao: 'maquina-viral', titulo: 'Varredura de temas · amanhã',
    etapa: 'SCAN', status: 'running', progress: 35, created_at: iso(15), updated_at: iso(1) },
]

function weekDays() {
  const d = new Date(); const day = (d.getDay() + 6) % 7
  const monday = new Date(d); monday.setDate(d.getDate() - day)
  return Array.from({ length: 7 }, (_, i) => { const x = new Date(monday); x.setDate(monday.getDate() + i); return x.toISOString().slice(0, 10) })
}
const today = new Date().toISOString().slice(0, 10)
const br = nowBR()
/** Semana de exemplo: horários vêm de config/expediente.yaml. */
export const SCHEDULE: ScheduleItem[] = weekDays().flatMap((data) =>
  PAGINAS.flatMap((pagina) => EXP.paginas[pagina].posts.map((horario, i) => {
    // dia de exemplo coerente com o relógio: passado postado (um atrasado), próximo pronto/aprovado, resto planejado
    const past = toMin(horario) <= br.min
    const status: ScheduleItem['status'] = data < br.date ? 'postado' : data > br.date ? 'planejado'
      : past ? (i === 1 ? 'atrasado' : 'postado') : i % 2 ? 'aprovado' : i < 4 ? 'pronto' : 'planejado'
    const titulo = `wf_0${i + 1}.mp4`
    return { id: `${pagina}-${data}-${horario}`, data, pagina, horario, task_id: null, titulo, status,
      drive_url: status === 'planejado' ? null : 'https://drive.google.com' }
  })),
)

export const SKILLS: SkillRuntime[] = TEAMS.flatMap((t) => t.skills.map((skill) => ({ team_id: t.id, skill, progress: 0, state: 'idle' as const })))

export const BRAIN_NOTES = 128
