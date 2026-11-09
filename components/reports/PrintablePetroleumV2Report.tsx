import React from 'react';
import { InspectionData, SystemSettings, InspectionStatus } from '../../types';
import { PETROLEUM_V2_ITEMS } from '../../constants';

const PrintablePetroleumV2Report: React.FC<{data: InspectionData, settings: SystemSettings}> = ({data, settings}) => {
    const config = settings.templates?.petroleum_v2 || {
        title: 'PETROLEUM TANKER CHECKLIST',
        docNo: 'MNT-F-002',
        revisionNo: '05',
        revisionDate: '15/03/2022',
        initialIssueDate: '03/02/2017',
        nextRevisionDate: '15/04/2025'
    };
    return (
    <div className="max-w-[210mm] mx-auto text-sm leading-tight text-gray-900 font-sans p-8 bg-white min-h-[297mm] flex flex-col">
         {/* Custom Header */}
         <div className="border border-black mb-6">
             <div className="grid grid-cols-[120px_1fr_150px] divide-x divide-black border-b border-black">
                 <div className="p-2 flex items-center justify-center">
                      {settings.companyLogo ? (
                          <img src={settings.companyLogo} alt="Logo" className="w-20 object-contain" />
                      ) : (
                          <span className="font-bold text-xs">{settings.companyName}</span>
                      )}
                 </div>
                 <div className="flex flex-col">
                      <div className="border-b border-black px-2 py-1 text-xs font-medium">Doc No: {config.docNo}</div>
                      <div className="flex-1 flex items-center justify-center p-2">
                           <h1 className="text-xl font-bold uppercase tracking-wider text-center">{config.title}</h1>
                      </div>
                 </div>
                 <div className="text-xs divide-y divide-black">
                      <div className="grid grid-cols-[1fr_80px]"><span className="p-1 pl-2 border-r border-black">Initial Issue Date</span><span className="p-1 text-center">{config.initialIssueDate}</span></div>
                      <div className="grid grid-cols-[1fr_80px]"><span className="p-1 pl-2 border-r border-black">Revision Date:</span><span className="p-1 text-center">{config.revisionDate}</span></div>
                       <div className="grid grid-cols-[1fr_80px]"><span className="p-1 pl-2 border-r border-black">Revision No.</span><span className="p-1 text-center">{config.revisionNo}</span></div>
                       <div className="grid grid-cols-[1fr_80px]"><span className="p-1 pl-2 border-r border-black">Next Review Date:</span><span className="p-1 text-center">{config.nextRevisionDate}</span></div>
                 </div>
             </div>

             <div className="bg-gray-50 p-4 text-xs font-mono border-b border-black">
                 <div className="grid grid-cols-2 gap-y-2 gap-x-8">
                     <div className="flex justify-between"><span>TRUCK #:</span> <span className="font-bold">{data.truckNo}</span></div>
                     <div className="flex justify-between"><span>TRAILER #:</span> <span className="font-bold">{data.trailerNo}</span></div>
                     <div className="flex justify-between"><span>JOB CARD #:</span> <span className="font-bold">{data.jobCard}</span></div>
                     <div className="flex justify-between"><span>DATE/TIME:</span> <span className="font-bold">{new Date(data.timestamp).toLocaleString()}</span></div>
                 </div>
             </div>
         </div>

         {/* Checklist Table */}
         <div className="border border-black text-[9px] mb-4 flex-1">
             <div className="grid grid-cols-[30px_1fr_25px_25px_25px_25px_1fr] bg-gray-300 border-b border-black font-bold text-center items-center py-1">
                 <span>No.</span>
                 <span className="text-left pl-2">ITEM DESCRIPTION</span>
                 <span>C</span><span>NC</span><span>NI</span><span>NA</span>
                 <span>COMMENTS</span>
             </div>

             {PETROLEUM_V2_ITEMS.map((item, idx) => {
                 const status = data[item.id];
                 const isGood = status === InspectionStatus.GOOD;
                 const isBad = status === InspectionStatus.BAD;
                 const isNil = status === InspectionStatus.NIL;
                 const isAttn = status === InspectionStatus.ATTENTION;
                 const splitLabel = item.label.split('. ');
                 const number = splitLabel[0];
                 const text = splitLabel.slice(1).join('. ');
                 
                 let sectionHeader = null;
                 if (item.id === 'petro2_1') sectionHeader = "PRIME MOVER";
                 if (item.id === 'petro2_16') sectionHeader = "TRAILER/TANKS";
                 if (item.id === 'petro2_33') sectionHeader = "DRIVER";
                 if (item.id === 'petro2_38') sectionHeader = "SAFETY & WARNING SIGNS";
                 if (item.id === 'petro2_45') sectionHeader = "LICENCE & MANDATORY DOCUMENTS";

                 return (
                     <React.Fragment key={item.id}>
                         {sectionHeader && (
                             <div className="grid grid-cols-[1fr] bg-gray-200 border-b border-black font-bold px-2 py-0.5 text-center text-[10px] border-t border-t-black">
                                 {sectionHeader}
                             </div>
                         )}
                         <div className={`grid grid-cols-[30px_1fr_25px_25px_25px_25px_1fr] border-b border-gray-300 min-h-[20px] items-stretch ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                             <span className="text-center font-medium border-r border-gray-300 flex items-center justify-center">{number}</span>
                             <span className="pl-2 border-r border-gray-300 flex items-center py-0.5 leading-tight">{text}</span>
                             <span className="border-r border-gray-300 flex items-center justify-center font-bold">{isGood ? '✔' : ''}</span>
                             <span className="border-r border-gray-300 flex items-center justify-center font-bold">{isBad ? '✔' : ''}</span>
                             <span className="border-r border-gray-300 flex items-center justify-center font-bold">{isNil ? '✔' : ''}</span>
                             <span className="border-r border-gray-300 flex items-center justify-center font-bold">{isAttn ? '✔' : ''}</span>
                             <span className="flex items-center pl-2 italic text-gray-400 py-0.5 text-[8px]">{isBad ? 'NC' : ''}</span>
                         </div>
                     </React.Fragment>
                 );
             })}
         </div>

         {/* Safe to Load and Remarks */}
         <div className="mb-4 space-y-2">
            <table className="w-full border-collapse border border-black">
                <tbody>
                    <tr>
                        <td className="border border-black p-1.5 font-bold uppercase text-[9px] bg-gray-100 w-1/4 text-center">Safe to Load Status</td>
                        <td className={`border border-black p-1.5 font-black text-center text-sm ${data.safeToLoad === 'Yes' ? 'text-black' : 'text-red-700'}`}>
                            {data.safeToLoad?.toUpperCase() || 'N/A'}
                        </td>
                    </tr>
                </tbody>
            </table>
            <div className="border border-black p-2 min-h-[60px] text-xs">
                <span className="font-bold underline">Final Remarks:</span> {data.remarks}
            </div>
         </div>

         {/* Signatures */}
         <div className="mt-auto pt-6 grid grid-cols-2 gap-12 text-[10px] break-inside-avoid">
             <div className="flex flex-col">
                 <div className="flex justify-between border-b border-black pb-0.5">
                     <span>Inspector:</span> <span className="font-bold">{data.inspectedBy}</span>
                 </div>
                 <div className="h-12 flex items-center justify-center border-b border-black mt-1">
                    {data.inspectorSignature && <img src={data.inspectorSignature} className="max-h-full max-w-full object-contain" alt="Sig" />}
                 </div>
                 <p className="text-center font-bold uppercase text-[8px] mt-1 text-gray-500">Inspector Identification</p>
             </div>
             <div className="flex flex-col">
                 <div className="flex justify-between border-b border-black pb-0.5">
                     <span>Driver:</span> <span className="font-bold">{data.driverName}</span>
                 </div>
                 <div className="h-12 flex items-center justify-center border-b border-black mt-1">
                    {data.driverSignature && <img src={data.driverSignature} className="max-h-full max-w-full object-contain" alt="Sig" />}
                 </div>
                 <p className="text-center font-bold uppercase text-[8px] mt-1 text-gray-500">Driver Identification</p>
             </div>
         </div>
    </div>
    );
};

export default PrintablePetroleumV2Report;
