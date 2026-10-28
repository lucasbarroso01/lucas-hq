import { AnimatePresence, motion } from 'framer-motion'
import { useHQ, teamById } from '../store'

export function Toasts() {
  const toasts = useHQ((s) => s.toasts)
  return (
    <div className="pointer-events-none absolute right-4 top-20 z-40 flex w-80 flex-col gap-2">
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const team = teamById(t.team_id)
          return (
            <motion.div key={t.id} layout initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }}
              className="glass flex items-center gap-2.5 rounded-xl px-3 py-2.5" style={{ borderLeft: `3px solid ${team?.cor ?? '#7cc8ff'}` }}>
              <span className="text-base">{team?.icon ?? '🧠'}</span>
              <span className="text-[12.5px] leading-snug text-white/90">{t.text}</span>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
