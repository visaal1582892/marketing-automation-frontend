/**
 * AppSelect — a react-select wrapper styled to match the app's Tailwind design.
 *
 * Props:
 *   value        string | null                         single: raw string; multi: {value,label}[]
 *   onChange     (value: string|{value,label}[]) => void  single: raw string; multi: option array
 *   options      string[] | {value,label}[]             list of options
 *   placeholder  string                                text shown when nothing is selected
 *   size         'sm' | 'md'                           'sm' for table filters, 'md' (default) for forms
 *   isClearable  boolean                               show a × button (default true)
 *   isDisabled   boolean
 *   isMulti      boolean                               enable multi-select mode
 *   isSearchable boolean                               enable text search
 *   menuPortal   boolean                               render menu in document.body (avoids overflow clipping)
 */
import React, { useRef } from 'react'
import ReactSelect, { components } from 'react-select'

// brand palette (from index.css CSS vars)
const B = {
  50:  '#fef2f2',
  100: '#fde3e3',
  200: '#fbcaca',
  300: '#f7a3a3',
  400: '#ef6f6f',
  600: '#c2181d',
  700: '#a31418',
}

const PORTAL_ZINDEX = 9999

function buildStyles(size) {
  const isSmall = size === 'sm'
  const ctrlH   = isSmall ? '28px' : '36px'
  const fs      = isSmall ? '0.75rem' : '0.875rem'
  const optPad  = isSmall ? '4px 8px' : '6px 10px'

  return {
    // This is the critical one: controls the portal wrapper's z-index so it
    // sits above modal backdrops (z-50) when menuPortalTarget is used.
    menuPortal: (base) => ({ ...base, zIndex: PORTAL_ZINDEX }),
    control: (base, state) => ({
      ...base,
      minHeight: ctrlH,
      height: isSmall ? ctrlH : undefined,
      fontSize: fs,
      borderColor: state.isFocused ? B[400] : '#e2e8f0',
      boxShadow: state.isFocused ? `0 0 0 1px ${B[400]}` : 'none',
      borderRadius: '6px',
      backgroundColor: state.isDisabled ? '#f8fafc' : 'white',
      cursor: 'pointer',
      '&:hover': { borderColor: state.isFocused ? B[400] : '#cbd5e1' },
    }),
    valueContainer: (base) => ({
      ...base,
      padding: isSmall ? '0 6px' : '2px 8px',
      flexWrap: 'nowrap',
    }),
    input: (base) => ({
      ...base,
      margin: 0,
      padding: 0,
      fontSize: fs,
    }),
    indicatorsContainer: (base) => ({
      ...base,
      height: ctrlH,
    }),
    dropdownIndicator: (base) => ({
      ...base,
      padding: isSmall ? '0 4px' : '0 6px',
      color: '#94a3b8',
      '&:hover': { color: '#475569' },
    }),
    clearIndicator: (base) => ({
      ...base,
      padding: isSmall ? '0 2px' : '0 4px',
      color: '#94a3b8',
      '&:hover': { color: '#475569' },
    }),
    indicatorSeparator: () => ({ display: 'none' }),
    menu: (base) => ({
      ...base,
      borderRadius: '8px',
      border: '1px solid #e2e8f0',
      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.08), 0 2px 4px -1px rgba(0,0,0,0.05)',
      zIndex: PORTAL_ZINDEX,
      overflow: 'hidden',
    }),
    menuList: (base) => ({
      ...base,
      padding: '4px',
      fontSize: fs,
    }),
    option: (base, state) => ({
      ...base,
      borderRadius: '4px',
      fontSize: fs,
      padding: optPad,
      backgroundColor: state.isSelected
        ? B[100]
        : state.isFocused
          ? B[50]
          : 'transparent',
      color: state.isSelected ? B[700] : '#334155',
      cursor: 'pointer',
      '&:active': { backgroundColor: B[200] },
    }),
    placeholder: (base) => ({
      ...base,
      color: '#94a3b8',
      fontSize: fs,
      whiteSpace: 'nowrap',
    }),
    singleValue: (base, state) => ({
      ...base,
      fontSize: fs,
      color: state.isDisabled ? '#94a3b8' : '#1e293b',
    }),
    noOptionsMessage: (base) => ({
      ...base,
      fontSize: fs,
      color: '#94a3b8',
    }),
  }
}

/**
 * ValueContainer that shows at most `max` multi-value chips, then "+N more".
 * Keeps the search Input always rendered so typing still works.
 */
function makeLimitedValueContainer(max) {
  return function LimitedValueContainer({ children, ...props }) {
    const values = props.getValue()
    const overflow = Math.max(0, values.length - max)
    // children = [<MultiValue/>, …, <Input/>]  (Input is always last)
    const kids = Array.isArray(children) ? children : [children]
    const input = kids[kids.length - 1]
    const chips = kids.slice(0, kids.length - 1)
    const visible = chips.slice(0, max)
    return (
      <components.ValueContainer {...props}>
        {visible}
        {overflow > 0 && (
          <span style={{
            fontSize: '0.7rem', fontWeight: 500, color: '#475569',
            background: '#e2e8f0', borderRadius: '999px',
            padding: '1px 7px', whiteSpace: 'nowrap', flexShrink: 0,
          }}>
            +{overflow} more
          </span>
        )}
        {input}
      </components.ValueContainer>
    )
  }
}

