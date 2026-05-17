import { motion } from 'framer-motion'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MarketingHeader } from '../components/MarketingHeader'

export function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    navigate('/dashboard')
  }

  return (
    <div className="min-h-screen overflow-hidden bg-[#fbfbfd] text-slate-950">
      <MarketingHeader />

      <motion.main
        className="flex min-h-[calc(100vh-5rem)] items-center justify-center px-6 pb-20"
        initial={{ x: 36, opacity: 0, filter: 'blur(8px)' }}
        animate={{ x: 0, opacity: 1, filter: 'blur(0px)' }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <section className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <h1 className="text-4xl font-extrabold tracking-tight">Log in</h1>
            <p className="mt-3 text-sm font-medium text-slate-500">
              Enter your email to continue to your folders.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="h-13 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base font-medium text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-[#977DFF] focus:ring-4 focus:ring-[#977DFF]/15"
              />
            </label>

            <button
              type="submit"
              className="h-13 w-full rounded-2xl bg-[#0033FF] px-5 text-base font-bold text-white shadow-xl shadow-[#0033FF]/20 transition-transform hover:-translate-y-0.5"
            >
              Log In
            </button>
          </form>

          <Link
            to="/login"
            className="mt-6 block text-center text-sm font-semibold text-[#0033FF] hover:text-[#977DFF]"
          >
            Don&apos;t have an account?
          </Link>
        </section>
      </motion.main>
    </div>
  )
}
