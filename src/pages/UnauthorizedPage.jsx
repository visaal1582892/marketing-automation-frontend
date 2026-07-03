import { Link } from 'react-router-dom'
import Icon from '../components/Icon'

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-rose-50 text-rose-500">
        <Icon name="shield" className="h-8 w-8" />
      </div>
      <h1 className="text-2xl font-bold text-slate-900">403 — Access Denied</h1>
      <p className="mt-2 max-w-md text-sm text-slate-500">
        You are signed in but do not have permission to view this page.
        Contact your administrator if you believe this is an error.
      </p>
      <Link
        to="/dashboard"
        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm
                   font-medium text-white shadow-sm transition hover:bg-brand-700"
      >
        <Icon name="dashboard" className="h-4 w-4" />
        Back to Dashboard
      </Link>
    </div>
  )
}
