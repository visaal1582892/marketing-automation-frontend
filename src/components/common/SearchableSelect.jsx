import React, { useState, useRef, useEffect } from 'react';

const SearchableSelect = ({ options, value, onChange, placeholder = "Select an option..." }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {/* Dropdown Trigger */}
      <div 
        className="w-full border border-slate-300 rounded-md p-2 bg-white cursor-pointer flex justify-between items-center hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={selectedOption ? "text-slate-900 truncate" : "text-slate-500"}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-300 rounded-md shadow-lg max-h-60 flex flex-col">
          {/* Search Input */}
          <div className="p-2 border-b border-slate-200 sticky top-0 bg-white rounded-t-md">
            <input
              type="text"
              className="w-full p-2 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-500"
              placeholder="Search combinations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClick={(e) => e.stopPropagation()} // Prevent closing when clicking input
              autoFocus
            />
          </div>

          {/* Options List */}
          <div className="overflow-y-auto">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <div
                  key={option.value}
                  className={`p-2 cursor-pointer hover:bg-brand-50 ${value === option.value ? 'bg-brand-100 text-brand-700 font-medium' : 'text-slate-700'}`}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                    setSearchTerm(''); // Reset search on select
                  }}
                >
                  {option.label}
                </div>
              ))
            ) : (
              <div className="p-3 text-slate-500 text-sm text-center">No results found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;
