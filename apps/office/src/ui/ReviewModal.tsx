import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useHQ } from '../store'
import { decide } from '../lib/supabase'
import { TeamChip } from './TasksView'

export function ReviewModal() {
  const { reviewTask, tasks, set } = useHQ()
  const task = tasks.find((t) => t.id === reviewTask)
  const [feedback, setFeedback] = useState('')
  const close = () => { set({ reviewTask: null }); setFeedback('') }
  return (
    <AnimatePresence>
      {task && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={close}>
          <motion.div initial={{ scale: 0.96, y: 10 }} animate={{ scale: 1, y: 0 }} className="glass w-full max-w-lg rounded-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <TeamChip id={task.team_id} />
            <h2 className="mt-2 text-lg font-bold">{task.titulo}</h2>
            <p className="text-xs text-white/50">Nada é gerado no Higgsfield antes do seu OK.</p>
            <ol className="mt-4 space-y-2">
              {task.payload?.scenes?.map((s, i) => (
                <li key={i} className="rounded-xl bg-white/5 px-3 py-2 text-[13px] ring-1 ring-white/10">{s}</li>
              ))}
            </ol>
            <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Ajuste (ex.: trocar pepino por banana na cena 2)"
              className="mt-4 h-20 w-full resize-none rounded-xl bg-black/30 p-3 text-sm outline-none ring-1 ring-white/10 placeholder:text-white/30 focus:ring-white/30" />
            <div className="mt-3 flex justify-end gap-2">
              <button disabled={!feedback} onClick={() => { decide(task.id, 'changes', feedback); close() }}
                className="rounded-lg px-3 py-1.5 text-xs font-bold ring-1 ring-white/20 hover:bg-white/10 disabled:opacity-40">Pedir ajuste</button>
              <button onClick={() => { decide(task.id, 'approved', feedback); close() }}
                className="rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-bold text-night-950 hover:bg-amber-300">Aprovar cenas</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
