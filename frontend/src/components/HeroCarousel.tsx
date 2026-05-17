import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { useState } from 'react'

const heroStates = [
  {
    buttonText: 'Everything in its place',
    heroText: 'Welcome to the space where you can keep everything organized.',
  },
  {
    buttonText: 'Write without limits',
    heroText: 'A block-based canvas designed for your fastest ideas.',
  },
  {
    buttonText: 'Structure made simple',
    heroText: 'Drag, drop, and build your perfect workflow in seconds.',
  },
]

const textTransition = {
  duration: 0.38,
  ease: [0.22, 1, 0.36, 1],
} as const

export function HeroCarousel() {
  const [activeIndex, setActiveIndex] = useState(0)
  const activeState = heroStates[activeIndex]

  const showNextState = () => {
    setActiveIndex((currentIndex) => (currentIndex + 1) % heroStates.length)
  }

  return (
    <section className="relative mx-auto max-w-5xl text-center">
      <motion.button
        type="button"
        onClick={showNextState}
        className="mx-auto mb-8 inline-flex items-center justify-center gap-2 overflow-hidden rounded-full border border-[#977DFF]/20 bg-white px-4 py-2 text-sm font-semibold text-[#0033FF] shadow-sm outline-none transition-colors hover:border-[#977DFF]/35 hover:bg-[#FFCCF2]/20 focus-visible:ring-4 focus-visible:ring-[#977DFF]/20"
        layout
        whileHover={{ y: -2, scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        transition={{ layout: { duration: 0.32, ease: [0.22, 1, 0.36, 1] } }}
        aria-label="Cycle hero message"
      >
        <span className="relative inline-flex h-5 min-w-0 items-center overflow-hidden">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={activeState.buttonText}
              className="inline-flex items-center whitespace-nowrap"
              initial={{ x: 24, opacity: 0, filter: 'blur(5px)' }}
              animate={{ x: 0, opacity: 1, filter: 'blur(0px)' }}
              exit={{ x: -24, opacity: 0, filter: 'blur(5px)' }}
              transition={textTransition}
            >
              {activeState.buttonText}
            </motion.span>
          </AnimatePresence>
        </span>
        <motion.span
          aria-hidden="true"
          animate={{ x: [0, 4, 0] }}
          transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
        >
          <ArrowRight className="h-4 w-4" />
        </motion.span>
      </motion.button>

      <div className="relative mx-auto">
        <AnimatePresence mode="wait" initial={false}>
          <motion.h1
            key={activeState.heroText}
            className="mx-auto max-w-4xl text-balance text-5xl font-extrabold leading-[1.02] tracking-tight text-slate-950 sm:text-6xl lg:text-7xl"
            initial={{ x: 56, opacity: 0, scale: 0.985, filter: 'blur(10px)' }}
            animate={{ x: 0, opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ x: -56, opacity: 0, scale: 0.985, filter: 'blur(10px)' }}
            transition={{ duration: 0.46, ease: [0.22, 1, 0.36, 1] }}
          >
            {activeState.heroText}
          </motion.h1>
        </AnimatePresence>
      </div>
    </section>
  )
}
