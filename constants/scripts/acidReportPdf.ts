/**
 * AcidreportPDF.gs
 * High-fidelity template for Acid Tanker Checklist (MNT-F-013)
 */

export const CODE_8_ACID_REPORT_PDF = `/**
 * AcidreportPDF.gs - Acid Tanker Industrial Template
 */

const AcidReportTemplate = {
  DEFAULT_LOGO: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHZpZXdCb3g9JzAgMCAyNDAgNjAnIHdpZHRoPScyNDAnIGhlaWdodD0nNjAnPgo8cmVjdCB3aWR0aD0nMjQwJyBoZWlnaHQ9JzYwJyByeD0nOCcgZmlsbD0nIzBmMTcyYScvPgo8cGF0aCBkPSdNMjAgMTUgTDMyIDMwIEwyMCA0NSBMMTQgNDUgTDI2IDMwIEwxNCAxNSBaJyBmaWxsPScjMzhiZGY4Jy8+CjxwYXRoIGQ9J00zMCAxNSBMNDIgMzAgTDMwIDQ1IEwyNCA0NSBMMzYgMzAgTDI0IDE1IFonIGZpbGw9JyMwMjg0YzcnLz4KPHRleHQgeD0nNTInIHk9JzMyJyBmaWxsPScjZmZmZmZmJyBmb250LWZhbWlseT0nQXJpYWwsIEhlbHZldGljYSwgc2Fucy1zZXJpZicgZm9udC13ZWlnaHQ9JzkwMCcgZm9udC1zaXplPScxOCcgbGV0dGVyLXNwYWNpbmc9JzInPkpVQkE8L3RleHQ+Cjx0ZXh0IHg9JzExMicgeT0nMzInIGZpbGw9JyMzOGJkZjgnIGZvbnQtZmFtaWx5PSdBcmlhbCwgSGVsdmV0aWNhLCBzYW5zLXNlcmlmJyBmb250LXdlaWdodD0nODAwJyBmb250LXNpemU9JzE4JyBsZXR0ZXItc3BhY2luZz0nMSc+VFJBTlNQT1JUPC90ZXh0Pgo8dGV4dCB4PSc1MycgeT0nNDYnIGZpbGw9JyM5NGEzYjgnIGZvbnQtZmFtaWx5PSdBcmlhbCwgSGVsdmV0aWNhLCBzYW5zLXNlcmlmJyBmb250LXdlaWdodD0nNzAwJyBmb250LXNpemU9JzgnIGxldHRlci1zcGFjaW5nPScyLjUnPlNBRkVUWSDigKIgUVVBTElUWSDigKIgRkxFRVQ8L3RleHQ+Cjwvc3ZnPg==",
  generate: function(data) {
    const dateStr = new Date(data.timestamp).toLocaleString('en-GB');
    var rawLogo = data.companyLogo;
    var logoUrl = (rawLogo && String(rawLogo).indexOf('juba-transport.com') === -1) ? rawLogo : AcidReportTemplate.DEFAULT_LOGO;
    
    // Robust multi-source signature resolution
    var sigs = data.signatures;
    if (typeof sigs === 'string') {
      try { sigs = JSON.parse(sigs); } catch (e) { sigs = {}; }
    }
    var inspectorSig = (sigs && sigs.inspector) || data.inspectorSignature || data.inspector_signature || '';
    var driverSig = (sigs && sigs.driver) || data.driverSignature || data.driver_signature || '';

    const config = data.templateConfig || {
        title: 'ACID TANKER CHECKLIST',
        docNo: 'MNT-F-013',
        revisionNo: '06',
        revisionDate: '15/03/24',
        initialIssueDate: '03/02/17',
        nextRevisionDate: '15/03/26'
    };

    const items = data.items || [];
    
    const getSectionItems = (catKey) => {
      if (catKey === 'PPE') return items.filter(i => i.category.indexOf('Personal') > -1);
      if (catKey === 'VEHICLE') return items.filter(i => i.category.indexOf('Vehicle') > -1);
      if (catKey === 'SPILL_KIT') return items.filter(i => i.category.indexOf('Spill') > -1);
      if (catKey === 'DOCUMENTATION') return items.filter(i => (i.category.indexOf('Documentation') > -1) || (i.category.indexOf('Compliance') > -1));
      return [];
    };

    const sections = [
      { key: 'PPE', label: 'A. PPE (Acid Specific)' },
      { key: 'VEHICLE', label: 'B. Vehicle (Horse & Trailer)' },
      { key: 'SPILL_KIT', label: 'C. Spill Kit Presence' },
      { key: 'DOCUMENTATION', label: 'D. Compliance Records' }
    ];

    const renderItemRow = (item, idx) => {
      const status = String(item.status || 'NIL').trim().toUpperCase();
      const isGood = status === 'GOOD' || status === 'YES' || status === 'COMPLIANT';
      const isAttn = status === 'ATTENTION' || status === 'NEEDS ATTENTION' || status === 'WARNING';
      const isBad = status === 'BAD' || status === 'NO' || status === 'NON-COMPLIANT' || status === 'CRITICAL';
      
      const splitLabel = (item.label || "").split('. ');
      const number = splitLabel[0] || "";
      const text = splitLabel.slice(1).join('. ') || item.label;

      return \`
        <tr>
          <td style="border: 1px solid #000; text-align: center; font-size: 10px; font-weight: bold; width: 35px; height: 22px;">\${number}</td>
          <td style="border: 1px solid #000; padding: 4px 8px; font-size: 10px; vertical-align: middle;">\${text}</td>
          <td style="border: 1px solid #000; text-align: center; color: #16a34a; font-weight: bold; font-size: 14px; width: 40px;">\${isGood ? '✓' : ''}</td>
          <td style="border: 1px solid #000; text-align: center; color: #d97706; font-weight: bold; font-size: 14px; width: 40px;">\${isAttn ? '!' : ''}</td>
          <td style="border: 1px solid #000; text-align: center; color: #dc2626; font-weight: bold; font-size: 14px; width: 40px;">\${isBad ? 'X' : ''}</td>
          <td style="border: 1px solid #000; padding: 4px 8px; font-size: 8px; font-style: italic; color: #64748b; vertical-align: middle;">\${isBad ? 'CRITICAL FAULT' : (item.comments || '')}</td>
        </tr>\`;
    };

    let tableRows = "";
    sections.forEach(sec => {
        const secItems = getSectionItems(sec.key);
        if (secItems.length > 0) {
          tableRows += \`<tr><td colspan="6" style="background-color: #f1f5f9; border: 1px solid #000; padding: 6px 10px; font-size: 10px; font-weight: 900; text-transform: uppercase;">\${sec.label}</td></tr>\`;
          secItems.forEach((item, idx) => {
              tableRows += renderItemRow(item, idx);
          });
        }
    });

    return \`
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Helvetica, Arial, sans-serif; margin: 0; padding: 20px; color: #000; background-color: #fff; line-height: 1.2; }
          .master-container { width: 100%; max-width: 800px; margin: 0 auto; border: 2px solid #000; padding: 15px; }
          
          .header-main-table { width: 100%; border-collapse: collapse; border: 2px solid #000; margin-bottom: 20px; }
          .header-main-table td { border: 2px solid #000; vertical-align: top; }
          
          .meta-box-cell { width: 180px; padding: 0; }
          .meta-sub-table { width: 100%; border-collapse: collapse; }
          .meta-sub-table td { border: none !important; border-bottom: 1px solid #000 !important; font-size: 9px; padding: 5px 8px; font-weight: bold; }
          .meta-sub-table tr:last-child td { border-bottom: none !important; }
          .meta-label { border-right: 1px solid #000 !important; width: 55%; }
          .meta-val { text-align: center; }
          
          .central-box-cell { padding: 0; }
          .doc-no-sub { border-bottom: 2px solid #000; padding: 5px 10px; font-size: 10px; font-weight: bold; }
          .main-title-row { height: 60px; text-align: center; vertical-align: middle; padding: 5px; font-size: 18px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; }
          
          .logo-cell { width: 120px; text-align: center; vertical-align: middle !important; padding: 8px !important; }

          .asset-info-grid { width: 100%; border-collapse: collapse; border: 2px solid #000; margin-bottom: 20px; }
          .asset-info-grid td { border: 1px solid #000; padding: 8px 12px; font-size: 11px; font-family: monospace; }
          .val-bold { font-weight: bold; font-size: 12px; }

          .checklist-table { width: 100%; border-collapse: collapse; border: 2px solid #000; }
          .checklist-table thead td { background-color: #fff; border: 1px solid #000; padding: 8px; font-size: 10px; font-weight: bold; text-transform: uppercase; text-align: center; }

          .decision-panel { width: 100%; border-collapse: collapse; border: 2px solid #000; margin-top: 20px; }
          .decision-side { width: 25%; background: #f8fafc; padding: 12px; text-align: center; font-weight: bold; font-size: 10px; border-right: 2px solid #000; text-transform: uppercase; }
          .decision-core { text-align: center; font-size: 18px; font-weight: 900; vertical-align: middle; }
          
          .remarks-content { border: 2px solid #000; padding: 12px; margin-top: 15px; min-height: 50px; font-size: 11px; font-style: italic; }
          
          .sig-row-table { width: 100%; margin-top: 25px; border-top: 2px solid #000; padding-top: 15px; border-collapse: collapse; }
          .sig-cell { width: 48%; text-align: center; vertical-align: top; padding: 0 10px; }
          .sig-cap { font-size: 8px; font-weight: bold; color: #64748b; text-transform: uppercase; letter-spacing: 1.5px; }
        </style>
      </head>
      <body>
        <div class="master-container">
          <table class="header-main-table">
            <tr>
              <td class="meta-box-cell">
                <table class="meta-sub-table">
                  <tr><td class="meta-label">Initial Issue Date</td><td class="meta-val">\${config.initialIssueDate}</td></tr>
                  <tr><td class="meta-label">Revision Date:</td><td class="meta-val">\${config.revisionDate}</td></tr>
                  <tr><td class="meta-label">Revision No.</td><td class="meta-val">\${config.revisionNo}</td></tr>
                  <tr><td class="meta-label">Next Revision:</td><td class="meta-val">\${config.nextRevisionDate}</td></tr>
                </table>
              </td>
              <td class="central-box-cell">
                <div class="doc-no-sub">Doc No: \${config.docNo}</div>
                <div class="main-title-row">\${config.title}</div>
              </td>
              <td class="logo-cell">
                <img src="\${logoUrl}" alt="Company Logo" style="max-height: 55px; max-width: 110px; height: auto; width: auto; object-fit: contain; vertical-align: middle; border: 0;" />
              </td>
            </tr>
          </table>

          <table class="asset-info-grid">
            <tr>
              <td width="33%">TRUCK #: <span class="val-bold">\${data.truckNo || 'N/A'}</span></td>
              <td width="33%">TRAILER #: <span class="val-bold">\${data.trailerNo || 'N/A'}</span></td>
              <td width="34%">LOCATION: <span class="val-bold">\${data.location || 'N/A'}</span></td>
            </tr>
            <tr>
              <td>JOB CARD #: <span class="val-bold">\${data.jobCard || data.jobCardNo || 'N/A'}</span></td>
              <td>DATE/TIME: <span class="val-bold">\${dateStr}</span></td>
              <td>ODOMETER: <span class="val-bold">\${data.odometer || '0'} KM</span></td>
            </tr>
          </table>
          
          <table class="checklist-table">
            <thead>
              <tr>
                <td width="35">No.</td>
                <td style="text-align: left; padding-left: 10px;">ITEM DESCRIPTION</td>
                <td width="40">Good</td>
                <td width="40">Attn</td>
                <td width="40">Crit</td>
                <td style="text-align: left; padding-left: 10px;">COMMENTS</td>
              </tr>
            </thead>
            <tbody>
              \${tableRows}
            </tbody>
          </table>

          <table class="decision-panel">
            <tr>
              <td class="decision-side">Safe to Load Status</td>
              <td class="decision-core" style="color: \${data.safeToLoad === 'Yes' ? '#16a34a' : '#dc2626'};">
                \${(data.safeToLoad || 'NOT SPECIFIED').toUpperCase()}
              </td>
            </tr>
          </table>

          <div class="remarks-content">
            <span style="font-weight:bold; font-size:9px; text-decoration:underline;">INSPECTOR REMARKS:</span><br/>
            \${data.remarks || 'No additional remarks.'}
          </div>

          <table class="sig-row-table">
            <tr>
              <td class="sig-cell">
                <table style="width: 100%; border-collapse: collapse; border-bottom: 1.5px solid #000; font-size: 10px; font-weight: bold; margin-bottom: 4px;">
                  <tr>
                    <td style="text-align: left; padding: 0 4px 3px 4px; text-transform: uppercase;">Inspector:</td>
                    <td style="text-align: right; padding: 0 4px 3px 4px; text-transform: uppercase;">\${data.inspectedBy || 'N/A'}</td>
                  </tr>
                </table>
                <table style="width: 100%; border-collapse: collapse; margin: 6px auto;">
                  <tr>
                    <td style="height: 55px; text-align: center; vertical-align: middle; border-bottom: 1.5px solid #000;">
                      \${inspectorSig ? \`<img src="\${inspectorSig}" style="max-height: 50px; max-width: 180px; height: auto; width: auto; object-fit: contain; vertical-align: middle; border: 0;" alt="Inspector Signature" />\` : '<span style="font-size: 9px; color: #94a3b8; font-style: italic;">[Inspector Signature Recorded]</span>'}
                    </td>
                  </tr>
                </table>
                <span class="sig-cap">Official Signature</span>
              </td>
              <td style="width: 4%;"></td>
              <td class="sig-cell">
                <table style="width: 100%; border-collapse: collapse; border-bottom: 1.5px solid #000; font-size: 10px; font-weight: bold; margin-bottom: 4px;">
                  <tr>
                    <td style="text-align: left; padding: 0 4px 3px 4px; text-transform: uppercase;">Driver:</td>
                    <td style="text-align: right; padding: 0 4px 3px 4px; text-transform: uppercase;">\${data.driverName || 'N/A'}</td>
                  </tr>
                </table>
                <table style="width: 100%; border-collapse: collapse; margin: 6px auto;">
                  <tr>
                    <td style="height: 55px; text-align: center; vertical-align: middle; border-bottom: 1.5px solid #000;">
                      \${driverSig ? \`<img src="\${driverSig}" style="max-height: 50px; max-width: 180px; height: auto; width: auto; object-fit: contain; vertical-align: middle; border: 0;" alt="Driver Signature" />\` : '<span style="font-size: 9px; color: #94a3b8; font-style: italic;">[Driver Signature Recorded]</span>'}
                    </td>
                  </tr>
                </table>
                <span class="sig-cap">Driver Acknowledgement</span>
              </td>
            </tr>
          </table>
        </div>
      </body>
      </html>\`;
  }
};
`;
