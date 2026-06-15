import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowRight } from '../components/icons'
import { SiteHeader } from '../components/SiteHeader'
import { CursorField } from '../components/CursorField'

export function LandingPage() {
  return (
    <div
      className="relative min-h-screen overflow-hidden bg-[var(--bg-primary)] text-[var(--text-primary)] antialiased"
      style={{ fontFamily: "'Poppins', ui-sans-serif, sans-serif" }}
    >
      {/* clean copybook grid */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div
          className="absolute inset-0 opacity-55"
          style={{
            backgroundImage:
              'linear-gradient(rgba(27,19,38,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(27,19,38,0.08) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
            maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
            WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
          }}
        />
      </div>

      {/* cursor-reactive particle trail */}
      <CursorField />

      <div className="relative mx-auto max-w-[1440px] px-5 pb-[60px] pt-7 sm:px-10">
        {/* topbar */}
        <SiteHeader homeActive cta={{ label: 'Log In', to: '/login' }} />

        {/* hero */}
        <motion.main
          className="relative z-[2] flex min-h-[640px] flex-col items-center justify-center pb-[50px] pt-[30px] text-center"
          initial={{ opacity: 0, y: 14, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        >
          <h1
            className="mx-auto max-w-[1100px] text-[clamp(48px,7.2vw,104px)] font-extrabold leading-[0.96] tracking-[-0.035em] text-[#1B1326]"
            style={{ fontFamily: "'Quicksand', sans-serif" }}
          >
            <span className="block">
              Welcome to{' '}
              <span className="relative inline-block">
                <span
                  aria-hidden="true"
                  className="absolute inset-x-[-4px] bottom-[0.08em] h-[0.32em] rounded bg-[#F6C45C] opacity-85"
                />
                <span className="relative">hixie</span>
              </span>
              <span className="text-[#DB3E8C]">.</span>
            </span>
          </h1>

          <p className="mx-auto mt-7 max-w-[540px] text-[17px] leading-[1.55] text-[#6E5F7B]">
            Notes, tasks, and ideas — all in one place.
          </p>

          <div className="mt-[34px] flex justify-center gap-3.5">
            <a className="inline-flex cursor-pointer items-center gap-2.5 rounded-full border border-[rgba(27,19,38,0.08)] bg-white px-[26px] py-4 text-[15px] font-semibold text-[#1B1326] no-underline shadow-[0_8px_22px_-14px_rgba(27,19,38,0.2)] transition-transform hover:-translate-y-px">
              Learn More
            </a>
            <Link
              to="/login"
              className="inline-flex items-center gap-2.5 rounded-full bg-[#1B1326] px-[26px] py-4 text-[15px] font-semibold text-[#FBF7F2] no-underline shadow-[0_12px_28px_-14px_rgba(27,19,38,0.5)] transition-transform hover:-translate-y-px"
            >
              Get Started
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#F6C45C]">
                <ArrowRight size={13} color="#1B1326" />
              </span>
            </Link>
          </div>
        </motion.main>
      </div>
    </div>
  )
}
