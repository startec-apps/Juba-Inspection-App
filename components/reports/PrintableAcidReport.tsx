import React from 'react';
import { InspectionData, SystemSettings, InspectionStatus } from '../../types';
import { ACID_INSPECTION_ITEMS } from '../../constants';

const PrintableAcidReport: React.FC<{data: InspectionData, settings: SystemSettings}> = ({data, settings}) => {
    const config = settings.templates?.acid || {
        title: 'ACID TANKER CHECKLIST',
        docNo: 'MNT-F-013',
        revisionNo: '06',
        revisionDate: '15/03/24',
        initialIssueDate: '03/02/17',
        nextRevisionDate: '15/03/26'
    };
    const DEFAULT_BRAND_LOGO = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHZpZXdCb3g9JzAgMCAyNDAgNjAnIHdpZHRoPScyNDAnIGhlaWdodD0nNjAnPgo8cmVjdCB3aWR0aD0nMjQwJyBoZWlnaHQ9JzYwJyByeD0nOCcgZmlsbD0nIzBmMTcyYScvPgo8cGF0aCBkPSdNMjAgMTUgTDMyIDMwIEwyMCA0NSBMMTQgNDUgTDI2IDMwIEwxNCAxNSBaJyBmaWxsPScjMzhiZGY4Jy8+CjxwYXRoIGQ9J00zMCAxNSBMNDIgMzAgTDMwIDQ1IEwyNCA0NSBMMzYgMzAgTDI0IDE1IFonIGZpbGw9JyMwMjg0YzcnLz4KPHRleHQgeD0nNTInIHk9JzMyJyBmaWxsPScjZmZmZmZmJyBmb250LWZhbWlseT0nQXJpYWwsIEhlbHZldGljYSwgc2Fucy1zZXJpZicgZm9udC13ZWlnaHQ9JzkwMCcgZm9udC1zaXplPScxOCcgbGV0dGVyLXNwYWNpbmc9JzInPkpVQkE8L3RleHQ+Cjx0ZXh0IHg9JzExMicgeT0nMzInIGZpbGw9JyMzOGJkZjgnIGZvbnQtZmFtaWx5PSdBcmlhbCwgSGVsdmV0aWNhLCBzYW5zLXNlcmlmJyBmb250LXdlaWdodD0nODAwJyBmb250LXNpemU9JzE4JyBsZXR0ZXItc3BhY2luZz0nMSc+VFJBTlNQT1JUPC90ZXh0Pgo8dGV4dCB4PSc1MycgeT0nNDYnIGZpbGw9JyM5NGEzYjgnIGZvbnQtZmFtaWx5PSdBcmlhbCwgSGVsdmV0aWNhLCBzYW5zLXNlcmlmJyBmb250LXdlaWdodD0nNzAwJyBmb250LXNpemU9JzgnIGxldHRlci1zcGFjaW5nPScyLjUnPlNBRkVUWSDigKIgUVVBTElUWSDigKIgRkxFRVQ8L3RleHQ+Cjwvc3ZnPg==";
    const rawLogo = settings.companyLogo;
    const logoUrl = (rawLogo && !rawLogo.includes('juba-transport.com')) ? rawLogo : DEFAULT_BRAND_LOGO;
    
    return (
        <div className="max-w-[210mm] mx-auto text-sm leading-tight text-gray-900 font-sans p-8 bg-white min-h-[297mm] flex flex-col box-border">
             {/* Logo Top Right per Professional Request */}
             <div className="flex justify-end mb-4">
                <img src={logoUrl} alt="Logo" className="h-[60px] object-contain" />
             </div>

             {/* Custom Header Grid */}
             <div className="border-2 border-black mb-4 overflow-hidden">
                 <div className="grid grid-cols-[1fr_150px] divide-x-2 divide-black border-b-2 border-black">
                     <div className="flex flex-col">
                          <div className="border-b-2 border-black px-3 py-1.5 text-[10px] font-bold">Doc No: {config.docNo}</div>
                          <div className="flex-1 flex items-center justify-center p-4 bg-gray-50/50">
                               <h1 className="text-xl font-black uppercase tracking-widest text-center">{config.title}</h1>
                          </div>
                     </div>
                     <div className="text-[9px] divide-y divide-black">
                          <div className="grid grid-cols-[1fr_70px]"><span className="p-1 pl-2 border-r border-black font-semibold">Issue Date</span><span className="p-1 text-center">{config.initialIssueDate}</span></div>
                          <div className="grid grid-cols-[1fr_70px]"><span className="p-1 pl-2 border-r border-black font-semibold">Rev. Date:</span><span className="p-1 text-center">{config.revisionDate}</span></div>
                           <div className="grid grid-cols-[1fr_70px]"><span className="p-1 pl-2 border-r border-black font-semibold">Rev. No.</span><span className="p-1 text-center">{config.revisionNo}</span></div>
                           <div className="grid grid-cols-[1fr_70px]"><span className="p-1 pl-2 border-r border-black font-semibold">Next Rev:</span><span className="p-1 text-center">{config.nextRevisionDate}</span></div>
                     </div>
                 </div>
             </div>

             {/* Meta Data Block */}
             <div className="mb-6 p-4 border border-slate-200 bg-slate-50/50 rounded-xl">
                 <table className="w-full text-xs font-mono">
                     <tbody>
                         <tr>
                             <td className="py-1">HORSE #: <span className="font-bold underline">{data.truckNo || 'N/A'}</span></td>
                             <td className="py-1">TRAILER #: <span className="font-bold underline">{data.trailerNo || 'N/A'}</span></td>
                             <td className="py-1">JOB CARD: <span className="font-bold underline">{data.jobCard || 'N/A'}</span></td>
                         </tr>
                         <tr>
                             <td className="py-1">LOCATION: <span className="font-bold underline">{data.location || 'N/A'}</span></td>
                             <td className="py-1" colSpan={2}>DATE/TIME: <span className="font-bold underline">{new Date(data.timestamp).toLocaleString('en-GB')}</span></td>
                         </tr>
                     </tbody>
                 </table>
             </div>

             {/* Checklist Table */}
             <div className="border-2 border-black text-xs mb-6 flex-1">
                 <div className="grid grid-cols-[40px_1fr_130px] bg-slate-200 border-b-2 border-black font-black items-center text-[10px] uppercase">
                     <span className="text-center py-2 border-r border-black">S/N</span>
                     <span className="text-left pl-3 py-2 border-r border-black">Item Description</span>
                     <span className="pl-3 py-2">Status</span>
                 </div>

                 {['PPE', 'VEHICLE', 'SPILL_KIT', 'DOCUMENTATION'].map((sectionKey) => {
                     let sectionLabel = '';
                     let sectionItems: typeof ACID_INSPECTION_ITEMS = [];
                     if (sectionKey === 'PPE') { sectionLabel = 'A. PPE (Acid Specific)'; sectionItems = ACID_INSPECTION_ITEMS.filter(i => i.category.includes('Personal')); } 
                     else if (sectionKey === 'VEHICLE') { sectionLabel = 'B. Vehicle (Horse & Trailer)'; sectionItems = ACID_INSPECTION_ITEMS.filter(i => i.category.includes('Vehicle')); } 
                     else if (sectionKey === 'SPILL_KIT') { sectionLabel = 'C. Spill Kit Presence'; sectionItems = ACID_INSPECTION_ITEMS.filter(i => i.category.includes('Spill')); } 
                     else if (sectionKey === 'DOCUMENTATION') { sectionLabel = 'D. Compliance Records'; sectionItems = ACID_INSPECTION_ITEMS.filter(i => i.category.includes('Documentation')); }

                     return (
                         <React.Fragment key={sectionKey}>
                             <div className="grid grid-cols-[1fr] border-b border-black bg-gray-100 font-bold px-3 py-1.5 text-[10px] uppercase tracking-wide">{sectionLabel}</div>
                             {sectionItems.map((item, idx) => {
                                 const status = data[item.id];
                                 const splitLabel = item.label.split('. ');
                                 const number = splitLabel[0];
                                 const text = splitLabel.slice(1).join('. ');
                                 let statusColor = "text-slate-900";
                                 let rowBg = idx % 2 === 0 ? "bg-white" : "bg-slate-50/30";
                                 
                                 if (status === InspectionStatus.GOOD) statusColor = "text-emerald-700 font-bold";
                                 else if (status === InspectionStatus.BAD) statusColor = "text-rose-700 font-black bg-rose-50";
                                 else if (status === InspectionStatus.ATTENTION) statusColor = "text-amber-700 font-bold bg-amber-50";
                                 
                                 return (
                                     <div key={item.id} className={`grid grid-cols-[40px_1fr_130px] border-b border-black items-stretch min-h-[24px] ${rowBg}`}>
                                         <span className="text-center py-1 border-r border-black flex items-center justify-center font-semibold text-[9px]">{number}</span>
                                         <span className="pl-3 py-1 border-r border-black flex items-center leading-tight text-[10px] font-medium">{text}</span>
                                         <span className={`pl-3 py-1 flex items-center text-[10px] uppercase ${statusColor}`}>{status || '-'}</span>
                                     </div>
                                 );
                             })}
                         </React.Fragment>
                     )
                 })}
             </div>

             {/* Decision Section */}
             <div className="space-y-4 break-inside-avoid">
                 <table className="w-full border-collapse border-2 border-black">
                    <tbody>
                        <tr>
                            <td className="border-r-2 border-black p-3 font-black uppercase text-[10px] bg-slate-100 w-1/4 text-center">Safe to Load</td>
                            <td className={`p-3 font-black text-center text-sm ${data.safeToLoad === 'Yes' ? 'text-emerald-700' : 'text-rose-700'}`}>
                                {data.safeToLoad?.toUpperCase() || 'NOT SPECIFIED'}
                            </td>
                        </tr>
                    </tbody>
                 </table>
                 
                 <div className="border-2 border-black p-3 min-h-[60px] text-xs">
                     <span className="font-black uppercase text-[9px] block mb-1 text-slate-400">Inspector Remarks:</span>
                     <div className="italic text-slate-800 font-medium">"{data.remarks || 'No additional remarks.'}"</div>
                 </div>
                 
                 <div className="grid grid-cols-2 gap-12 pt-8">
                     <div className="flex flex-col">
                        <div className="flex gap-2 justify-between border-b-2 border-black pb-0.5">
                            <span className="font-bold text-[9px] text-slate-400 uppercase tracking-widest">Auditor:</span>
                            <span className="font-black text-[10px] uppercase">{data.inspectedBy || 'N/A'}</span>
                        </div>
                        <div className="h-16 flex items-center justify-center border-b-2 border-black mt-1 bg-slate-50/50">
                            {data.inspectorSignature && <img src={data.inspectorSignature} className="max-h-14 object-contain" alt="Inspector Sig" />}
                        </div>
                        <p className="text-[8px] font-black text-center text-slate-300 uppercase tracking-[0.3em] mt-2">Official Signature</p>
                     </div>

                     <div className="flex flex-col">
                        <div className="flex gap-2 justify-between border-b-2 border-black pb-0.5">
                            <span className="font-bold text-[9px] text-slate-400 uppercase tracking-widest">Driver:</span>
                            <span className="font-black text-[10px] uppercase">{data.driverName || 'N/A'}</span>
                        </div>
                        <div className="h-16 flex items-center justify-center border-b-2 border-black mt-1 bg-slate-50/50">
                            {data.driverSignature && <img src={data.driverSignature} className="max-h-14 object-contain" alt="Driver Sig" />}
                        </div>
                        <p className="text-[8px] font-black text-center text-slate-300 uppercase tracking-[0.3em] mt-2">Driver Acknowledgement</p>
                     </div>
                 </div>
             </div>
        </div>
    );
};

export default PrintableAcidReport;