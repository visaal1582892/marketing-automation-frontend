import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon';

export default function MultiSelectDropdown({ options = [], value = [], onChange, placeholder = "Select options...", disabled = false }) {
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
      setCoords({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width
      });
    }
  };

  useEffect(() => {
    if (isOpen) {
      updateCoords();
      // Listen to scroll on capture phase to catch modal scroll events
      window.addEventListener('scroll', updateCoords, true);
      window.addEventListener('resize', updateCoords);
      return () => {
        window.removeEventListener('scroll', updateCoords, true);
        window.removeEventListener('resize', updateCoords);
      };
    }
  }, [isOpen]);

  const handleToggle = (id) => {
    const newValue = value.includes(id)
      ? value.filter(v => v !== id)
      : [...value, id];
    onChange(newValue);
  };

  const getDisplayText = () => {
    if (value.length === 0) return placeholder;
    if (value.length === 1) {
      const opt = options.find(o => o.id === value[0]);
      return opt ? opt.name : `${value.length} selected`;
    }
    return `${value.length} selected`;
  };

  const filteredOptions = options.filter(opt => 
    opt.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const portalContent = isOpen && coords ? createPortal(
    <div
      ref={dropdownRef}
      className="absolute z-[9999] mt-1 max-h-60 overflow-auto rounded-xl border border-slate-200 bg-white py-1.5 text-sm shadow-xl ring-1 ring-black/5 focus:outline-none"
      style={{ top: coords.top, left: coords.left, width: coords.width }}
    >
      <div className="sticky top-0 bg-white px-2 pb-2 pt-1 border-b border-slate-100 z-10">
        <div className="relative">
          <Icon name="search" className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      </div>
      
      {filteredOptions.length === 0 ? (
        <div className="relative cursor-default select-none py-2 px-4 text-slate-500 italic">
          No options found.
        </div>
      ) : (
        filteredOptions.map((option) => {
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
              <span className={`block truncate ${isSelected ? 'font-medium text-brand-800' : 'font-normal text-slate-700'}`}>
                {option.name}
              </span>
            </div>
          );
        })
      )}
    </div>,
    document.body
  ) : null;

  return (
    <div className="relative w-full" ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        className={`w-full flex items-center justify-between gap-2 rounded-lg border px-3 py-1.5 text-sm shadow-sm transition-colors min-h-[36px] bg-white text-left 
          ${disabled ? 'bg-slate-50 border-slate-200 cursor-not-allowed opacity-70' : 
            isOpen ? 'border-brand-500 ring-1 ring-brand-200' : 'border-slate-300 hover:border-slate-400'}`}
        onClick={() => {
          if (disabled) return;
          setIsOpen(!isOpen);
          if (!isOpen) setSearchQuery(""); // Reset search when opening
        }}
      >
        <span className={value.length === 0 ? "text-slate-400" : "text-slate-900"}>
          {getDisplayText()}
        </span>
        <Icon name="chevron" className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-150 ${isOpen ? 'rotate-90' : 'rotate-0'}`} />
      </button>

      {portalContent}
    </div>
  );
}