/**
 * Normalise a raw options array into react-select's {value, label} format.
 * Accepts: string[], {value,label}[], or [value, label][] pairs.
 * Grouped options ({ label, options[] }) are passed through unchanged.
 */
function normalise(options = []) {
  return options.map(o => {
    if (typeof o === 'string') return { value: o, label: o }
    if (Array.isArray(o))     return { value: String(o[0]), label: String(o[1]) }
    // react-select group: { label, options[] }
    if (o.options)            return { label: o.label, options: normalise(o.options) }
    return { ...o, value: String(o.value) }
  })
}

export default function AppSelect({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  size = 'md',
  isClearable = true,
  isDisabled = false,
  isMulti = false,
  isSearchable = true,
  maxMultiValues = 3,
  className = '',
  menuPortal = false
}) {
  const normOpts = normalise(options)
  const styles   = buildStyles(size)
  const isAutoScrolling = useRef(false)
  const selectRef = useRef(null)

  const handleMenuOpen = () => {
    setTimeout(() => {
      const menuEl = document.querySelector('.app-select__menu')
      if (menuEl) {
        const rect = menuEl.getBoundingClientRect()
        if (rect.bottom > window.innerHeight) {
          isAutoScrolling.current = true
          setTimeout(() => { isAutoScrolling.current = false }, 500)
          
          const scrollAmount = rect.bottom - window.innerHeight + 20
          
          const controlEl = document.querySelector('.app-select__control--menu-is-open')
          let parent = controlEl ? controlEl.parentElement : null
          let scrolled = false
          
          while (parent && parent !== document.documentElement) {
            const style = window.getComputedStyle(parent)
            if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
              parent.scrollBy({ top: scrollAmount, behavior: 'smooth' })
              scrolled = true
              break
            }
            parent = parent.parentElement
          }
          
          if (!scrolled) {
            window.scrollBy({ top: scrollAmount, behavior: 'smooth' })
          }
        }
      }
    }, 10)
  }

  const handleCloseMenuOnScroll = (e) => {
    // Only close if it's not currently animating an auto-scroll
    return !isAutoScrolling.current
  }

  // Multi mode: normalise value items to strings so they match normOpts
  if (isMulti) {
    const normValue = (value ?? []).map(v => ({ ...v, value: String(v.value) }))
    const LimitedVC = makeLimitedValueContainer(maxMultiValues)
    
    const handleChange = (opts, actionMeta) => {
      onChange(opts || [])
      if (actionMeta?.action === 'select-option' && actionMeta.option?.value === 'Other') {
        selectRef.current?.blur()
      }
    }

    return (
      <ReactSelect
        ref={selectRef}
        isMulti
        hideSelectedOptions={false}
        value={normValue}
        onChange={handleChange}
        options={normOpts}
        placeholder={placeholder}
        isClearable={isClearable}
        isDisabled={isDisabled}
        isSearchable
        noOptionsMessage={() => 'No matches found'}
        components={{ ValueContainer: LimitedVC }}
        styles={{
          ...styles,
          valueContainer: (base) => ({
            ...base, padding: '2px 6px', flexWrap: 'nowrap',
            overflow: 'hidden', alignItems: 'center',
          }),
          multiValue: (base) => ({
            ...base,
            backgroundColor: B[100],
            borderRadius: '4px',
            flexShrink: 0,
          }),
          multiValueLabel: (base) => ({
            ...base,
            color: B[700],
            fontSize: '0.75rem',
            padding: '1px 4px',
          }),
          multiValueRemove: (base) => ({
            ...base,
            color: B[400],
            borderRadius: '0 4px 4px 0',
            ':hover': { backgroundColor: B[200], color: B[700] },
          }),
        }}
        menuPortalTarget={menuPortal ? document.body : undefined}
        menuPosition={menuPortal ? 'fixed' : undefined}
        className={className}
        classNamePrefix="app-select"
        onMenuOpen={handleMenuOpen}
        closeMenuOnScroll={handleCloseMenuOnScroll}
      />
    )
  }

  // Single mode: value is a raw string
  const flatOpts = normOpts.flatMap(o => o.options ?? [o])
  const strVal   = value != null && value !== '' ? String(value) : null
  const selected = strVal ? (flatOpts.find(o => o.value === strVal) ?? null) : null

  const handleChange = (opt) => onChange(opt ? opt.value : '')

  return (
    <ReactSelect
      value={selected}
      onChange={handleChange}
      options={normOpts}
      placeholder={placeholder}
      isClearable={isClearable}
      isDisabled={isDisabled}
      isSearchable={isSearchable}
      noOptionsMessage={() => 'No matches found'}
      styles={styles}
      menuPortalTarget={menuPortal ? document.body : undefined}
      menuPosition={menuPortal ? 'fixed' : undefined}
      className={className}
      classNamePrefix="app-select"
      onMenuOpen={handleMenuOpen}
      closeMenuOnScroll={handleCloseMenuOnScroll}
    />
  )
}
