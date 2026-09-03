import React, { useState, useRef, useEffect, createContext, useContext } from 'react'
import { createPortal } from 'react-dom'
import Icon from './Icon'

const ActionMenuContext = createContext({ onClose: () => {} })

export function ActionMenu({ children, align = 'right', triggerIcon = 'moreVertical', className = '' }) {
  const [isOpen, setIsOpen] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0, right: 0 })
  const triggerRef = useRef(null)
  const menuRef = useRef(null)

  const updateCoords = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setCoords({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        right: window.innerWidth - (rect.right + window.scrollX),
      })
    }
  }

  const handleClose = () => setIsOpen(false)

  useEffect(() => {
    function handleClickOutside(event) {
      const inTrigger = triggerRef.current && triggerRef.current.contains(event.target)
      const inMenu = menuRef.current && menuRef.current.contains(event.target)
      if (!inTrigger && !inMenu) {
        setIsOpen(false)
      }
    }
    function handleScroll(e) {
      if (isOpen) {
        if (menuRef.current && menuRef.current.contains(e.target)) return
        setIsOpen(false)
      }
    }
    function handleResize() {
      if (isOpen) setIsOpen(false)
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') setIsOpen(false)
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      window.addEventListener('scroll', handleScroll, true)
      window.addEventListener('resize', handleResize)
      document.addEventListener('keydown', handleKeyDown)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('scroll', handleScroll, true)
      window.removeEventListener('resize', handleResize)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const handleToggle = (e) => {
    e.stopPropagation()
    if (!isOpen) {
      updateCoords()
    }
    setIsOpen(!isOpen)
  }

  return (
    <div className={`relative inline-block text-left ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500/20 active:bg-slate-100 transition"
        title="More Actions"
      >
        <Icon name={triggerIcon} className="h-4 w-4 text-slate-500" />
      </button>

      {isOpen &&
        createPortal(
          <ActionMenuContext.Provider value={{ onClose: handleClose }}>
            <div
              ref={menuRef}
              style={{
                position: 'absolute',
                top: `${coords.top}px`,
                ...(align === 'right'
                  ? { right: `${coords.right}px` }
                  : { left: `${coords.left}px` }),
                zIndex: 9999,
              }}
              className="min-w-[140px] rounded-lg border border-slate-200/80 bg-white/95 py-1.5 shadow-xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-100 overflow-hidden"
            >
              {children}
            </div>
          </ActionMenuContext.Provider>,
          document.body
        )}
    </div>
  )
}

export function ActionMenuItem({ onClick, icon, label, danger = false, variant, disabled = false, title = '' }) {
  const { onClose } = useContext(ActionMenuContext)

  const handleClick = (e) => {
    e.stopPropagation()
    if (!disabled && onClick) {
      onClick(e)
      onClose()
    }
  }

  let colorCls = 'text-slate-700 hover:bg-brand-50 hover:text-brand-700 active:bg-brand-100'
  let iconCls = 'text-slate-400 group-hover:text-brand-600'

  if (danger || variant === 'danger') {
    colorCls = 'text-red-600 hover:bg-red-50 hover:text-red-700 active:bg-red-100'
    iconCls = 'text-red-500 group-hover:text-red-600'
  } else if (variant === 'success') {
    colorCls = 'text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 active:bg-emerald-100'
    iconCls = 'text-emerald-500 group-hover:text-emerald-600'
  } else if (variant === 'warning') {
    colorCls = 'text-amber-700 hover:bg-amber-50 hover:text-amber-800 active:bg-amber-100'
    iconCls = 'text-amber-500 group-hover:text-amber-600'
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      title={title}
      className={`group flex w-full items-center gap-2 px-3 py-1.5 text-xs font-medium transition ${
        disabled
          ? 'cursor-not-allowed opacity-40 text-slate-400'
          : colorCls
      }`}
    >
      {icon && (
        <Icon
          name={icon}
          className={`h-3.5 w-3.5 shrink-0 ${
            disabled ? 'text-slate-300' : iconCls
          }`}
        />
      )}
      <span className="truncate">{label}</span>
    </button>
  )
}

export default ActionMenu
