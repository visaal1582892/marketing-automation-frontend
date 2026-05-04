import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import Logo from '../components/Logo'

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from?.pathname || '/dashboard'

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd]   = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]       = useState('')

  // Redirect after render — never call navigate() during the render phase.
  useEffect(() => {
    if (isAuthenticated) navigate(from, { replace: true })
  }, [isAuthenticated, navigate, from])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(email, password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to sign in. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-stretch bg-white">
      {/* Left visual panel */}
      <aside
        className="relative hidden flex-1 overflow-hidden bg-gradient-to-br
                   from-brand-600 via-brand-700 to-brand-900 lg:flex"
      >
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 -left-20 h-72 w-72 rounded-full bg-white/8 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-accent-500/20 blur-3xl" />
        </div>

        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          <Logo size={40} withWordmark tone="light" tagline="Brand & Buzz" />

          <div className="max-w-sm">
            <h2 className="text-3xl font-bold leading-tight tracking-tight">
              Centralise every marketing request. Ship faster.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-white/70">
              One workflow for intake, approvals, execution and analytics —
              built for the MedPlus marketing organisation.
            </p>
            <ul className="mt-8 space-y-3">
              {[
                'Smart-form intake with auto-routing',
                'Workload-aware task assignment',
                'Real-time QC and approval flow',
                'Campaign-level lead quality analytics',
              ].map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm text-white/85">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center
                                   rounded-md bg-accent-500/80 text-white">
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
                      <path fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 0 1 0 1.414l-8 8a1 1 0 0 1-1.414 0l-4-4a1 1 0 0 1 1.414-1.414L8 12.586l7.293-7.293a1 1 0 0 1 1.414 0z"
                            clipRule="evenodd" />
                    </svg>
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-white/40">
            © {new Date().getFullYear()} MedPlus Health Services. All rights reserved.
          </p>
        </div>
      </aside>

      {/* Right form panel */}
      <main
        className="relative flex w-full flex-col items-center justify-center
                   bg-slate-50 px-4 py-10 sm:px-6 lg:max-w-[460px] lg:bg-white lg:px-12"
      >
        <div className="pointer-events-none absolute inset-0 -z-10 lg:hidden">
          <div className="absolute -top-20 -left-20 h-56 w-56 rounded-full bg-brand-100 blur-3xl opacity-60" />
          <div className="absolute -bottom-20 -right-12 h-56 w-56 rounded-full bg-accent-100 blur-3xl opacity-60" />
        </div>

        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="mb-8 flex flex-col items-center lg:hidden">
            <Logo size={48} />
            <h1 className="mt-4 text-xl font-bold tracking-tight text-slate-900">MedPlus Marketing</h1>
            <p className="mt-1 text-sm text-slate-500">Sign in to your workspace</p>
          </div>

          {/* Desktop heading */}
          <div className="mb-8 hidden lg:block">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-brand-600">MedPlus Marketing Hub</p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Welcome back</h1>
            <p className="mt-1.5 text-sm text-slate-500">
              Sign in with your MedPlus credentials.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                Email address
              </label>
              <input
                type="email"
                required
                value={email}
                autoComplete="username"
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5
                           text-sm text-slate-900 shadow-sm transition
                           placeholder:text-slate-400
                           focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                placeholder="you@medplus.com"
              />
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-600">Password</label>
                <button
                  type="button"
                  onClick={() => setShowPwd((s) => !s)}
                  className="text-xs font-semibold text-brand-600 hover:text-brand-700 transition"
                >
                  {showPwd ? 'Hide' : 'Show'}
                </button>
              </div>
              <input
                type={showPwd ? 'text' : 'password'}
                required
                value={password}
                autoComplete="current-password"
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5
                           text-sm text-slate-900 shadow-sm transition
                           placeholder:text-slate-400
                           focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="rounded-xl border border-brand-100 bg-brand-50 px-4 py-3
                              text-sm text-brand-800">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center rounded-xl
                         bg-brand-600 px-4 py-2.5 text-sm font-bold text-white
                         shadow-sm shadow-brand-200 transition-all duration-200
                         hover:bg-brand-700 hover:shadow-md hover:shadow-brand-200
                         focus:outline-none focus:ring-2 focus:ring-brand-300
                         active:scale-[0.99] disabled:opacity-60"
            >
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-slate-400 lg:hidden">
            © {new Date().getFullYear()} MedPlus Health Services
          </p>
        </div>
      </main>
    </div>
  )
}
