/**
 * GeneralreportPDF.gs
 * Professional template for General Vehicle Inspection
 */

export const CODE_6_GENERAL_REPORT_PDF = `/**
 * GeneralreportPDF.gs - Juba Style Professional Template (High Compatibility Version)
 */

const GeneralReportTemplate = {
  DEFAULT_LOGO: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHZpZXdCb3g9JzAgMCAyNDAgNjAnIHdpZHRoPScyNDAnIGhlaWdodD0nNjAnPgo8cmVjdCB3aWR0aD0nMjQwJyBoZWlnaHQ9JzYwJyByeD0nOCcgZmlsbD0nIzBmMTcyYScvPgo8cGF0aCBkPSdNMjAgMTUgTDMyIDMwIEwyMCA0NSBMMTQgNDUgTDI2IDMwIEwxNCAxNSBaJyBmaWxsPScjMzhiZGY4Jy8+CjxwYXRoIGQ9J00zMCAxNSBMNDIgMzAgTDMwIDQ1IEwyNCA0NSBMMzYgMzAgTDI0IDE1IFonIGZpbGw9JyMwMjg0YzcnLz4KPHRleHQgeD0nNTInIHk9JzMyJyBmaWxsPScjZmZmZmZmJyBmb250LWZhbWlseT0nQXJpYWwsIEhlbHZldGljYSwgc2Fucy1zZXJpZicgZm9udC13ZWlnaHQ9JzkwMCcgZm9udC1zaXplPScxOCcgbGV0dGVyLXNwYWNpbmc9JzInPkpVQkE8L3RleHQ+Cjx0ZXh0IHg9JzExMicgeT0nMzInIGZpbGw9JyMzOGJkZjgnIGZvbnQtZmFtaWx5PSdBcmlhbCwgSGVsdmV0aWNhLCBzYW5zLXNlcmlmJyBmb250LXdlaWdodD0nODAwJyBmb250LXNpemU9JzE4JyBsZXR0ZXItc3BhY2luZz0nMSc+VFJBTlNQT1JUPC90ZXh0Pgo8dGV4dCB4PSc1MycgeT0nNDYnIGZpbGw9JyM5NGEzYjgnIGZvbnQtZmFtaWx5PSdBcmlhbCwgSGVsdmV0aWNhLCBzYW5zLXNlcmlmJyBmb250LXdlaWdodD0nNzAwJyBmb250LXNpemU9JzgnIGxldHRlci1zcGFjaW5nPScyLjUnPlNBRkVUWSDigKIgUVVBTElUWSDigKIgRkxFRVQ8L3RleHQ+Cjwvc3ZnPg==",
  generate: function(data) {
    const dateStr = new Date(data.timestamp).toLocaleString('en-GB');
    var rawLogo = data.companyLogo;
    var logoUrl = (rawLogo && String(rawLogo).indexOf('juba-transport.com') === -1) ? rawLogo : GeneralReportTemplate.DEFAULT_LOGO;
    
    // Robust multi-source signature resolution
    var sigs = data.signatures;
    if (typeof sigs === 'string') {
      try { sigs = JSON.parse(sigs); } catch (e) { sigs = {}; }
    }
    var inspectorSig = (sigs && sigs.inspector) || data.inspectorSignature || data.inspector_signature || '';
    var driverSig = (sigs && sigs.driver) || data.driverSignature || data.driver_signature || '';

    const config = data.templateConfig || {
        title: 'GENERAL VEHICLE CHECKLIST',
        docNo: 'MNT-F-015',
        revisionNo: '01',
        revisionDate: '01/02/2024',
        initialIssueDate: '03/02/2017'
    };
    
    const items = data.items || [];
    const half = Math.ceil(items.length / 2);
    const leftCol = items.slice(0, half);
    const rightCol = items.slice(half);

    const renderItemRow = (item) => {
      const status = String(item.status || 'NIL').trim().toUpperCase();
      const isGood = status === 'GOOD';
      const isBad = status === 'BAD';
      const isAttention = status === 'NEEDS ATTENTION';
      const isNil = status === 'NIL' || status === 'N/A' || status === '';
      
      let rowBg = '#ffffff'; 
      let statusColor = '#000000';
      let statusWeight = '800';
      
      if (isBad) {
        rowBg = '#fee2e2'; 
        statusColor = '#dc2626';
      } else if (isAttention) {
        rowBg = '#fef3c7'; 
        statusColor = '#d97706';
      } else if (isNil) {
        rowBg = '#f1f5f9'; 
        statusColor = '#64748b';
        statusWeight = '500';
      } else if (isGood) {
        rowBg = '#ffffff'; 
        statusColor = '#000000';
        statusWeight = '600';
      }

      // Apply background to TDs for 100% renderer compatibility
      return \`
        <tr>
          <td style="padding: 7px 10px; font-size: 10px; color: #000000; font-weight: 500; width: 75%; border-bottom: 1px solid #e2e8f0; background-color: \${rowBg};">\${item.label}</td>
          <td style="padding: 7px 10px; font-size: 10px; text-align: right; text-transform: uppercase; color: \${statusColor}; font-weight: \${statusWeight}; border-bottom: 1px solid #e2e8f0; background-color: \${rowBg};">\${item.status || 'NIL'}</td>
        </tr>\`;
    };

    let checklistRows = "";
    for (let i = 0; i < half; i++) {
        const left = leftCol[i];
        const right = rightCol[i];
        
        checklistRows += "<tr>";
        checklistRows += '<td style="width: 48%; vertical-align: top; padding-right: 10px;">' +
                         '<table style="width: 100%; border-collapse: collapse;">' + 
                         (left ? renderItemRow(left) : "") + 
                         '</table></td>';
        checklistRows += '<td style="width: 4%;"></td>';
        checklistRows += '<td style="width: 48%; vertical-align: top; padding-left: 10px;">' +
                         '<table style="width: 100%; border-collapse: collapse;">' + 
                         (right ? renderItemRow(right) : "") + 
                         '</table></td>';
        checklistRows += "</tr>";
    }

    return \`
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Helvetica, Arial, sans-serif; margin: 0; padding: 10px; color: #000; line-height: 1.2; }
          .header-grid { width: 100%; border-collapse: collapse; margin-bottom: 8px; border: 1px solid #000; }
          .header-grid td { border: 1px solid #000; padding: 5px 10px; font-size: 9px; font-weight: bold; }
          .title-box { border: 1px solid #000; padding: 8px; text-align: center; margin-bottom: 12px; background: #fff; }
          .title-text { margin: 0; font-size: 16px; font-weight: bold; letter-spacing: 1px; }
          
          .details-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; border: 1px solid #cbd5e1; }
          .details-table td { padding: 7px 12px; font-size: 10px; border: 1px solid #cbd5e1; }
          .label { color: #94a3b8; font-weight: bold; text-transform: uppercase; font-size: 8px; width: 110px; background-color: transparent; }
          .value { color: #000; font-weight: bold; font-size: 11px; }
          
          .checklist-container { width: 100%; border-collapse: collapse; }
          
          .status-decision { width: 100%; border: 1px solid #cbd5e1; border-collapse: collapse; margin-top: 10px; }
          .status-decision td { padding: 7px 15px; font-weight: bold; }
          .status-label { font-size: 9px; color: #64748b; text-transform: uppercase; width: 25%; background-color: #f8fafc; border-right: 1px solid #cbd5e1; }
          .status-value { font-size: 11px; text-align: center; font-weight: 900; }
          
          .remarks-box { border: 1px solid #cbd5e1; padding: 8px; margin-top: 10px; min-height: 45px; }
          .remarks-label { font-size: 8px; font-weight: bold; color: #94a3b8; text-transform: uppercase; margin-bottom: 3px; display: block; }
          
          .sig-table { width: 100%; margin-top: 20px; border-top: 1px solid #000; padding-top: 8px; border-collapse: collapse; }
          .sig-cell { width: 48%; text-align: center; vertical-align: top; padding: 5px; }
          .sig-text { font-size: 9px; font-weight: bold; color: #000; text-transform: uppercase; }
        </style>
      </head>
      <body>
        <div style="text-align: center; margin-bottom: 12px;">
          <img src="\${logoUrl}" alt="Company Logo" style="max-height: 55px; max-width: 220px; height: auto; width: auto; object-fit: contain; vertical-align: middle; border: 0;" />
        </div>

        <table class="header-grid">
          <tr>
            <td style="width: 33%;">Doc. No. \${config.docNo}</td>
            <td style="width: 33%;">Revision No.: \${config.revisionNo}</td>
            <td style="width: 34%; text-align: right;">Date: \${dateStr}</td>
          </tr>
        </table>

        <div class="title-box">
          <h1 class="title-text">\${config.title}</h1>
        </div>

        <table class="details-table">
          <tr>
            <td class="label">REG NO:</td>
            <td class="value">\${data.truckNo || 'N/A'}</td>
            <td class="label">TRAILER/UNIT:</td>
            <td class="value">\${data.trailerNo || 'N/A'}</td>
          </tr>
          <tr>
            <td class="label">DRIVER NAME:</td>
            <td class="value">\${data.driverName || 'N/A'}</td>
            <td class="label">INSPECTED BY:</td>
            <td class="value">\${data.inspectedBy || 'N/A'}</td>
          </tr>
          <tr>
            <td class="label">LOCATION:</td>
            <td class="value">\${data.location || 'N/A'}</td>
            <td class="label">ODOMETER:</td>
            <td class="value">\${data.odometer || '0'} km</td>
          </tr>
        </table>

        <table class="checklist-container">
           \${checklistRows}
        </table>

        <table class="status-decision">
          <tr>
            <td class="status-label">SAFE TO LOAD</td>
            <td class="status-value" style="color: \${data.safeToLoad === 'Yes' ? '#16a34a' : '#dc2626'};">
              \${String(data.safeToLoad || 'NOT SPECIFIED').toUpperCase()}
            </td>
          </tr>
        </table>

        <div class="remarks-box">
          <span class="remarks-label">INSPECTOR REMARKS:</span>
          <div style="font-size: 11px; font-style: italic; color: #1e293b; margin-top: 2px;">\${data.remarks || 'No additional remarks provided.'}</div>
        </div>

        <table class="sig-table">
          <tr>
            <td class="sig-cell">
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 6px;">
                <tr>
                  <td style="height: 50px; text-align: center; vertical-align: middle; border-bottom: 1px solid #000;">
                    \${driverSig ? \`<img src="\${driverSig}" style="max-height: 45px; max-width: 180px; height: auto; width: auto; object-fit: contain; vertical-align: middle; border: 0;" alt="Driver Signature" />\` : '<span style="font-size: 9px; color: #94a3b8; font-style: italic;">[Driver Signature Recorded]</span>'}
                  </td>
                </tr>
              </table>
              <span class="sig-text">DRIVER ACKNOWLEDGEMENT</span>
              <div style="font-size: 8px; color: #64748b; margin-top: 2px;">\${data.driverName || 'N/A'}</div>
            </td>
            <td style="width: 4%;"></td>
            <td class="sig-cell">
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 6px;">
                <tr>
                  <td style="height: 50px; text-align: center; vertical-align: middle; border-bottom: 1px solid #000;">
                    \${inspectorSig ? \`<img src="\${inspectorSig}" style="max-height: 45px; max-width: 180px; height: auto; width: auto; object-fit: contain; vertical-align: middle; border: 0;" alt="Inspector Signature" />\` : '<span style="font-size: 9px; color: #94a3b8; font-style: italic;">[Inspector Signature Recorded]</span>'}
                  </td>
                </tr>
              </table>
              <span class="sig-text">INSPECTOR OFFICIAL SIGNATURE</span>
              <div style="font-size: 8px; color: #64748b; margin-top: 2px;">\${data.inspectedBy || 'N/A'}</div>
            </td>
          </tr>
        </table>
      </body>
      </html>\`;
  }
};
`;