import { FolderKanban } from 'lucide-react'
import { Link } from 'react-router-dom'

export function MarketingHeader() {
  return (
    <header className="mx-auto flex h-20 max-w-6xl items-center justify-between px-6">
      <nav className="flex items-center gap-2 text-sm font-semibold">
        <Link
          to="/"
          className="rounded-full px-4 py-2 text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-950"
        >
          Home
        </Link>
        <Link
          to="/login"
          className="rounded-full bg-[#0033FF] px-5 py-2.5 text-white shadow-lg shadow-[#0033FF]/20 transition-transform hover:-translate-y-0.5"
        >
          Log In
        </Link>
      </nav>

      <Link to="/" className="flex items-center gap-3" aria-label="Go to home">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#977DFF] text-white shadow-lg shadow-[#977DFF]/25">
          <FolderKanban className="h-5 w-5" />
        </span>
        <span className="text-lg font-bold tracking-tight">Organized Space</span>
      </Link>
    </header>
  )
}
