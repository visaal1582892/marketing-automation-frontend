import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon';
import DynamicPillsTrigger from './DynamicPillsTrigger';

export default function MultiSelectDropdown({ name, options = [], value = [], onChange, placeholder = "Select options...", disabled = false, hasError = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef(null);
  const dropdownRef = useRef(null);
  const [coords, setCoords] = useState(null);

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
      
      // Flip up if there is less than 280px below and more space above than below
      const isUp = spaceBelow < 280 && spaceAbove > spaceBelow;
      
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
            
            isAutoScrolling = true; // Block close-on-scroll during animation
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
            if (!scrolled) {
              window.scrollBy({ top: scrollAmount, behavior: 'smooth' });
            }
          }
        }
      }, 10);

      const handleScroll = (e) => {
        if (isAutoScrolling) {
          updateCoords(); // Track coords while auto-scrolling
          return;
        }
        // Don't close if scrolling inside the dropdown itself
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

  const fireChange = (newValue) => {
    if (name) {
      onChange({ target: { name, value: newValue } });
    } else {
      onChange(newValue);
    }
  };

  const handleToggle = (id) => {
    const isAdding = !value.includes(id);
    const newValue = isAdding
      ? [...value, id]
      : value.filter(v => v !== id);
    fireChange(newValue);
    if (isAdding && id === 'Other') {
      setIsOpen(false);
    }
  };

  const handleRemove = (id) => {
    fireChange(value.filter(v => v !== id));
  };

  const normalizedOptions = options.map(o => ({
    id: o.id ?? o.value,
    name: o.name ?? o.label ?? '',
    subtitle: o.subtitle ?? ''
  }));

  const filteredOptions = normalizedOptions.filter(opt => 
    opt.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    opt.subtitle.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const displayOptions = searchQuery 
    ? filteredOptions 
    : [...filteredOptions].sort((a, b) => {
        const aSelected = value.includes(a.id);
        const bSelected = value.includes(b.id);
        if (aSelected && !bSelected) return -1;
        if (!aSelected && bSelected) return 1;
        return 0;
      });

  const selectedItems = value.map(id => normalizedOptions.find(o => o.id === id)).filter(Boolean);

  const portalContent = isOpen && coords ? createPortal(
    <div
      ref={dropdownRef}
      className="absolute z-[9999] max-h-60 flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-sm shadow-xl ring-1 ring-black/5 focus:outline-none"
      style={{ 
        top: coords.top, 
        left: coords.left, 
        width: coords.width,
        transform: coords.isUp ? 'translateY(-100%)' : 'none'
      }}
    >
      <div className="shrink-0 bg-white p-2 border-b border-slate-100 z-10">
        <div className="relative">
          <Icon name="search" className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            autoFocus
          />
        </div>
      </div>
      
      <div className="overflow-y-auto py-1.5">
        {displayOptions.length === 0 ? (
          <div className="relative cursor-default select-none py-2 px-4 text-slate-500 italic">
            No options found.
          </div>
        ) : (
          displayOptions.map((option) => {
            const isSelected = value.includes(option.id);
            return (
              <div
                key={option.id}
                className={`relative flex cursor-pointer select-none items-center gap-2.5 px-3 py-2 transition-colors hover:bg-brand-50 ${isSelected ? 'bg-brand-50' : ''}`}
                onClick={() => handleToggle(option.id)}
              >
                <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${isSelected ? 'border-brand-600 bg-brand-600' : 'border-slate-300 bg-white'}`}>
                  {isSelected && (
                    <svg viewBox="0 0 12 12" fill="none" style={{ width: '10px', height: '10px' }}>
                      <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0 flex items-center">
                  <span className={`block truncate ${isSelected ? 'font-medium text-brand-800' : 'font-normal text-slate-700'}`}>
                    {option.name}
                  </span>
                  {option.subtitle && (
                    <span className="ml-2 inline-flex shrink-0 items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                      {option.subtitle}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div className="relative w-full" ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        className={`w-full p-0 rounded-lg border shadow-sm transition-colors bg-white text-left 
          ${disabled ? 'bg-slate-50 border-slate-200 cursor-not-allowed opacity-70' : 
            hasError ? 'border-red-400 ring-1 ring-red-200' :
            isOpen ? 'border-brand-500 ring-1 ring-brand-200' : 'border-slate-300 hover:border-slate-400'}`}
        onClick={() => {
          if (disabled) return;
          setIsOpen(!isOpen);
          if (!isOpen) setSearchQuery("");
        }}
      >
        <DynamicPillsTrigger
          selectedItems={selectedItems}
          placeholder={placeholder}
          onRemove={handleRemove}
          isOpen={isOpen}
        />
      </button>

      {portalContent}
    </div>
  );
}
