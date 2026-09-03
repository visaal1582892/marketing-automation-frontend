import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon';

export default function SingleSelectDropdown({ value, onChange, options = [], placeholder = 'Select…', hasError = false, disabled = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef(null);
  const dropdownRef = useRef(null);
  const [coords, setCoords] = useState(null);

  const normalizedOptions = options.map(o => ({
    value: o.value ?? o.id ?? '',
    label: o.label ?? o.name ?? ''
  }));

  const selected = normalizedOptions.find(o => String(o.value) === String(value));
  const filtered = searchQuery 
    ? normalizedOptions.filter(o => o.label.toLowerCase().includes(searchQuery.toLowerCase())) 
    : normalizedOptions;
  const showSearch = normalizedOptions.length > 6;

  useEffect(() => {
    function handleClickOutside(event) {
      const isClickInsideContainer = containerRef.current && containerRef.current.contains(event.target);
      const isClickInsideDropdown = dropdownRef.current && dropdownRef.current.contains(event.target);
      if (!isClickInsideContainer && !isClickInsideDropdown) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const updateCoords = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      
      const isUp = spaceBelow < 250 && spaceAbove > spaceBelow;
      
      setCoords({
        isUp,
        top: isUp ? rect.top + window.scrollY - 4 : rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width
      });
    }
  };

  useEffect(() => {
    if (isOpen) {
      updateCoords();
      
      let isAutoScrolling = false;
      const timer = setTimeout(() => {
        if (dropdownRef.current && containerRef.current) {
          const rect = dropdownRef.current.getBoundingClientRect();
          if (rect.bottom > window.innerHeight) {
            const scrollAmount = rect.bottom - window.innerHeight + 20;
            isAutoScrolling = true;
            setTimeout(() => { isAutoScrolling = false; }, 500);

            let parent = containerRef.current.parentElement;
            let scrolled = false;
            while (parent && parent !== document.documentElement) {
              const style = window.getComputedStyle(parent);
              if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
                parent.scrollBy({ top: scrollAmount, behavior: 'smooth' });
                scrolled = true;
                break;
              }
              parent = parent.parentElement;
            }
            if (!scrolled) window.scrollBy({ top: scrollAmount, behavior: 'smooth' });
          }
        }
      }, 10);

      const handleScroll = (e) => {
        if (isAutoScrolling) {
          updateCoords();
          return;
        }
        if (dropdownRef.current && dropdownRef.current.contains(e.target)) return;
        setIsOpen(false);
      };

      const handleResize = () => setIsOpen(false);

      window.addEventListener('scroll', handleScroll, true);
      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('scroll', handleScroll, true);
        window.removeEventListener('resize', handleResize);
        clearTimeout(timer);
      };
    }
  }, [isOpen]);

  const handlePick = (val) => {
    onChange(val);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setIsOpen(!isOpen);
          if (!isOpen) setSearchQuery('');
        }}
        className={`w-full flex items-center justify-between gap-2 rounded-lg border px-3 py-2
          text-sm shadow-sm transition text-left bg-white
          ${disabled ? 'bg-slate-50 border-slate-200 cursor-not-allowed opacity-70' :
            hasError ? 'border-red-400 ring-1 ring-red-200' :
            isOpen ? 'border-brand-500 ring-1 ring-brand-200' : 'border-slate-300 hover:border-slate-400'}`}
      >
        <span className={`block truncate ${selected ? 'text-slate-800' : 'text-slate-400'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <Icon name="chevron" className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-150 ${isOpen ? 'rotate-90' : ''}`} />
      </button>

      {isOpen && coords && createPortal(
        <div
          ref={dropdownRef}
          className="absolute z-[9999] max-h-60 flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl ring-1 ring-black/5"
          style={{
            top: coords.top,
            left: coords.left,
            width: coords.width,
            transform: coords.isUp ? 'translateY(-100%)' : 'none'
          }}
        >
          {showSearch && (
            <div className="shrink-0 p-2 border-b border-slate-100 bg-white z-10">
              <div className="relative">
                <Icon name="search" className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  autoFocus
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search…"
                  className="w-full rounded-md border border-slate-200 bg-slate-50 pl-8 pr-3 py-1.5
                    text-xs placeholder-slate-400 focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-500"
                />
              </div>
            </div>
          )}
          
          <div className="overflow-y-auto py-1">
            <button
              type="button"
              onClick={() => handlePick('')}
              className={`w-full flex items-center px-3 py-2 text-sm text-slate-400 italic hover:bg-slate-50 transition text-left
                ${!value ? 'bg-brand-50 text-brand-600 font-medium not-italic' : ''}`}
            >
              {placeholder}
            </button>
            
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-xs text-slate-400 italic">No results</p>
            ) : (
              filtered.map(o => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => handlePick(o.value)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm
                    hover:bg-brand-50 hover:text-brand-700 transition text-left
                    ${String(o.value) === String(value) ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-slate-700'}`}
                >
                  <span className="truncate">{o.label}</span>
                  {String(o.value) === String(value) && (
                    <Icon name="check" className="h-3.5 w-3.5 text-brand-600 shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
