import { motion } from 'framer-motion'
import { HeroCarousel } from '../components/HeroCarousel'
import { MarketingHeader } from '../components/MarketingHeader'

export function LandingPage() {
  return (
    <div className="min-h-screen overflow-hidden bg-[#fbfbfd] text-slate-950">
      <MarketingHeader />

      <motion.main
        className="relative mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl items-center px-6 pb-16"
        initial={{ x: -36, opacity: 0, filter: 'blur(8px)' }}
        animate={{ x: 0, opacity: 1, filter: 'blur(0px)' }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="absolute left-6 top-8 h-28 w-28 rounded-[2rem] bg-[#FFCCF2]/70 blur-3xl" />
        <div className="absolute bottom-12 right-12 h-36 w-36 rounded-[2.5rem] bg-[#977DFF]/15 blur-3xl" />

        <HeroCarousel />
      </motion.main>
    </div>
  )
}
