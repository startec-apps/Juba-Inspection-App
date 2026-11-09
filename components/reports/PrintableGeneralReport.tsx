import React from 'react';
import { InspectionData, SystemSettings, InspectionStatus } from '../../types';
import { INSPECTION_ITEMS } from '../../constants';

const PrintableGeneralReport: React.FC<{data: InspectionData, settings: SystemSettings}> = ({data, settings}) => {
    const config = settings.templates?.general || {
        title: 'GENERAL VEHICLE CHECKLIST',
        docNo: 'MNT-F-015',
        revisionNo: '01',
        revisionDate: '01/02/2024',
        initialIssueDate: '03/02/2017'
    };
    const dateStr = new Date(data.timestamp).toLocaleString('en-GB');
    const DEFAULT_BRAND_LOGO = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHZpZXdCb3g9JzAgMCAyNDAgNjAnIHdpZHRoPScyNDAnIGhlaWdodD0nNjAnPgo8cmVjdCB3aWR0aD0nMjQwJyBoZWlnaHQ9JzYwJyByeD0nOCcgZmlsbD0nIzBmMTcyYScvPgo8cGF0aCBkPSdNMjAgMTUgTDMyIDMwIEwyMCA0NSBMMTQgNDUgTDI2IDMwIEwxNCAxNSBaJyBmaWxsPScjMzhiZGY4Jy8+CjxwYXRoIGQ9J00zMCAxNSBMNDIgMzAgTDMwIDQ1IEwyNCA0NSBMMzYgMzAgTDI0IDE1IFonIGZpbGw9JyMwMjg0YzcnLz4KPHRleHQgeD0nNTInIHk9JzMyJyBmaWxsPScjZmZmZmZmJyBmb250LWZhbWlseT0nQXJpYWwsIEhlbHZldGljYSwgc2Fucy1zZXJpZicgZm9udC13ZWlnaHQ9JzkwMCcgZm9udC1zaXplPScxOCcgbGV0dGVyLXNwYWNpbmc9JzInPkpVQkE8L3RleHQ+Cjx0ZXh0IHg9JzExMicgeT0nMzInIGZpbGw9JyMzOGJkZjgnIGZvbnQtZmFtaWx5PSdBcmlhbCwgSGVsdmV0aWNhLCBzYW5zLXNlcmlmJyBmb250LXdlaWdodD0nODAwJyBmb250LXNpemU9JzE4JyBsZXR0ZXItc3BhY2luZz0nMSc+VFJBTlNQT1JUPC90ZXh0Pgo8dGV4dCB4PSc1MycgeT0nNDYnIGZpbGw9JyM5NGEzYjgnIGZvbnQtZmFtaWx5PSdBcmlhbCwgSGVsdmV0aWNhLCBzYW5zLXNlcmlmJyBmb250LXdlaWdodD0nNzAwJyBmb250LXNpemU9JzgnIGxldHRlci1zcGFjaW5nPScyLjUnPlNBRkVUWSDigKIgUVVBTElUWSDigKIgRkxFRVQ8L3RleHQ+Cjwvc3ZnPg==";
    const rawLogo = settings.companyLogo;
    const logoUrl = (rawLogo && !rawLogo.includes('juba-transport.com')) ? rawLogo : DEFAULT_BRAND_LOGO;
    
    // Split items into two columns for the checklist layout
    const items = INSPECTION_ITEMS;
    const half = Math.ceil(items.length / 2);
    const leftColItems = items.slice(0, half);
    const rightColItems = items.slice(half);

    const renderItemRow = (item: typeof items[0]) => {
      const status = String(data[item.id] || 'NIL').trim().toUpperCase();
      const isBad = status === 'BAD';
      const isAttention = status === 'NEEDS ATTENTION';
      const isNil = status === 'NIL' || status === 'N/A' || status === '';
      
      let statusColor = '#000000';
      let statusWeight = '800';
      
      if (isBad) {
        statusColor = '#dc2626';
      } else if (isAttention) {
        statusColor = '#d97706';
      } else if (isNil) {
        statusColor = '#64748b';
        statusWeight = '500';
      }

      return (
        <tr key={item.id}>
          <td style={{ padding: '7px 10px', fontSize: '10px', color: '#000000', fontWeight: 500, width: '70%', borderBottom: '1px solid #e2e8f0', backgroundColor: '#ffffff' }}>
            {item.label}
          </td>
          <td style={{ padding: '7px 10px', fontSize: '10px', textAlign: 'right', textTransform: 'uppercase', color: statusColor, fontWeight: statusWeight, borderBottom: '1px solid #e2e8f0', backgroundColor: '#ffffff' }}>
            {status || 'NIL'}
          </td>
        </tr>
      );
    };

    return (
        <div style={{ fontFamily: 'Helvetica, Arial, sans-serif' }} className="max-w-[210mm] mx-auto text-[12px] leading-[1.2] text-[#000000] p-[15mm] bg-white min-h-[297mm] flex flex-col box-border">
            {/* LOGO IN TOP RIGHT */}
            <div className="flex justify-end mb-4">
              <img src={logoUrl} alt="Company Logo" className="h-[60px] object-contain" />
            </div>

            {/* HEADER GRID */}
            <table className="w-full border-collapse mb-2" style={{ border: '1.5px solid #000' }}>
              <tbody>
                <tr>
                  <td style={{ border: '1.5px solid #000', padding: '6px 12px', fontSize: '10px', fontWeight: 'bold', width: '33%' }}>Doc. No. {config.docNo}</td>
                  <td style={{ border: '1.5px solid #000', padding: '6px 12px', fontSize: '10px', fontWeight: 'bold', width: '33%' }}>Revision No.: {config.revisionNo}</td>
                  <td style={{ border: '1.5px solid #000', padding: '6px 12px', fontSize: '10px', fontWeight: 'bold', width: '34%', textAlign: 'right' }}>Date: {dateStr}</td>
                </tr>
              </tbody>
            </table>

            {/* TITLE BOX */}
            <div className="text-center mb-4 bg-white" style={{ border: '1.5px solid #000', padding: '10px' }}>
              <h1 className="m-0 text-[18px] font-black tracking-[1px] uppercase">{config.title}</h1>
            </div>

            {/* VEHICLE DETAILS */}
            <table className="w-full border-collapse mb-4" style={{ border: '1px solid #cbd5e1' }}>
              <tbody>
                <tr>
                  <td style={{ padding: '8px 12px', fontSize: '9px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', border: '1px solid #cbd5e1', width: '110px' }}>REG NO:</td>
                  <td style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 'bold', color: '#000', border: '1px solid #cbd5e1' }}>{data.truckNo || 'N/A'}</td>
                  <td style={{ padding: '8px 12px', fontSize: '9px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', border: '1px solid #cbd5e1', width: '110px' }}>TRAILER/UNIT:</td>
                  <td style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 'bold', color: '#000', border: '1px solid #cbd5e1' }}>{data.trailerNo || 'N/A'}</td>
                </tr>
                <tr>
                  <td style={{ padding: '8px 12px', fontSize: '9px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', border: '1px solid #cbd5e1' }}>DRIVER NAME:</td>
                  <td style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 'bold', color: '#000', border: '1px solid #cbd5e1' }}>{data.driverName || 'N/A'}</td>
                  <td style={{ padding: '8px 12px', fontSize: '9px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', border: '1px solid #cbd5e1' }}>INSPECTED BY:</td>
                  <td style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 'bold', color: '#000', border: '1px solid #cbd5e1' }}>{data.inspectedBy || 'N/A'}</td>
                </tr>
                <tr>
                  <td style={{ padding: '8px 12px', fontSize: '9px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', border: '1px solid #cbd5e1' }}>LOCATION:</td>
                  <td style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 'bold', color: '#000', border: '1px solid #cbd5e1' }}>{data.location || 'N/A'}</td>
                  <td style={{ padding: '8px 12px', fontSize: '9px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', border: '1px solid #cbd5e1' }}>ODOMETER:</td>
                  <td style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 'bold', color: '#000', border: '1px solid #cbd5e1' }}>{data.odometer || '0'} km</td>
                </tr>
              </tbody>
            </table>

            {/* CHECKLIST DUAL COLUMNS */}
            <table className="w-full border-collapse">
                <tbody>
                    <tr>
                        <td style={{ width: '48%', verticalAlign: 'top' }}>
                            <table className="w-full border-collapse">
                                <tbody>{leftColItems.map(renderItemRow)}</tbody>
                            </table>
                        </td>
                        <td style={{ width: '4%' }}></td>
                        <td style={{ width: '48%', verticalAlign: 'top' }}>
                            <table className="w-full border-collapse">
                                <tbody>{rightColItems.map(renderItemRow)}</tbody>
                            </table>
                        </td>
                    </tr>
                </tbody>
            </table>

            {/* SAFE TO LOAD STATUS */}
            <table className="w-full border-collapse mt-4" style={{ border: '1.5px solid #000' }}>
              <tbody>
                <tr>
                  <td style={{ padding: '10px 15px', fontSize: '10px', fontWeight: 'bold', color: '#000', textTransform: 'uppercase', backgroundColor: '#f8fafc', borderRight: '1.5px solid #000', width: '25%' }}>SAFE TO LOAD</td>
                  <td style={{ padding: '10px 15px', fontSize: '14px', fontWeight: 900, textAlign: 'center', textTransform: 'uppercase', color: data.safeToLoad === 'Yes' ? '#16a34a' : '#dc2626' }}>
                    {String(data.safeToLoad || 'NOT SPECIFIED').toUpperCase()}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* REMARKS */}
            <div className="mt-4" style={{ border: '1px solid #cbd5e1', padding: '12px', minHeight: '60px' }}>
              <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>INSPECTOR REMARKS:</span>
              <div style={{ fontSize: '11px', fontStyle: 'italic', color: '#1e293b' }}>
                {data.remarks || 'No additional remarks provided.'}
              </div>
            </div>

            {/* SIGNATURES */}
            <table className="w-full mt-auto" style={{ borderTop: '1.5px solid #000', paddingTop: '15px' }}>
                <tbody>
                    <tr>
                        <td style={{ width: '50%', textAlign: 'center' }}>
                            <div style={{ borderBottom: '1px solid #000', height: '50px', width: '80%', margin: '0 auto 6px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                                {data.driverSignature && <img src={data.driverSignature} style={{ maxHeight: '45px', objectFit: 'contain' }} alt="Driver" />}
                            </div>
                            <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' }}>DRIVER ACKNOWLEDGEMENT</span>
                        </td>
                        <td style={{ width: '50%', textAlign: 'center' }}>
                            <div style={{ borderBottom: '1px solid #000', height: '50px', width: '80%', margin: '0 auto 6px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                                {data.inspectorSignature && <img src={data.inspectorSignature} style={{ maxHeight: '45px', objectFit: 'contain' }} alt="Inspector" />}
                            </div>
                            <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' }}>INSPECTOR OFFICIAL SIGNATURE</span>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
};

export default PrintableGeneralReport;