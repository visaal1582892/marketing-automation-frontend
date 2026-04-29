import { useState } from 'react'
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

  if (isAuthenticated) navigate(from, { replace: true })

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
      {/* Left visual panel (lg+) */}
      <aside
        className="relative hidden flex-1 overflow-hidden bg-gradient-to-br
                   from-brand-600 via-brand-700 to-brand-900 lg:flex"
      >
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 -left-20 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-accent-500/25 blur-3xl" />
        </div>

        <div className="relative z-10 flex flex-col justify-between p-10 text-white">
          <Logo size={42} withWordmark tone="light" tagline="Brand & Buzz" />

          <div className="max-w-md">
            <h2 className="text-3xl font-semibold leading-tight">
              Centralise every marketing request, route it intelligently, ship faster.
            </h2>
            <p className="mt-3.5 text-sm leading-relaxed text-white/80">
              One workflow for intake, approvals, execution and analytics —
              built for the MedPlus marketing organisation.
            </p>
            <ul className="mt-6 space-y-2.5 text-sm">
              {[
                'Smart-form intake with auto-routing',
                'Workload-aware task assignment',
                'Real-time QC and approval flow',
                'Campaign-level lead quality analytics',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center
                                   rounded-md bg-accent-500 text-white shadow-sm">
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                      <path fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 0 1 0 1.414l-8 8a1 1 0 0 1-1.414 0l-4-4a1 1 0 0 1 1.414-1.414L8 12.586l7.293-7.293a1 1 0 0 1 1.414 0z"
                            clipRule="evenodd" />
                    </svg>
                  </span>
                  <span className="text-white/90">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-white/60">
            © {new Date().getFullYear()} MedPlus Health Services. All rights reserved.
          </p>
        </div>
      </aside>

      {/* Right form panel */}
      <main
        className="relative flex w-full flex-col items-center justify-center
                   px-4 py-8 sm:px-6 lg:max-w-md lg:px-10"
      >
        <div className="pointer-events-none absolute inset-0 -z-10 lg:hidden">
          <div className="absolute -top-20 -left-20 h-56 w-56 rounded-full bg-brand-100 blur-3xl" />
          <div className="absolute -bottom-20 -right-12 h-56 w-56 rounded-full bg-accent-100 blur-3xl" />
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-7 flex flex-col items-center lg:hidden">
            <Logo size={52} />
            <h1 className="mt-3.5 text-lg font-semibold text-slate-900">MedPlus Marketing</h1>
            <p className="mt-1 text-sm text-slate-500">Sign in to your workspace</p>
          </div>

          <div className="mb-7 hidden lg:block">
            <h1 className="text-2xl font-semibold text-slate-900">Welcome back</h1>
            <p className="mt-1.5 text-sm text-slate-500">
              Sign in with your MedPlus credentials.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Email address
              </label>
              <input
                type="email"
                required
                value={email}
                autoComplete="username"
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-3.5 py-2.5
                           text-sm text-slate-900 shadow-sm transition
                           focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                placeholder="you@medplus.com"
              />
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700">Password</label>
                <button
                  type="button"
                  onClick={() => setShowPwd((s) => !s)}
                  className="text-xs font-medium text-brand-600 hover:text-brand-700"
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
                className="w-full rounded-md border border-slate-300 bg-white px-3.5 py-2.5
                           text-sm text-slate-900 shadow-sm transition
                           focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="rounded-md border border-brand-200 bg-brand-50 px-3 py-2.5
                              text-sm text-brand-800">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center rounded-md
                         bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm
                         transition hover:bg-brand-700 focus:outline-none
                         focus:ring-2 focus:ring-brand-300 active:scale-[0.99] disabled:opacity-60"
            >
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="mt-7 text-center text-xs text-slate-400 lg:hidden">
            © {new Date().getFullYear()} MedPlus Health Services
          </p>
        </div>
      </main>
    </div>
  )
}
