import React, { useState } from 'react';
import { ResourceLink } from '../types';

const SAMPLE_RESOURCES: ResourceLink[] = [
    { id: '1', title: 'Tire Inspection SOP', category: 'SOP', url: '#', description: 'Standard protocol for multi-point tire wear and pressure auditing.' },
    { id: '2', title: 'Acid Handling Safety', category: 'Safety', url: '#', description: 'Emergency protocols for sulfuric and hydrochloric acid transport.' },
    { id: '3', title: 'Petroleum Guidelines', category: 'Manual', url: '#', description: 'Detailed walkthrough of the Petroleum Tanker checklist.' },
    { id: '4', title: 'Brake Testing Video', category: 'Video', url: '#', description: 'Instructional video on conducting static and dynamic brake tests.' },
    { id: '5', title: 'PPE Compliance 2026', category: 'Safety', url: '#', description: 'Latest requirements for protective gear in high-risk zones.' },
    { id: '6', title: 'Electronic Logging Manual', category: 'Manual', url: '#', description: 'Guide for using the electronic on-board recording system.' },
];

const LibraryView: React.FC = () => {
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<'All' | 'SOP' | 'Manual' | 'Safety' | 'Video'>('All');

    const filtered = SAMPLE_RESOURCES.filter(r => {
        const matchesSearch = r.title.toLowerCase().includes(search.toLowerCase()) || r.description.toLowerCase().includes(search.toLowerCase());
        const matchesFilter = filter === 'All' || r.category === filter;
        return matchesSearch && matchesFilter;
    });

    return (
        <div className="max-w-6xl mx-auto space-y-10 animate-fadeIn font-sans pb-24">
            <div className="flex flex-col md:flex-row justify-between items-end gap-6 px-2">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tight leading-none">Resource Vault</h2>
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.3em] mt-3">SOPs, Manuals & Compliance Media</p>
                </div>
                <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 scrollbar-hide">
                    {['All', 'SOP', 'Manual', 'Safety', 'Video'].map(cat => (
                        <button 
                            key={cat} 
                            onClick={() => setFilter(cat as any)}
                            className={`px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap
                                ${filter === cat ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}
                            `}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            <div className="relative">
                <svg className="w-5 h-5 absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                <input 
                    type="text" 
                    placeholder="Search documentation library..."
                    className="w-full pl-14 pr-6 py-5 bg-white border border-slate-100 rounded-3xl shadow-sm outline-none focus:ring-4 focus:ring-indigo-50 transition-all font-medium text-slate-700"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {filtered.map(res => (
                    <div key={res.id} className="bg-white rounded-[2rem] border border-slate-100 p-8 shadow-sm hover:shadow-xl transition-all group flex flex-col justify-between">
                        <div>
                            <div className="flex justify-between items-start mb-6">
                                <div className={`px-4 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.2em]
                                    ${res.category === 'SOP' ? 'bg-emerald-50 text-emerald-600' : 
                                      res.category === 'Video' ? 'bg-rose-50 text-rose-600' : 
                                      res.category === 'Manual' ? 'bg-blue-50 text-blue-600' : 
                                      'bg-amber-50 text-amber-600'}
                                `}>
                                    {res.category}
                                </div>
                                <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                                </div>
                            </div>
                            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight mb-2 group-hover:text-indigo-600 transition-colors">{res.title}</h3>
                            <p className="text-slate-500 text-xs font-medium leading-relaxed">{res.description}</p>
                        </div>
                        <a 
                            href={res.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-8 flex items-center justify-between px-6 py-3 bg-slate-50 hover:bg-indigo-600 hover:text-white rounded-xl transition-all text-[10px] font-black uppercase tracking-widest text-slate-500"
                        >
                            Open Resource
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                        </a>
                    </div>
                ))}
            </div>

            {filtered.length === 0 && (
                <div className="py-20 text-center">
                    <p className="text-slate-400 font-medium text-sm italic">No resources found matching your search.</p>
                </div>
            )}
        </div>
    );
};

export default LibraryView;