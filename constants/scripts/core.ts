export const CODE_3_CORE_OPERATIONS = `/**
 * 3_CoreOperations.gs - Core Data Flow & Systems
 */

// Use var/global assignment for GAS to ensure cross-file visibility without hoisting issues
var DataHandlers = {
  handleDataSubmission: function(ss, body) {
    var sheetName = body.sheet;
    var rowData = body.row;
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      if (body.headers && Array.isArray(body.headers) && body.headers.length > 0) {
        sheet.appendRow(body.headers);
        sheet.setFrozenRows(1);
      }
    }

    var safeRow = rowData.map(function(r) { 
      if (r === null || r === undefined) return "";
      var str = String(r);
      // Hard guard against Google Sheets document bloat and 50k cell character limits
      if (str.indexOf("data:image/") === 0 || str.length > 250) {
        return "[In Firebase]";
      }
      return str.substring(0, 250); 
    });

    // ID DEDUPLICATION: Check if this inspection ID already exists in the sheet
    var incomingId = String(body.id || safeRow[0] || "").trim();
    var isDuplicateRow = false;
    if (incomingId && incomingId !== "" && incomingId !== "N/A" && incomingId.indexOf("PING") !== 0) {
      var lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        var existingIds = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
        for (var r = 0; r < existingIds.length; r++) {
          if (String(existingIds[r][0]).trim() === incomingId) {
            isDuplicateRow = true;
            // Update the existing row instead of appending a duplicate record
            sheet.getRange(r + 2, 1, 1, safeRow.length).setValues([safeRow]);
            break;
          }
        }
      }
    }

    if (!isDuplicateRow) {
      sheet.appendRow(safeRow);
    }

    // Track original request completion
    if (body.requestId) {
        var reqSheet = ss.getSheetByName('Inspection_Requests');
        if (reqSheet) {
            var reqData = reqSheet.getDataRange().getValues();
            for (var i = 1; i < reqData.length; i++) {
                if (String(reqData[i][0]) === String(body.requestId)) {
                    reqSheet.getRange(i + 1, 10).setValue('Completed');
                    break;
                }
            }
        }
    }

    // DISPATCH EMAIL NOTIFICATIONS
    // STRICT RULE: Inspection emails MUST ONLY be sent ONCE regardless of whatever.
    // Suppress if backup sync, test ping, duplicate row, or explicitly disabled.
    var shouldSendEmail = (
        body.sendNotification !== false &&
        body.isBackup !== true &&
        body.isSync !== true &&
        body.isPing !== true &&
        !isDuplicateRow &&
        incomingId.indexOf("PING") !== 0
    );

    if (shouldSendEmail && typeof EmailHandlers !== 'undefined') {
       EmailHandlers.sendEmailNotifications(ss, body, sheetName);
    } else {
       Logger.log(ss, "EMAIL_SUPPRESSED", "Email dispatch suppressed for " + (isDuplicateRow ? "duplicate record" : "sync/backup operation") + " [" + incomingId + "]");
    }
    
    // UPDATE AUTO-SUGGESTION REGISTRY
    if (typeof Validation !== 'undefined') {
       Validation.updateFromRow(ss, body);
    }

    return ResponseBuilder.success({ sheet: sheetName });
  },

  handleDeleteInspection: function(ss, body) {
    var inspectionId = String(body.id || "").trim();
    if (!inspectionId) return ResponseBuilder.error("Missing inspection ID to delete");

    var sheetNames = body.sheet ? [body.sheet] : ["General", "Petroleum_V2", "Acid"];
    var deleted = false;

    for (var s = 0; s < sheetNames.length; s++) {
      var sheet = ss.getSheetByName(sheetNames[s]);
      if (!sheet) continue;
      var lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        var idValues = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
        for (var r = 0; r < idValues.length; r++) {
          if (String(idValues[r][0]).trim() === inspectionId) {
            sheet.deleteRow(r + 2);
            deleted = true;
            break;
          }
        }
      }
      if (deleted) break;
    }

    // Also remove from System_Email_Log if present
    var emailLogSheet = ss.getSheetByName("System_Email_Log");
    if (emailLogSheet && emailLogSheet.getLastRow() > 1) {
      try {
        var logData = emailLogSheet.getRange(2, 2, emailLogSheet.getLastRow() - 1, 1).getValues();
        for (var l = 0; l < logData.length; l++) {
          if (String(logData[l][0]).trim() === inspectionId) {
            emailLogSheet.deleteRow(l + 2);
            break;
          }
        }
      } catch (e) {}
    }

    return ResponseBuilder.success({ deletedId: inspectionId, deleted: deleted });
  },

  handleGetRequest: function(ss, e) {
    var querySheet = e && e.parameter ? e.parameter.sheet : null;
    var includeValidation = e && e.parameter ? e.parameter.validation === 'true' : false;
    var data = {};
    
    // Helper to process a single sheet efficiently
    var processSheet = function(name, limit) {
      var sheet = ss.getSheetByName(name);
      if (!sheet) return null;
      
      var lastRow = sheet.getLastRow();
      if (lastRow === 0) return [];
      
      var startRow = Math.max(1, lastRow - limit);
      var values = sheet.getRange(startRow, 1, lastRow - startRow + 1, sheet.getLastColumn()).getValues();
      if (startRow > 1) values.unshift(sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]);
      return values;
    };

    // Metadata & Config (Always include as they are tiny)
    try {
      data['System_Settings'] = processSheet('System_Settings', 1) || [];
    } catch(e) { data['System_Settings'] = []; }
    
    // Validation Data (Lazy Load - Expensive)
    if (includeValidation) {
      var vSheet = ss.getSheetByName('Validation_Data');
      if (vSheet) {
        var lastRow = vSheet.getLastRow();
        if (lastRow > 1) {
          var vStart = Math.max(2, lastRow - 1000); 
          var vCols = vSheet.getLastColumn();
          if (vCols > 0) {
            var headers = vSheet.getRange(1, 1, 1, vCols).getValues()[0];
            var values = vSheet.getRange(vStart, 1, lastRow - vStart + 1, vCols).getValues();
            
            var columns = {};
            var uniqueSets = headers.map(function() { return {}; });
            
            // SINGLE PASS OPTIMIZATION
            for (var r = 0; r < values.length; r++) {
              var row = values[r];
              for (var c = 0; c < row.length; c++) {
                var val = row[c];
                if (val && val !== "") uniqueSets[c][val] = true;
              }
            }
            
            headers.forEach(function(h, colIndex) {
              columns[h] = Object.keys(uniqueSets[colIndex]);
            });
            
            data['Validation_Data'] = columns;
          }
        }
      }
    }

    // Inspection Data
    if (querySheet === 'overview') {
       // Deeply optimized overview - very small chunks
       ['General', 'Petroleum_V2', 'Acid'].forEach(function(s) {
         data[s] = processSheet(s, 40); // 40 rows per sheet for fast overview
       });
    } else if (querySheet) {
       // Focused view - larger chunk for the active module
       data[querySheet] = processSheet(querySheet, 400); 
    }

    return ResponseBuilder.build(data);
  },

  handleSearchHistory: function(ss, body) {
    var sheetName = body.sheet;
    var searchTerm = String(body.searchTerm || "").toLowerCase();
    var sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) return ResponseBuilder.error("Target sheet not found.");
    
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return ResponseBuilder.success([]);
    
    var lastCol = sheet.getLastColumn();
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    var results = [];
    
    // Efficiently search starting from most recent rows (bounded to prevent timeout on 10k+ rows)
    var searchLimit = Math.min(1000, lastRow - 1);
    var startRow = Math.max(2, lastRow - searchLimit + 1);
    var rowsToFetch = lastRow - startRow + 1;
    var data = sheet.getRange(startRow, 1, rowsToFetch, lastCol).getValues();

    for (var i = data.length - 1; i >= 0; i--) {
        var row = data[i];
        var match = false;
        for (var j = 0; j < row.length; j++) {
            if (String(row[j]).toLowerCase().indexOf(searchTerm) > -1) {
                match = true;
                break;
            }
        }
        
        if (match) {
            var itemSize = {};
            headers.forEach(function(h, idx) {
                itemSize[h] = row[idx];
            });
            results.push(itemSize);
            if (results.length >= 50) break;
        }
    }
    
    return ResponseBuilder.success(results);
  }
};

var SystemHandlers = {
  handleRequestInspection: function(ss, body) {
    var sheet = ss.getSheetByName('Inspection_Requests');
    if (!sheet) {
        sheet = ss.insertSheet('Inspection_Requests');
        sheet.appendRow(['ID', 'Requester', 'Role', 'Truck', 'Trailer', 'Type', 'Reason', 'Priority', 'AssignedTo', 'Status', 'Timestamp']);
    }
    var requestId = "REQ-" + Date.now();
    sheet.appendRow([requestId, body.requester, body.role, body.truckNo, body.trailerNo || "", body.type, body.reason, body.priority, body.assignedInspector || "Unassigned", "Pending", new Date().toISOString()]);
    return ResponseBuilder.success({ requestId: requestId });
  },

  handleUpdateSettings: function(ss, body) {
    var sheet = ss.getSheetByName('System_Settings');
    if (!sheet) {
        sheet = ss.insertSheet('System_Settings');
        sheet.appendRow(['Company_Name', 'Manager_Email', 'Last_Updated', 'Updated_By', 'Logo_Data', 'Mobile_Link', 'Web_Link', 'Templates', 'Enabled_Modules', 'Group_Email']);
    }

    var logoVal = body.companyLogo || "";
    if (String(logoVal).indexOf("data:image/") === 0 || String(logoVal).length > 500) {
        logoVal = "[Company Logo Stored in Firebase]";
    }

    var row = [
        body.companyName || "SafetyCheck Pro", 
        body.managerEmail || "", 
        new Date(), 
        "Admin", 
        logoVal, 
        body.mobileApkLink || "", 
        body.webAppUrl || "", 
        body.templates ? JSON.stringify(body.templates) : "{}",
        body.enabledModules ? JSON.stringify(body.enabledModules) : "{}",
        body.groupEmail || ""
    ];
    
    if (sheet.getLastRow() < 2) sheet.appendRow(row);
    else sheet.getRange(2, 1, 1, row.length).setValues([row]);
    return ResponseBuilder.success();
  },

  /**
   * Professional Server-Side PDF Generator
   * Eliminates blank pages by rendering HTML in the cloud
   */
  handleGenerateReportPDF: function(ss, body) {
    try {
      if (!body.reportData) return ResponseBuilder.error("Missing report data payload.");
      
      if (typeof PDFGenerator === 'undefined') {
        return ResponseBuilder.error("PDF Engine component missing. Please update your backend script.");
      }
      
      var reportHtml = PDFGenerator.create(body.reportData);
      var blob = Utilities.newBlob(reportHtml, 'text/html').getAs('application/pdf');
      var base64Pdf = Utilities.base64Encode(blob.getBytes());
      
      return ResponseBuilder.success({ 
        base64: base64Pdf,
        filename: (body.reportData.truckNo || "Report") + "_Inspection.pdf"
      });
    } catch (err) {
      return ResponseBuilder.error("PDF Engine Error: " + err.toString());
    }
  }
};`;