/**
 * MedPlus brand mark.
 *
 * Props:
 *  - size       : pixel size (default 36)
 *  - withWordmark : when true, renders "MedPlus" + tagline next to the icon
 *  - tagline    : override the secondary line under "MedPlus"
 *  - className  : extra classes for the outer wrapper
 *  - tone       : 'light' | 'dark' (controls the wordmark colors)
 */
export default function Logo({
  size = 36,
  withWordmark = false,
  tagline = 'Marketing Hub',
  className = '',
  tone = 'dark',
}) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <img
        src="/images/medplus_logo.png"
        alt="MedPlus"
        width={size}
        height={size}
        className="shrink-0 rounded-lg shadow-sm ring-1 ring-black/5 select-none"
        style={{ width: size, height: size, minWidth: size, minHeight: size }}
        draggable="false"
      />
      {withWordmark && (
        <div className="leading-tight">
          <div className={`text-sm font-semibold ${tone === 'light' ? 'text-white' : 'text-slate-900'}`}>
            MedPlus
          </div>
          <div
            className={`text-xs font-medium uppercase tracking-wider ${
              tone === 'light' ? 'text-white/70' : 'text-slate-400'
            }`}
          >
            {tagline}
          </div>
        </div>
      )}
    </div>
  )
}
