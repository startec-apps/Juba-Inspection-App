export const CODE_10_EMERGENCY_REPAIR = `/**
 * EmergencyRepair.gs - Automated Database Health & Anti-Bloat Cleaner
 * 
 * WHY SPREADSHEETS ENTER "PERMANENT READ-ONLY MODE":
 * 1. Even with few rows, if past inspections wrote raw phone photos (3MB-8MB base64 each) into cells,
 *    those single cells contain 4,000,000+ characters, exceeding Google's 50k cell limit.
 * 2. 10 rows x 5 photos = 250 Megabytes of invisible text inside table cells.
 * 3. Google Drive flags the file as corrupt/oversized and locks the entire file ID in Permanent Read-Only Mode.
 * 
 * HOW TO USE THIS UTILITY:
 * 1. In Google Sheets script editor, select function 'repairAndCleanSpreadsheet' and click 'Run'.
 * 2. It will neutralize oversized cells, replace them with '[Photo in Firebase]',
 *    and delete thousands of unused blank grid rows.
 * 3. If Google has already placed your existing file in Permanent Read-Only Mode, create a fresh
 *    Google Sheet, deploy the script, and paste the new URL into Settings > Cloud Backup Script URL.
 */

function repairAndCleanSpreadsheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();
  var totalCleaned = 0;
  var totalRowsTrimmed = 0;

  for (var s = 0; s < sheets.length; s++) {
    var sheet = sheets[s];
    var sheetName = sheet.getName();
    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    var maxRows = sheet.getMaxRows();

    // 1. Trim excess empty grid rows (reduces spreadsheet memory footprint drastically)
    if (maxRows > lastRow + 25 && lastRow > 0) {
      var rowsToDelete = maxRows - (lastRow + 25);
      try {
        sheet.deleteRows(lastRow + 26, rowsToDelete);
        totalRowsTrimmed += rowsToDelete;
      } catch(e) {}
    }

    // 2. Scan and neutralize any oversized cells (old Base64 images from past versions)
    if (lastRow > 0 && lastCol > 0) {
      var range = sheet.getRange(1, 1, lastRow, lastCol);
      var values = range.getValues();
      var modified = false;

      for (var r = 0; r < values.length; r++) {
        for (var c = 0; c < values[r].length; c++) {
          var val = values[r][c];
          if (typeof val === 'string') {
            // Check for raw Base64 data or strings exceeding cell limits
            if (val.indexOf('data:image/') === 0 || val.length > 1000) {
              values[r][c] = '[Photo in Firebase]';
              modified = true;
              totalCleaned++;
            }
          }
        }
      }

      if (modified) {
        try {
          range.setValues(values);
        } catch(err) {
          Logger.log("Failed to write sanitized values to " + sheetName + ": " + err.toString());
        }
      }
    }

    // 3. Purge old log bloat
    if (sheetName === 'System_Logs' || sheetName === 'SystemNotification') {
      if (lastRow > 50) {
        try { sheet.deleteRows(2, lastRow - 50); } catch(e) {}
      }
    }
  }

  var summary = "Database Optimized: " + totalCleaned + " oversized cells neutralized, " + totalRowsTrimmed + " excess empty rows trimmed.";
  Logger.log(summary);
  return summary;
}
`;
