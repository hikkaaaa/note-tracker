import { Link } from 'react-router-dom'
import { NotebookPen } from 'lucide-react'
import { ArrowUpRight } from './icons'

interface SiteHeaderProps {
  /** Right-hand pill CTA. */
  cta: { label: string; to: string }
  /** Render the "Home" nav item as the active (filled) pill. */
  homeActive?: boolean
}

const navLink =
  'inline-flex items-center gap-1.5 rounded-full px-[18px] py-2.5 text-sm font-medium text-[#1B1326] no-underline transition-colors hover:bg-[#7758A3]/[0.08]'

export function SiteHeader({ cta, homeActive = false }: SiteHeaderProps) {
  return (
    <header className="relative z-[5] mb-[60px] grid grid-cols-[1fr_auto_1fr] items-center gap-6">
      <Link to="/" className="flex items-center gap-3 text-[#1B1326] no-underline">
        <span
          className="flex h-11 w-11 items-center justify-center rounded-[14px]"
          style={{
            background: 'linear-gradient(135deg, #8B5CF6, #DB3E8C)',
            boxShadow: '0 6px 14px rgba(119, 88, 163, 0.28)',
          }}
        >
          <NotebookPen size={24} strokeWidth={2.2} className="text-white" />
        </span>
        <span className="text-[18px] font-bold tracking-[-0.01em]">
          hixie<span className="text-[#DB3E8C]">.</span>
        </span>
      </Link>

      <nav
        data-cursor-block
        className="hidden rounded-full border border-[rgba(27,19,38,0.08)] bg-white p-1.5 shadow-[0_12px_30px_-18px_rgba(27,19,38,0.18)] lg:flex lg:gap-0.5"
      >
        {homeActive ? (
          <span className="cursor-default rounded-full bg-[#1B1326] px-[18px] py-2.5 text-sm font-medium text-[#FBF7F2]">
            Home
          </span>
        ) : (
          <Link to="/" className={navLink}>
            Home
          </Link>
        )}
        <a className={`${navLink} cursor-pointer`}>
          For individuals <span className="font-normal opacity-50">+</span>
        </a>
        <a className={`${navLink} cursor-pointer`}>
          For teams <span className="font-normal opacity-50">+</span>
        </a>
        <a className={`${navLink} cursor-pointer`}>Pricing</a>
      </nav>

      <Link
        to={cta.to}
        className="inline-flex items-center gap-2 justify-self-end rounded-full bg-[#1B1326] px-[22px] py-3.5 text-sm font-semibold text-[#FBF7F2] no-underline transition-transform hover:-translate-y-px"
      >
        {cta.label} <ArrowUpRight size={14} />
      </Link>
    </header>
  )
}
