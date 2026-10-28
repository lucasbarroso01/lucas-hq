export type Operation = 'maquina-viral' | 'agencia-lucas'
export type TaskStatus = 'na_fila' | 'running' | 'waiting' | 'waiting_upstream' | 'done' | 'error' | 'atrasado'
export type EventType = 'handoff' | 'brain_read' | 'brain_write' | 'tool_run' | 'toast'

export interface Team {
  id: string
  nome: string
  cor: string
  operacao: Operation
  icon: string
  skills: string[]
  tools: string[]
}

export interface Agent {
  id: string
  team_id: string
  nome: string
  papel: string
  is_lead: boolean
  status: 'working' | 'idle'
  doing_now: string
}

export interface Task {
  id: string
  team_id: string
  agent_id: string | null
  operacao: Operation
  titulo: string
  etapa: string
  status: TaskStatus
  progress: number
  drive_url?: string | null
  post_time?: string | null
  qa_score?: number | null
  parent_id?: string | null
  payload?: { scenes?: string[]; notes?: string; drive_folder?: string } | null
  created_at: string
  updated_at: string
}

export interface HQEvent {
  id: string
  ts: string
  team_id: string | null
  agent_id: string | null
  type: EventType
  payload: { text?: string; to_team?: string; note?: string; tool?: string; task?: string; [k: string]: unknown }
}

export interface Approval { task_id: string; decision: 'approved' | 'changes'; feedback?: string; ts: string }

export interface ScheduleItem {
  id: string
  data: string // YYYY-MM-DD
  pagina: 'Worldframe' | 'Funny Pets'
  horario: string // HH:MM
  task_id: string | null
  titulo: string
  drive_url?: string | null
  status: ScheduleStatus
}
export type ScheduleStatus = 'planejado' | 'pronto' | 'aprovado' | 'postado' | 'atrasado'

export interface SkillRuntime { team_id: string; skill: string; progress: number; state: 'running' | 'idle' }
