import { parse } from 'yaml'
import raw from '../../../../config/expediente.yaml?raw'

export interface Turno {
  id: string
  agente: string
  time?: string
  pagina?: 'Worldframe'
  inicio: string
  prazo: string
  faz: string
  dias?: string[]
  humano?: boolean
}
export interface Expediente {
  fuso: string
  silencio: { inicio: string; fim: string }
  limites: Record<string, number>
  paginas: Record<'Worldframe', { cor: string; posts: string[] }>
  turnos: Turno[]
}

/** Horários, prazos e limites: lidos de config/expediente.yaml no build. */
export const EXP = parse(raw) as Expediente
export const PAGINAS = Object.keys(EXP.paginas) as ('Worldframe')[]

export const toMin = (hm: string) => { const [h, m] = hm.split(':').map(Number); return h * 60 + m }

/** "Agora" no fuso oficial, como data (AAAA-MM-DD) e minutos do dia. */
export function nowBR() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: EXP.fuso, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(new Date()).map((p) => [p.type, p.value]))
  const h = Number(parts.hour) % 24
  return { date: `${parts.year}-${parts.month}-${parts.day}`, min: h * 60 + Number(parts.minute), sec: Number(parts.second) }
}

/** Faixas de turno para desenhar na agenda (turnos que cruzam a meia-noite viram duas). */
export function faixas(): { turno: Turno; ini: number; fim: number }[] {
  return EXP.turnos.flatMap((t) => {
    const a = toMin(t.inicio), b = toMin(t.prazo)
    return a <= b ? [{ turno: t, ini: a, fim: b }] : [{ turno: t, ini: a, fim: 24 * 60 }, { turno: t, ini: 0, fim: b }]
  })
}
