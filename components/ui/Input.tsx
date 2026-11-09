
import React from 'react';

interface InputProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  error?: boolean;
}

const Input: React.FC<InputProps> = ({label, value, onChange, type='text', placeholder, error}) => (
  <div>
    <label className={`block text-xs font-bold uppercase mb-1.5 tracking-wide ${error ? 'text-red-600' : 'text-gray-500'}`}>
      {label}
    </label>
    <input 
      type={type} 
      value={value} 
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full p-3.5 border rounded-lg focus:ring-2 focus:outline-none transition-all font-medium placeholder-gray-400
        ${error 
          ? 'bg-red-50 border-red-300 focus:ring-red-200 text-red-900' 
          : 'bg-gray-50 border-gray-200 focus:ring-blue-500 focus:bg-white text-gray-800'
        }
      `} 
    />
    {error && <p className="text-[10px] text-red-500 font-bold mt-1 ml-1 animate-fadeIn">This field is required</p>}
  </div>
);

export default Input;
