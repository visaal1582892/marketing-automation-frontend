import { Link } from 'react-router-dom'
import Icon from '../Icon'

export default function BackToMaster({ className = '' }) {
  return (
    <Link
      to="/admin/master"
      className={`inline-flex items-center gap-1.5 text-xs font-medium text-slate-500
                  transition hover:text-brand-600 ${className}`}
    >
      <Icon name="chevron" className="h-3.5 w-3.5 rotate-90" />
      Back to Master
    </Link>
  )
}
