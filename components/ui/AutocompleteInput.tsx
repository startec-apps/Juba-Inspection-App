
import React, { useState, useRef, useEffect } from 'react';

interface AutocompleteInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  isRegNo?: boolean; // If true, enforces uppercase and spacing between letters/numbers
  isTitleCase?: boolean; // If true, enforces Title Case (e.g. John Doe, Lusaka)
  readOnly?: boolean; // If true, input is disabled and cannot be changed
  error?: boolean;
  isLoading?: boolean;
  actionLabel?: string; // Optional: Custom label for new/unmatched entries (e.g. "Continue as")
}

const AutocompleteInput: React.FC<AutocompleteInputProps> = ({ 
  label, value, onChange, options = [], placeholder, isRegNo, isTitleCase, readOnly, error, isLoading, actionLabel
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter options based on input - Enhanced with fuzzy matching and space-agnostic search
  const filteredOptions = React.useMemo(() => {
    if (!value || value.trim() === '') return options.slice(0, 10); // Show first 10 if empty

    const searchTerm = value.toLowerCase().trim();
    const normalizedSearch = searchTerm.replace(/\s+/g, '');
    
    // 1. Precise matches (starts with or contains)
    const exactMatches = options.filter(opt => {
        const str = String(opt).toLowerCase();
        const normalizedStr = str.replace(/\s+/g, '');
        
        // Exact match or includes original
        if (str.startsWith(searchTerm) || str.includes(searchTerm)) return true;
        
        // Match ignoring spaces (critical for Reg Nos)
        if (normalizedStr.startsWith(normalizedSearch) || normalizedStr.includes(normalizedSearch)) return true;
        
        return false;
    });

    // 2. Fuzzy matches (if we don't have enough exact matches)
    const fuzzyMatches: string[] = [];
    if (exactMatches.length < 5) {
        options.forEach(opt => {
            const str = String(opt).toLowerCase();
            if (exactMatches.includes(opt)) return;

            // Simple fuzzy: check if characters exist in order
            let searchIdx = 0;
            for (let i = 0; i < str.length && searchIdx < searchTerm.length; i++) {
                if (str[i] === searchTerm[searchIdx]) {
                    searchIdx++;
                }
            }
            
            if (searchIdx === searchTerm.length) {
                fuzzyMatches.push(opt);
            }
        });
    }

    // Combine and limit to 10 total
    const combined = [...exactMatches, ...fuzzyMatches].slice(0, 10);
    
    // Ensure uniqueness
    return Array.from(new Set(combined));
  }, [options, value]);

  // Check if current value exists exactly in options (ignoring spaces for robustness)
  const exactExists = React.useMemo(() => {
    const normVal = value.toLowerCase().replace(/\s+/g, '');
    return options.some(opt => String(opt).toLowerCase().replace(/\s+/g, '') === normVal);
  }, [options, value]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (readOnly) return;

    let newVal = e.target.value;
    
    // Auto-formatting for Registration Numbers
    if (isRegNo) {
        newVal = newVal.toUpperCase();
        let raw = newVal.replace(/[^A-Z0-9]/g, '');
        raw = raw.replace(/([A-Z])(\d)/g, '$1 $2');
        raw = raw.replace(/(\d)([A-Z])/g, '$1 $2');
        newVal = raw;
    }

    // Auto-formatting for Title Case (Names, Locations)
    if (isTitleCase && !isRegNo) {
        newVal = newVal.replace(/\b\w/g, (char) => char.toUpperCase());
    }

    onChange(newVal);
    setIsOpen(true);
    setHighlightedIndex(-1);
  };

  const handleSelect = (option: string) => {
    if (readOnly) return;
    onChange(String(option)); // Ensure string
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (readOnly) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => Math.min(prev + 1, filteredOptions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
        handleSelect(filteredOptions[highlightedIndex]);
      } else {
        handleSelect(value);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <label className={`block text-xs font-bold uppercase mb-1.5 tracking-wide flex justify-between ${error ? 'text-red-600' : 'text-gray-500'}`}>
          {label}
          {readOnly && (
              <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                  Verified
              </span>
          )}
      </label>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleChange}
          onFocus={() => !readOnly && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          readOnly={readOnly}
          className={`w-full p-3.5 border rounded-lg transition-all font-medium 
             ${readOnly 
               ? 'bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed focus:outline-none' 
               : error
                 ? 'bg-red-50 border-red-300 focus:ring-2 focus:ring-red-200 text-red-900 placeholder-red-300'
                 : 'bg-gray-50 border-gray-200 focus:ring-2 focus:ring-blue-500 focus:bg-white text-gray-800 placeholder-gray-400'
             }
          `}
        />
        {/* Icon based on state */}
        <div className={`absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none ${error ? 'text-red-400' : 'text-gray-400'}`}>
            {isLoading ? (
               <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            ) : readOnly ? (
               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
            ) : error ? (
               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            ) : (
               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            )}
        </div>
      </div>
      {error && <p className="text-[10px] text-red-500 font-bold mt-1 ml-1 animate-fadeIn">This field is required</p>}

      {!readOnly && isOpen && (value.length > 0 || filteredOptions.length > 0) && (
        <ul className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto animate-fadeIn">
          {filteredOptions.length > 0 ? (
            <>
              {filteredOptions.map((opt, idx) => {
                const isExact = String(opt).toLowerCase().includes((value || '').toLowerCase());
                return (
                  <li
                    key={idx}
                    onClick={() => handleSelect(opt)}
                    className={`px-4 py-2.5 text-sm cursor-pointer transition-colors border-b border-gray-50 last:border-none flex justify-between items-center
                      ${idx === highlightedIndex ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-700 hover:bg-gray-50'}
                    `}
                  >
                    <div className="flex flex-col">
                      <span className="font-semibold">{opt}</span>
                      {!isExact && <span className="text-[9px] text-indigo-400 font-bold uppercase tracking-widest">Related</span>}
                    </div>
                    {isRegNo && <span className="text-[9px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full border border-slate-200 font-black uppercase tracking-tighter">Verified ID</span>}
                  </li>
                );
              })}
              
              {!exactExists && value.trim().length > 0 && (
                <li 
                  onClick={() => handleSelect(value)}
                  className="px-4 py-3 text-xs text-indigo-600 bg-indigo-50/50 cursor-pointer font-bold border-t border-indigo-100 flex items-center justify-between hover:bg-indigo-100 transition-all group"
                >
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    <span>{actionLabel || 'USE NEW'}: "{value}"</span>
                  </div>
                  <span className="text-[8px] bg-indigo-600 text-white px-2 py-1 rounded-full">{actionLabel ? 'PROCEED' : 'NEW'}</span>
                </li>
              )}
            </>
          ) : (
             <li 
                onClick={() => handleSelect(value)}
                className="px-4 py-4 text-xs text-indigo-600 bg-indigo-50/50 cursor-pointer font-black flex flex-col items-center gap-3 hover:bg-indigo-100 transition-all text-center border-t border-indigo-100"
             >
                 <div className="w-12 h-12 rounded-xl bg-white shadow-sm border border-indigo-100 flex items-center justify-center mb-1 group-hover:scale-110 transition-transform">
                    <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path></svg>
                 </div>
                 <div className="space-y-1">
                    <p className="tracking-[0.2em] uppercase text-[10px] text-slate-400 font-bold">Registry Entry: {value}</p>
                    <span className="text-indigo-600 font-black text-xs uppercase tracking-widest">{actionLabel || 'CONTINUE'} AS {value}</span>
                 </div>
             </li>
          )}
        </ul>
      )}
    </div>
  );
};

export default AutocompleteInput;
