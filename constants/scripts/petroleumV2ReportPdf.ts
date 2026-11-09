/**
 * PetroV2reportPDF.gs
 * High-fidelity template for Petroleum Tanker Checklist V2
 */

export const CODE_9_PETROLEUM_V2_REPORT_PDF = `/**
 * PetroV2reportPDF.gs - Petroleum V2 Industrial Template
 */

const PetroleumV2ReportTemplate = {
  DEFAULT_LOGO: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHZpZXdCb3g9JzAgMCAyNDAgNjAnIHdpZHRoPScyNDAnIGhlaWdodD0nNjAnPgo8cmVjdCB3aWR0aD0nMjQwJyBoZWlnaHQ9JzYwJyByeD0nOCcgZmlsbD0nIzBmMTcyYScvPgo8cGF0aCBkPSdNMjAgMTUgTDMyIDMwIEwyMCA0NSBMMTQgNDUgTDI2IDMwIEwxNCAxNSBaJyBmaWxsPScjMzhiZGY4Jy8+CjxwYXRoIGQ9J00zMCAxNSBMNDIgMzAgTDMwIDQ1IEwyNCA0NSBMMzYgMzAgTDI0IDE1IFonIGZpbGw9JyMwMjg0YzcnLz4KPHRleHQgeD0nNTInIHk9JzMyJyBmaWxsPScjZmZmZmZmJyBmb250LWZhbWlseT0nQXJpYWwsIEhlbHZldGljYSwgc2Fucy1zZXJpZicgZm9udC13ZWlnaHQ9JzkwMCcgZm9udC1zaXplPScxOCcgbGV0dGVyLXNwYWNpbmc9JzInPkpVQkE8L3RleHQ+Cjx0ZXh0IHg9JzExMicgeT0nMzInIGZpbGw9JyMzOGJkZjgnIGZvbnQtZmFtaWx5PSdBcmlhbCwgSGVsdmV0aWNhLCBzYW5zLXNlcmlmJyBmb250LXdlaWdodD0nODAwJyBmb250LXNpemU9JzE4JyBsZXR0ZXItc3BhY2luZz0nMSc+VFJBTlNQT1JUPC90ZXh0Pgo8dGV4dCB4PSc1MycgeT0nNDYnIGZpbGw9JyM5NGEzYjgnIGZvbnQtZmFtaWx5PSdBcmlhbCwgSGVsdmV0aWNhLCBzYW5zLXNlcmlmJyBmb250LXdlaWdodD0nNzAwJyBmb250LXNpemU9JzgnIGxldHRlci1zcGFjaW5nPScyLjUnPlNBRkVUWSDigKIgUVVBTElUWSDigKIgRkxFRVQ8L3RleHQ+Cjwvc3ZnPg==",
  generate: function(data) {
    const dateStr = new Date(data.timestamp).toLocaleString('en-GB');
    var rawLogo = data.companyLogo;
    var logoUrl = (rawLogo && String(rawLogo).indexOf('juba-transport.com') === -1) ? rawLogo : PetroleumV2ReportTemplate.DEFAULT_LOGO;
    
    // Robust multi-source signature resolution
    var sigs = data.signatures;
    if (typeof sigs === 'string') {
      try { sigs = JSON.parse(sigs); } catch (e) { sigs = {}; }
    }
    var inspectorSig = (sigs && sigs.inspector) || data.inspectorSignature || data.inspector_signature || '';
    var driverSig = (sigs && sigs.driver) || data.driverSignature || data.driver_signature || '';

    const config = data.templateConfig || {
        title: 'PETROLEUM TANKER CHECKLIST',
        docNo: 'MNT-F-002',
        revisionNo: '05',
        revisionDate: '15/03/2022',
        initialIssueDate: '03/02/2017',
        nextRevisionDate: '15/04/2025'
    };
    
    const items = data.items || [];
    const checkMark = "✔";

    const renderItemRow = (item, idx) => {
      const status = String(item.status || '').trim().toUpperCase();
      const isGood = status === 'GOOD' || status === 'COMPLIANT' || status === 'C';
      const isBad = status === 'BAD' || status === 'NON-COMPLIANT' || status === 'NC';
      const isNi = status === 'NI' || status === 'NIL' || status === 'NOT INSPECTED';
      const isNa = status === 'NA' || status === 'NEEDS ATTENTION' || status === 'NOT APPLICABLE';
      
      const label = item.label || "";
      let number = "";
      let text = label;
      
      const match = label.match(/^(\d+)\.\s*(.*)$/);
      if (match) {
        number = match[1];
        text = match[2];
      }
      
      const rowBg = idx % 2 === 0 ? '#ffffff' : '#f9fafb';
      
      return \`
        <tr style="background-color: \${rowBg};">
          <td style="border: 1px solid #000; text-align: center; font-size: 10px; width: 35px; height: 24px; vertical-align: middle;">\${number}</td>
          <td style="border: 1px solid #000; padding: 4px 8px; font-size: 10px; width: 45%; vertical-align: middle; line-height: 1.2;">\${text}</td>
          <td style="border: 1px solid #000; text-align: center; font-size: 14px; font-weight: bold; width: 30px; vertical-align: middle; color: #16a34a;">\${isGood ? checkMark : ''}</td>
          <td style="border: 1px solid #000; text-align: center; font-size: 14px; font-weight: bold; width: 30px; vertical-align: middle; color: #dc2626;">\${isBad ? checkMark : ''}</td>
          <td style="border: 1px solid #000; text-align: center; font-size: 14px; font-weight: bold; width: 30px; vertical-align: middle; color: #64748b;">\${isNi ? checkMark : ''}</td>
          <td style="border: 1px solid #000; text-align: center; font-size: 14px; font-weight: bold; width: 30px; vertical-align: middle; color: #d97706;">\${isNa ? checkMark : ''}</td>
          <td style="border: 1px solid #000; padding: 4px 8px; font-size: 9px; font-style: italic; color: #64748b; vertical-align: middle;">\${isBad ? 'NC' : (item.comments || '')}</td>
        </tr>\`;
    };

    let tableContent = "";
    items.forEach((item, idx) => {
        let sectionHeader = null;
        if (item.id === 'petro2_1') sectionHeader = "PRIME MOVER";
        else if (item.id === 'petro2_16') sectionHeader = "TRAILER/TANKS";
        else if (item.id === 'petro2_33') sectionHeader = "DRIVER";
        else if (item.id === 'petro2_38') sectionHeader = "SAFETY & WARNING SIGNS";
        else if (item.id === 'petro2_45') sectionHeader = "LICENCE & MANDATORY DOCUMENTS";

        if (sectionHeader) {
          tableContent += \`<tr><td colspan="7" style="background-color: #f1f5f9; border: 1px solid #000; padding: 8px; font-size: 11px; font-weight: bold; text-transform: uppercase; text-align: center;">\${sectionHeader}</td></tr>\`;
        }
        tableContent += renderItemRow(item, idx);
    });

    return \`
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Helvetica, Arial, sans-serif; margin: 0; padding: 20px; color: #000; background-color: #fff; line-height: 1.2; }
          .master-container { width: 100%; max-width: 800px; margin: 0 auto; border: 1px solid #000; }
          
          /* Header */
          .header-grid { width: 100%; border-collapse: collapse; border-bottom: 1px solid #000; }
          .header-grid td { border: 1px solid #000; padding: 0; vertical-align: top; }
          .logo-cell { width: 120px; text-align: center; vertical-align: middle !important; padding: 8px !important; }
          .title-inner-grid { width: 100%; border-collapse: collapse; height: 100%; }
          .doc-no-row { border-bottom: 1px solid #000; padding: 4px 10px; font-size: 11px; }
          .title-row { height: 70px; text-align: center; vertical-align: middle; padding: 5px; font-size: 20px; font-weight: bold; text-transform: uppercase; border-bottom: none; }
          
          .meta-inner-grid { width: 100%; border-collapse: collapse; font-size: 9px; }
          .meta-inner-grid td { border: none !important; border-bottom: 1px solid #000 !important; border-left: 1px solid #000 !important; padding: 5px 8px !important; }
          .meta-inner-grid tr:last-child td { border-bottom: none !important; }
          .meta-label { width: 55%; font-weight: bold; }
          .meta-val { text-align: center; }

          /* Asset Info */
          .asset-grid { width: 100%; border-collapse: collapse; border-bottom: 1px solid #000; background-color: #f9fafb; }
          .asset-grid td { border: 1px solid #000; padding: 8px 15px; font-size: 11px; font-family: monospace; }
          .label { color: #475569; }
          .value { font-weight: bold; font-size: 12px; }

          /* Main Checklist */
          .checklist-table { width: 100%; border-collapse: collapse; }
          .checklist-table thead th { background-color: #cbd5e1; border: 1px solid #000; padding: 8px; font-size: 10px; font-weight: bold; text-transform: uppercase; }

          /* Footer Decision */
          .decision-area { border-top: 1px solid #000; padding: 15px; }
          .decision-box { width: 100%; border-collapse: collapse; border: 1.5px solid #000; margin-bottom: 15px; }
          .decision-side { width: 25%; background: #f8fafc; padding: 10px; text-align: center; font-weight: bold; font-size: 10px; border-right: 1.5px solid #000; }
          .decision-main { text-align: center; font-size: 18px; font-weight: 900; }
          
          .remarks-box { border: 1px solid #000; padding: 12px; min-height: 60px; font-size: 12px; }
          .remarks-label { font-weight: bold; font-size: 9px; text-decoration: underline; display: block; margin-bottom: 5px; color: #475569; }
          
          .sig-table { width: 100%; margin-top: 25px; border-top: 1px solid #000; padding-top: 15px; border-collapse: collapse; }
          .sig-cell { width: 46%; text-align: center; vertical-align: top; }
          .sig-sub { font-size: 9px; font-weight: bold; color: #94a3b8; text-transform: uppercase; }
        </style>
      </head>
      <body>
        <div class="master-container">
          <table class="header-grid">
            <tr>
              <td class="logo-cell">
                <img src="\${logoUrl}" alt="Company Logo" style="max-height: 55px; max-width: 110px; height: auto; width: auto; object-fit: contain; vertical-align: middle; border: 0;" />
              </td>
              <td class="title-cell">
                <table class="title-inner-grid">
                  <tr><td class="doc-no-row">Doc No: \${config.docNo}</td></tr>
                  <tr><td class="title-row">\${config.title}</td></tr>
                </table>
              </td>
              <td class="meta-cell">
                <table class="meta-inner-grid">
                  <tr><td class="meta-label">Issue Date</td><td class="meta-val">\${config.initialIssueDate}</td></tr>
                  <tr><td class="meta-label">Rev Date:</td><td class="meta-val">\${config.revisionDate}</td></tr>
                  <tr><td class="meta-label">Rev No.</td><td class="meta-val">\${config.revisionNo}</td></tr>
                  <tr><td class="meta-label">Next Review</td><td class="meta-val">\${config.nextRevisionDate || config.nextReviewDate}</td></tr>
                </table>
              </td>
            </tr>
          </table>

          <table class="asset-grid">
            <tr>
              <td width="50%"><span class="label">TRUCK #:</span> <span class="value">\${data.truckNo || 'N/A'}</span></td>
              <td width="50%"><span class="label">TRAILER #:</span> <span class="value">\${data.trailerNo || 'N/A'}</span></td>
            </tr>
            <tr>
              <td><span class="label">JOB CARD #:</span> <span class="value">\${data.jobCard || data.jobCardNo || 'N/A'}</span></td>
              <td><span class="label">DATE/TIME:</span> <span class="value">\${dateStr}</span></td>
            </tr>
          </table>
          
          <table class="checklist-table">
            <thead>
              <tr>
                <th width="35">No.</th>
                <th style="text-align: left; padding-left: 10px;">ITEM DESCRIPTION</th>
                <th width="30">C</th>
                <th width="30">NC</th>
                <th width="30">NI</th>
                <th width="30">NA</th>
                <th style="text-align: left; padding-left: 10px;">COMMENTS</th>
              </tr>
            </thead>
            <tbody>
              \${tableContent}
            </tbody>
          </table>

          <div class="decision-area">
            <table class="decision-box">
              <tr>
                <td class="decision-side">SAFE TO LOAD STATUS</td>
                <td class="decision-main" style="color: \${data.safeToLoad === 'Yes' ? '#16a34a' : '#dc2626'};">
                  \${(data.safeToLoad || 'NOT SPECIFIED').toUpperCase()}
                </td>
              </tr>
            </table>

            <div class="remarks-box">
              <span class="remarks-label">INSPECTOR REMARKS:</span>
              <div style="font-style: italic; color: #1e293b;">\${data.remarks || 'No additional remarks provided.'}</div>
            </div>

            <table class="sig-table">
              <tr>
                <td class="sig-cell">
                  <table style="width: 100%; border-collapse: collapse; border-bottom: 1px solid #000; font-size: 11px; font-weight: bold; margin-bottom: 4px;">
                    <tr>
                      <td style="text-align: left; padding: 0 4px 3px 4px;">Inspector:</td>
                      <td style="text-align: right; padding: 0 4px 3px 4px;">\${data.inspectedBy || 'N/A'}</td>
                    </tr>
                  </table>
                  <table style="width: 100%; border-collapse: collapse; margin: 4px auto 6px auto;">
                    <tr>
                      <td style="height: 50px; text-align: center; vertical-align: middle; border-bottom: 1px dotted #000;">
                        \${inspectorSig ? \`<img src="\${inspectorSig}" style="max-height: 45px; max-width: 180px; height: auto; width: auto; object-fit: contain; vertical-align: middle; border: 0;" alt="Inspector Signature" />\` : '<span style="font-size: 9px; color: #94a3b8; font-style: italic;">[Inspector Signature Recorded]</span>'}
                      </td>
                    </tr>
                  </table>
                  <span class="sig-sub">Inspector Identification</span>
                </td>
                <td style="width: 8%;"></td>
                <td class="sig-cell">
                  <table style="width: 100%; border-collapse: collapse; border-bottom: 1px solid #000; font-size: 11px; font-weight: bold; margin-bottom: 4px;">
                    <tr>
                      <td style="text-align: left; padding: 0 4px 3px 4px;">Driver:</td>
                      <td style="text-align: right; padding: 0 4px 3px 4px;">\${data.driverName || 'N/A'}</td>
                    </tr>
                  </table>
                  <table style="width: 100%; border-collapse: collapse; margin: 4px auto 6px auto;">
                    <tr>
                      <td style="height: 50px; text-align: center; vertical-align: middle; border-bottom: 1px dotted #000;">
                        \${driverSig ? \`<img src="\${driverSig}" style="max-height: 45px; max-width: 180px; height: auto; width: auto; object-fit: contain; vertical-align: middle; border: 0;" alt="Driver Signature" />\` : '<span style="font-size: 9px; color: #94a3b8; font-style: italic;">[Driver Signature Recorded]</span>'}
                      </td>
                    </tr>
                  </table>
                  <span class="sig-sub">Driver Identification</span>
                </td>
              </tr>
            </table>
          </div>
        </div>
      </body>
      </html>\`;
  }
};

`;
