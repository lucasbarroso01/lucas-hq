import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useHQ } from '../store'
import { setPausa } from '../lib/supabase'

/** Pausar / retomar a operação inteira (todos os agentes). */
export function PauseButton() {
  const pausa = useHQ((s) => s.pausa)
  const [ask, setAsk] = useState(false)
  const [motivo, setMotivo] = useState('')
  return (
    <>
      <button
        onClick={() => (pausa.pausado ? setPausa(false) : setAsk(true))}
        title={pausa.pausado ? 'Retomar a operação' : 'Pausar a operação (nenhum turno começa)'}
        className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-[12px] font-bold ring-1 transition ${
          pausa.pausado ? 'animate-pulse bg-rose-500 text-white ring-rose-300' : 'bg-white/5 text-white/80 ring-white/15 hover:bg-white/10'}`}>
        {pausa.pausado ? '▶ Retomar' : '⏸ Pausar'}
      </button>
      <AnimatePresence>
        {ask && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={() => setAsk(false)}>
            <motion.div initial={{ scale: 0.96 }} animate={{ scale: 1 }} className="glass w-full max-w-md rounded-2xl p-5" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-lg font-bold">Pausar a operação?</h2>
              <p className="mt-1 text-sm text-white/60">Nenhum turno começa, agendado ou recuperado. O vídeo em produção para antes do render. Ao retomar, os turnos perdidos rodam sozinhos.</p>
              <input autoFocus value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo (ex.: legenda saindo errada)"
                className="mt-4 w-full rounded-xl bg-black/30 px-3 py-2 text-sm outline-none ring-1 ring-white/10 placeholder:text-white/30 focus:ring-white/30"
                onKeyDown={(e) => { if (e.key === 'Enter') { setPausa(true, motivo); setAsk(false); setMotivo('') } }} />
              <div className="mt-4 flex justify-end gap-2">
                <button onClick={() => setAsk(false)} className="rounded-lg px-3 py-1.5 text-xs font-bold ring-1 ring-white/20 hover:bg-white/10">Cancelar</button>
                <button onClick={() => { setPausa(true, motivo); setAsk(false); setMotivo('') }} className="rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-400">⏸ Pausar tudo</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export function PauseBanner() {
  const pausa = useHQ((s) => s.pausa)
  if (!pausa.pausado) return null
  return (
    <div className="pointer-events-none absolute left-1/2 top-[76px] z-30 -translate-x-1/2 rounded-full bg-rose-500/90 px-4 py-1.5 text-[12px] font-bold text-white shadow-lg">
      ⏸ OPERAÇÃO PAUSADA{pausa.motivo ? ` · ${pausa.motivo}` : ''} · nenhum agente começa até você retomar
    </div>
  )
}
