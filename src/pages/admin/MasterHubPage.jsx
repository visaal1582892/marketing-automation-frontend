import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { Rights } from '../../constants/rights'
import Icon from '../../components/Icon'
import { MASTER_HUB_SECTIONS, getAccentStyle } from '../../config/masterHubConfig'

export default function MasterHubPage() {
  const { hasRight } = useAuth()

  const sections = MASTER_HUB_SECTIONS.map(section => ({
    ...section,
    items: section.items.filter(item => {
      if (item.right) return hasRight(item.right)
      if (item.adminOnly) return hasRight(Rights.MANAGE_QC_ROUTING)
      return true
    }),
  })).filter(section => section.items.length > 0)

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="shrink-0">
        <p className="text-sm text-slate-500">
          Configure master data, mappings, and system settings. Pick a section below.
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pr-1">
        <div className="grid gap-5 lg:grid-cols-2">
          {sections.map(section => {
            const style = getAccentStyle(section.accent)
            return (
              <section
                key={section.id}
                className={`rounded-xl border shadow-sm overflow-hidden ${style.card}`}
              >
                <div className="flex items-start gap-3 border-b border-slate-100/80 px-4 py-3.5">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${style.icon}`}>
                    <Icon name={section.icon} className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-slate-900">{section.title}</h3>
                    <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">{section.description}</p>
                  </div>
                </div>

                <ul className="grid gap-1.5 p-3 sm:grid-cols-2">
                  {section.items.map(item => (
                    <li key={item.to}>
                      <Link
                        to={item.to}
                        className={`flex items-center gap-2 rounded-lg border border-transparent px-3 py-2 text-xs font-medium text-slate-700 transition ${style.link}`}
                      >
                        <Icon name={item.icon} className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        <span className="truncate">{item.label}</span>
                        <Icon name="chevron" className="ml-auto h-3 w-3 shrink-0 -rotate-90 text-slate-300" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}
