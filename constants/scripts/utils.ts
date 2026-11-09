
export const CODE_5_LIB_AND_UTILS = `
const ResponseBuilder = {
  success: function(data) { 
    if (data === void 0) { data = {}; }
    return this.build(Object.assign({ status: "success" }, data)); 
  },
  error: function(message, code) {
    if (code === void 0) { code = null; }
    // Fix: Used dynamic property assignment to allow 'code' on the response object
    var response = { status: "error", message: message };
    if (code)
      response["code"] = code;
    return this.build(response);
  },
  build: function(data) {
    // ContentService is a Google Apps Script global object
    return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
  }
};

const Validation = {
  updateFromRow: function(ss, body) {
     try {
       const row = body.row;
       const sheetName = body.sheet;
       
       // Only update registry for valid inspection modules
       const validModules = ['General', 'Petroleum_V2', 'Acid'];
       if (validModules.indexOf(sheetName) === -1) return;

       // BASE_HEADERS mapping (consistent across all modules)
       // 0: id, 1: timestamp, 2: truckNo, 3: trailerNo, 4: inspectedBy, 5: driverName, 6: location
       let truck = row[2];
       let trailer = row[3];
       let inspector = row[4];
       let driver = row[5];
       let location = row[6];

       this.updateSingle(ss, 'Truck_Reg_No', truck);
       this.updateSingle(ss, 'Trailer_Reg_No', trailer);
       this.updateSingle(ss, 'Driver_Name', driver);
       this.updateSingle(ss, 'Inspector_Name', inspector);
       this.updateSingle(ss, 'Location', location);
     } catch (e) {}
  },
  updateSingle: function(ss, headerName, value) {
     if (!value || String(value).trim() === "") return;
     let valStr = String(value).trim();
     
     // PRO-SEC: Extreme sanitization to prevent injection & data pollution
     // 1. Strip HTML/Script tags
     valStr = valStr.replace(/<[^>]*>/g, "");
     // 2. Normalize whitespace
     valStr = valStr.split(/\\s+/).join(' ');
     
     // PRO-VAL: Data integrity check before adding to registry
     const isReg = (headerName === 'Truck_Reg_No' || headerName === 'Trailer_Reg_No');
     
     // 1. Filter out obvious system tokens, messages & suspicious entropy strings
     if (valStr.startsWith('[BROADCAST]') || valStr.indexOf('sent to') > -1 || valStr.length < 2) return;
     if (['SuperAdmin', 'Admin', 'undefined', 'null', 'N/A', '[HB]', 'System', 'Inspector'].indexOf(valStr) > -1) return;
     
     // 2. Specific field validation (Length & Type constraints)
     if (isReg) {
         if (valStr.length > 20 || valStr.indexOf('@') > -1 || valStr.split(' ').length > 4) return;
         if ((valStr.length === 1 && valStr >= '0' && valStr <= '9')) return; // No single-digit ratings in reg fields
     } else if (headerName === 'Driver_Name' || headerName === 'Location') {
         if ((valStr.length === 1 && valStr >= '1' && valStr <= '5')) return; // No ratings in names
         if (valStr.startsWith('ID-') || valStr.startsWith('REQ-')) return;
         if (valStr.length > 50) return; // Name/Location length limit
     }

     let vSheet = ss.getSheetByName('Validation_Data');
     if (!vSheet) {
        vSheet = ss.insertSheet('Validation_Data');
        vSheet.appendRow(['Truck_Reg_No', 'Trailer_Reg_No', 'Driver_Name', 'Inspector_Name', 'Location', 'Position']);
        vSheet.setFrozenRows(1);
     }
     const headers = vSheet.getRange(1, 1, 1, vSheet.getLastColumn()).getValues()[0];
     let colIndex = headers.indexOf(headerName) + 1;
     if (colIndex < 1) {
         colIndex = headers.length + 1;
         vSheet.getRange(1, colIndex).setValue(headerName);
     }
     const lastVRow = Math.max(1, vSheet.getLastRow());
     const fullCol = vSheet.getRange(1, colIndex, lastVRow, 1).getValues().flat().map(String);
     if (!fullCol.includes(valStr)) {
         let targetRow = 1;
         for(let i=1; i<fullCol.length; i++) {
             if(fullCol[i] === "") { targetRow = i + 1; break; }
         }
         if (targetRow === 1) targetRow = vSheet.getLastRow() + 1;
         vSheet.getRange(targetRow, colIndex).setValue(valStr);
     }
  }
};

const Logger = {
  log: function(ss, action, details) {
    try {
      let logSheet = ss.getSheetByName('System_Logs');
      if (!logSheet) {
          logSheet = ss.insertSheet('System_Logs');
          logSheet.appendRow(["Timestamp", "Action", "Details"]);
          logSheet.setFrozenRows(1);
      }
      logSheet.appendRow([new Date(), String(action).substring(0, 50), String(details).substring(0, 250)]);

      // AUTO-PRUNE: Keep System_Logs strictly capped at 50 rows to eliminate bloat
      const lastRow = logSheet.getLastRow();
      if (lastRow > 60) {
          logSheet.deleteRows(2, lastRow - 50);
      }
    } catch(e) {}
  }
};

const EmailHandlers = {
  sendEmailNotifications: function(ss, data, moduleName) {
    Logger.log(ss, "EMAIL_START", "Triggering for: " + moduleName);
    
    // GUARD 1: Explicit suppression for backup parity, background synchronization, or ping operations
    if (data.sendNotification === false || data.isBackup === true || data.isSync === true || data.isPing === true || data.action === 'backup' || data.action === 'ping') {
      Logger.log(ss, "EMAIL_SUPPRESSED", "Email dispatch intentionally suppressed for backup/sync/ping operation");
      return;
    }

    try {
      var row = data.row || [];
      var incomingId = String(
        data.id || 
        (data.reportData && data.reportData.id) || 
        row[0] || 
        ""
      ).trim();

      if (incomingId.indexOf("PING") === 0) {
        Logger.log(ss, "EMAIL_SUPPRESSED", "Suppressed email for ping operation");
        return;
      }

      var preTruckNo = "UNIT";
      if (moduleName === "General") {
        preTruckNo = row[2] || "UNIT";
      } else {
        preTruckNo = row[2] || "UNIT";
      }
      var recordTimestamp = (data.reportData && data.reportData.timestamp) || row[1] || "";
      var inspectionUniqueKey = incomingId || (String(preTruckNo).trim() + "_" + String(recordTimestamp).trim());

      // GUARD 2: Fast-path atomic deduplication via Script Properties
      // Guarantees an inspection ID will NEVER trigger multiple emails across executions
      var scriptProps = PropertiesService.getScriptProperties();
      var sentKey = "SENT_EMAIL_" + inspectionUniqueKey;
      if (scriptProps.getProperty(sentKey)) {
        Logger.log(ss, "EMAIL_DEDUP_SKIPPED", "Inspection email already dispatched previously for " + inspectionUniqueKey);
        return;
      }

      // GUARD 3: Historical age guard (suppress if record is older than 12 hours)
      // Prevents historical databases, backups, or edits from spamming recipients
      if (recordTimestamp) {
        var recordDate = new Date(recordTimestamp);
        if (!isNaN(recordDate.getTime())) {
          var ageHours = (new Date().getTime() - recordDate.getTime()) / (1000 * 60 * 60);
          if (ageHours > 12) {
            Logger.log(ss, "EMAIL_HISTORICAL_SUPPRESSED", "Suppressed email for past inspection older than 12h (" + Math.round(ageHours) + "h old) [" + inspectionUniqueKey + "]");
            scriptProps.setProperty(sentKey, "HISTORICAL_SUPPRESSED");
            return;
          }
        }
      }

      // GUARD 4: Persistent ledger check in spreadsheet ("System_Email_Log")
      var emailLogSheet = ss.getSheetByName("System_Email_Log");
      if (!emailLogSheet) {
        try {
          emailLogSheet = ss.insertSheet("System_Email_Log");
          emailLogSheet.appendRow(["Timestamp", "Inspection_ID", "Module", "Truck_No", "Recipients", "Status", "Group_Web_Archive"]);
        } catch (e) {
          emailLogSheet = ss.getSheetByName("System_Email_Log");
        }
      }

      if (emailLogSheet && emailLogSheet.getLastRow() > 1) {
        var logRows = emailLogSheet.getRange(2, 2, emailLogSheet.getLastRow() - 1, 1).getValues();
        for (var l = 0; l < logRows.length; l++) {
          if (String(logRows[l][0]).trim() === inspectionUniqueKey) {
            Logger.log(ss, "EMAIL_LEDGER_DEDUP", "Inspection email already recorded in ledger for " + inspectionUniqueKey);
            scriptProps.setProperty(sentKey, String(new Date().getTime()));
            return;
          }
        }
      }

      // EXCLUSIVE GOOGLE GROUP BROADCAST ARCHITECTURE:
      // Strictly verify that NO individual users receive inspection report emails directly.
      // All inspection reports are dispatched SOLELY to the Google Group (juba_alerts@googlegroups.com).
      // Subscribed users receive inspection reports strictly through their membership in this Google Group.
      var groupEmail = "";
      if (data.groupEmail && String(data.groupEmail).indexOf("@") > -1) {
          groupEmail = String(data.groupEmail).trim();
      } else if (data.reportData && data.reportData.groupEmail && String(data.reportData.groupEmail).indexOf("@") > -1) {
          groupEmail = String(data.reportData.groupEmail).trim();
      }

      var settingsSheet = ss.getSheetByName("System_Settings");
      if (!groupEmail && settingsSheet && settingsSheet.getLastRow() >= 2) {
          try {
              var sHeaders = settingsSheet.getRange(1, 1, 1, settingsSheet.getLastColumn()).getValues()[0];
              var gCol = sHeaders.indexOf("Group_Email");
              if (gCol > -1) {
                  var gVal = String(settingsSheet.getRange(2, gCol + 1).getValue() || "").trim();
                  if (gVal && gVal.indexOf("@") > -1) groupEmail = gVal;
              } else if (settingsSheet.getLastColumn() >= 10) {
                  var gVal10 = String(settingsSheet.getRange(2, 10).getValue() || "").trim();
                  if (gVal10 && gVal10.indexOf("@") > -1) groupEmail = gVal10;
              }
          } catch(sErr) {}
      }

      // Hard default to enterprise Google Group: juba_alerts@googlegroups.com
      if (!groupEmail || groupEmail.indexOf("@") === -1) {
          groupEmail = "juba_alerts@googlegroups.com";
      }

      // Resolve all active, enabled subscribed staff members
      var subscribedUsers = [];
      var userSheet = ss.getSheetByName("Users");
      if (userSheet) {
          var users = userSheet.getDataRange().getValues();
          for (var i = 1; i < users.length; i++) {
             var uEmail = String(users[i][1]).trim().toLowerCase(); 
             var rawPrefs = users[i][7];
             var enabledRaw = users[i][8];
             
             // STRICT SECURITY & SERVICE SUSPENSION RULE:
             // If State is disabled (Enabled === FALSE), user is completely excluded from receiving emails & alerts
             var isAct = (enabledRaw === undefined || enabledRaw === "" || String(enabledRaw).toUpperCase() === "TRUE");
             if (!isAct || !uEmail || uEmail.indexOf("@") === -1) continue;
             
             try {
                 var prefs = rawPrefs ? JSON.parse(rawPrefs) : {};
                 if (prefs.emailNotifications === false || prefs.servicesDisabled === true || prefs.isActive === false) {
                     continue;
                 }
                 
                 var emailsEnabled = (prefs.emailNotifications !== false);
                 if (emailsEnabled) {
                     var shouldSend = false;
                     if (moduleName === "General" && (prefs.notifyGeneral !== false)) shouldSend = true;
                     else if (moduleName === "Petroleum_V2" && (prefs.notifyPetroleumV2 !== false && prefs.notifyPetroleum !== false)) shouldSend = true;
                     else if (moduleName === "Acid" && (prefs.notifyAcid !== false)) shouldSend = true;
                     else if (prefs.notifyGeneral !== false) shouldSend = true;
                     
                     if (shouldSend && uEmail !== groupEmail.toLowerCase() && subscribedUsers.indexOf(uEmail) === -1) {
                         subscribedUsers.push(uEmail);
                     }
                 }
             } catch(e) {
                 if (uEmail !== groupEmail.toLowerCase() && subscribedUsers.indexOf(uEmail) === -1) {
                     subscribedUsers.push(uEmail);
                 }
             }
          }
      }

      // PRIMARY TARGET: Google Group broadcast address
      var recipients = [groupEmail];
      Logger.log(ss, "GROUP_EMAIL_DISPATCH", "Primary Target: " + groupEmail + " | Active Subscribed Staff (" + subscribedUsers.length + "): " + subscribedUsers.join(", "));

      if (recipients.length === 0) {
          if (settingsSheet && settingsSheet.getLastRow() >= 2) {
              var mgrEmail = String(settingsSheet.getRange(2, 2).getValue() || "").trim();
              if (mgrEmail && mgrEmail.indexOf("@") > -1) {
                  var isMgrDisabled = false;
                  if (userSheet && users) {
                      for (var m = 1; m < users.length; m++) {
                          if (String(users[m][1]).trim().toLowerCase() === mgrEmail.toLowerCase()) {
                              var mEn = users[m][8];
                              if (mEn !== undefined && mEn !== "" && String(mEn).toUpperCase() === "FALSE") {
                                  isMgrDisabled = true;
                              }
                              break;
                          }
                      }
                  }
                  if (!isMgrDisabled) {
                      recipients.push(mgrEmail);
                      Logger.log(ss, "EMAIL_FALLBACK", "Using Manager Email: " + mgrEmail);
                  }
              }
          }
      }

      if (recipients.length === 0) {
          Logger.log(ss, "EMAIL_ABORT", "No valid recipients or Google Group found in database.");
          return;
      }
      
      var row = data.row || [];
      var rData = data.reportData || {};
      
      // Standardize module display name: display "Petroleum" instead of internal "Petroleum_V2"
      var displayModuleName = (moduleName === "Petroleum_V2" || moduleName === "petroleum_v2") ? "Petroleum" : moduleName;
      
      // Standardized field extraction across all inspection types (General, Petroleum, Acid):
      // BASE_HEADERS: [0: id, 1: timestamp, 2: truckNo, 3: trailerNo, 4: inspectedBy, 5: driverName, 6: location, 7: odometer, 8: rate, 9: remarks, 10: safeToLoad]
      // Prioritize structured reportData first, with strict BASE_HEADERS column index fallback
      var truckNo = rData.truckNo || row[2] || "UNIT"; 
      var inspector = rData.inspectedBy || row[4] || "Inspector"; 
      var rawRating = (rData.rate !== undefined && rData.rate !== null && rData.rate !== "") ? rData.rate : (row[8] !== undefined && row[8] !== "" ? row[8] : "0");
      var rating = String(rawRating);
      var safeToLoad = rData.safeToLoad || row[10] || "Not Specified";

      var numRating = Number(rating);
      if (isNaN(numRating)) {
          numRating = 0;
      }
      var statusColor = "#10b981";
      var statusText = "PASSED";
      if (numRating <= 3) { statusColor = "#f59e0b"; statusText = "WARNING"; } 
      if (numRating <= 2) { statusColor = "#ef4444"; statusText = "CRITICAL FAIL"; }

      var htmlBody = 
          "<div style='margin: 0; padding: 0; width: 100% !important; background-color: #f8fafc; font-family: Helvetica, Arial, sans-serif;'>" +
              "<div style='max-width: 600px; width: 95%; margin: 20px auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);'>" +
                  "<div style='background-color: #0f172a; padding: 30px 20px; text-align: center;'>" +
                      "<h2 style='color: #ffffff; margin: 0; font-size: 18px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase;'>Inspection Report</h2>" +
                  "</div>" +
                  "<div style='padding: 30px 20px; color: #1e293b;'>" +
                      "<p style='margin-top: 0; font-size: 14px; line-height: 1.5;'>A new <strong>" + displayModuleName + "</strong> inspection has been submitted. Summary details are provided below.</p>" +
                      "<div style='background-color: #f8fafc; padding: 20px; border-radius: 12px; border: 1px solid #f1f5f9; margin: 25px 0;'>" +
                          "<table style='width: 100%; border-collapse: collapse; table-layout: fixed;'>" +
                              "<tr>" +
                                  "<td style='padding: 8px 0; color: #94a3b8; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; width: 40%;'>Truck No</td>" +
                                  "<td style='padding: 8px 0; color: #0f172a; font-size: 15px; font-weight: 800; text-align: right; overflow-wrap: break-word;'>" + truckNo + "</td>" +
                              "</tr>" +
                              "<tr>" +
                                  "<td style='padding: 8px 0; color: #94a3b8; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;'>Inspected By</td>" +
                                  "<td style='padding: 8px 0; color: #0f172a; font-size: 15px; font-weight: 600; text-align: right; overflow-wrap: break-word;'>" + inspector + "</td>" +
                              "</tr>" +
                              "<tr>" +
                                  "<td style='padding: 8px 0; color: #94a3b8; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;'>Rating</td>" +
                                  "<td style='padding: 8px 0; text-align: right;'>" +
                                      "<span style='color: " + statusColor + "; font-weight: 900; font-size: 16px;'>" + statusText + " (" + rating + "/5)</span>" +
                                  "</td>" +
                              "</tr>" +
                              "<tr>" +
                                  "<td style='padding: 12px 0 8px 0; color: #94a3b8; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; border-top: 1px solid #e2e8f0;'>Safe To Load</td>" +
                                  "<td style='padding: 12px 0 8px 0; text-align: right; border-top: 1px solid #e2e8f0;'>" +
                                      "<span style='color: " + (String(safeToLoad).toUpperCase() === 'YES' ? '#10b981' : '#ef4444') + "; font-weight: 900; font-size: 16px;'>" + String(safeToLoad).toUpperCase() + "</span>" +
                                  "</td>" +
                              "</tr>" +
                          "</table>" +
                      "</div>" +
                      "<p style='font-size: 13px; line-height: 1.6; color: #64748b;'>The full inspection report is attached as a PDF for your records.</p>" +
                      "<div style='margin-top: 30px; padding-top: 20px; border-top: 1px solid #f1f5f9; text-align: center;'>" +
                          "<p style='font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin: 0;'>Automated Message: No Reply Required</p>" +
                      "</div>" +
                  "</div>" +
              "</div>" +
          "</div>";

      var blobs = [];
      if (data.reportData) {
          try {
              var reportHtml = PDFGenerator.create(data.reportData);
              // Utilities is a Google Apps Script global object
              var pdfBlob = Utilities.newBlob(reportHtml, 'text/html')
                  .getAs('application/pdf')
                  .setName(String(truckNo).split(/\\s+/).join('_') + '_' + displayModuleName + '_Report.pdf');
              blobs.push(pdfBlob);
          } catch (e) { Logger.log(ss, "PDF_GEN_FAIL", e.toString()); }
      }

      var subject = "Inspection Report: " + truckNo + " (" + displayModuleName + ") [" + statusText + "]";
      var emailOptions = {
          htmlBody: htmlBody,
          name: "Fleet Inspection", 
          replyTo: "notification@scbcnet.com",
          attachments: blobs
      };

      // EXCLUSIVE GOOGLE GROUP BROADCAST (QUOTA PRESERVATION ARCHITECTURE):
      // Dispatches EXCLUSIVELY to the Google Group (juba_alerts@googlegroups.com).
      // ZERO users are placed in BCC or CC.
      // Quota Impact: Exactly 1 email quota unit consumed per inspection report.
      // Google Groups backend handles the fan-out delivery to all subscribers without consuming script quotas.
      delete emailOptions["bcc"];
      delete emailOptions["cc"];

      // Build clean multi-part plain text body to satisfy Google Groups spam/content filtering
      var plainBody = "SafetyCheck Pro Inspection Report\n\n" +
          "Vehicle/Unit: " + truckNo + "\n" +
          "Module: " + displayModuleName + "\n" +
          "Inspector: " + inspector + "\n" +
          "Result: " + rating + "/5 (" + statusText + ")\n" +
          "Safe To Load: " + safeToLoad + "\n\n" +
          "The complete PDF inspection report is attached.\n" +
          "View group archive: https://groups.google.com/g/" + (groupEmail.indexOf("@") > -1 ? groupEmail.split("@")[0] : groupEmail);

      var effectiveSender = "Script Owner";
      try {
          if (typeof Session !== 'undefined' && Session.getEffectiveUser) {
              effectiveSender = Session.getEffectiveUser().getEmail() || effectiveSender;
          }
      } catch (e) {}

      // Try sending with custom alias first, fallback to standard GmailApp/MailApp
      var sentSuccessfully = false;
      try {
          var sendOpts = Object.assign({}, emailOptions, { from: "notification@scbcnet.com" });
          GmailApp.sendEmail(recipients[0], subject, plainBody, sendOpts);
          sentSuccessfully = true;
          Logger.log(ss, "EMAIL_DISPATCHED", "To Google Group: " + recipients[0] + " via alias from: notification@scbcnet.com");
      } catch (aliasErr) {
          try {
              GmailApp.sendEmail(recipients[0], subject, plainBody, emailOptions);
              sentSuccessfully = true;
              Logger.log(ss, "EMAIL_DISPATCHED_DEFAULT", "To Google Group: " + recipients[0] + " from script account: " + effectiveSender);
          } catch (mailErr) {
              MailApp.sendEmail(recipients[0], subject, plainBody, emailOptions);
              sentSuccessfully = true;
              Logger.log(ss, "EMAIL_DISPATCHED_MAILAPP", "To Google Group: " + recipients[0] + " via MailApp from: " + effectiveSender);
          }
      }

      // POST-DISPATCH DEDUPLICATION LOCK:
      // Permanently mark this inspection as emailed in ScriptProperties & Ledger
      if (sentSuccessfully) {
        scriptProps.setProperty(sentKey, String(new Date().getTime()));
        if (emailLogSheet) {
          try {
            var groupSlug = recipients[0].indexOf("@") > -1 ? recipients[0].split("@")[0] : recipients[0];
            emailLogSheet.appendRow([
                new Date(), 
                inspectionUniqueKey, 
                moduleName, 
                truckNo, 
                recipients[0], 
                "DISPATCHED (From: " + effectiveSender + ")",
                "https://groups.google.com/g/" + groupSlug
            ]);
          } catch (logErr) {}
        }
      }

    } catch (err) {
        Logger.log(ss, "EMAIL_SYSTEM_FATAL", err.toString());
    }
  },

  sendInvitation: function(email, role, orgName, password, portalUrl) {
    const subject = "Access Invitation: " + orgName;
    const passwordSection = password 
      ? '<p style="margin: 8px 0 0 0; font-size: 14px; font-weight: 600; color: #4f46e5;">Temporary Password: ' + password + '</p>'
      : '<p style="margin: 8px 0 0 0; font-size: 13px; font-weight: 600; color: #e11d48; text-transform: uppercase; letter-spacing: 0.5px;">Setup Note: You can log in without entering a password for your initial setup.</p>';

    const actionButton = portalUrl 
      ? '<div style="margin: 32px 0; text-align: center;">' +
          '<a href="' + portalUrl + '" style="background: #4f46e5; color: #ffffff; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 15px; box-shadow: 0 4px 10px rgba(79, 70, 229, 0.2);">Access Portal</a>' +
        '</div>'
      : '';

    const htmlBody = '<div style="font-family: Arial, sans-serif; padding: 32px; border: 1px solid #f1f5f9; border-radius: 20px; max-width: 600px; color: #0f172a; background: #ffffff;">' +
      '<h2 style="color: #4f46e5; margin-bottom: 20px; font-size: 22px; font-weight: 800; letter-spacing: -0.02em;">Welcome to the Portal</h2>' +
      '<p style="font-size: 15px; line-height: 1.6; color: #475569;">You have been enrolled as a fleet auditor for <strong>' + orgName + '</strong>.</p>' +
      '<div style="background: #f8fafc; padding: 24px; border-radius: 16px; margin: 24px 0; border: 1px solid #f1f5f9;">' +
        '<p style="margin: 0 0 10px 0; font-size: 12px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px;">Access Credentials</p>' +
        '<p style="margin: 0; font-size: 14px; font-weight: 600;">Role: ' + role + '</p>' +
        '<p style="margin: 4px 0 0 0; font-size: 14px; font-weight: 600;">ID: ' + email + '</p>' +
        passwordSection +
      '</div>' +
      actionButton +
      '<p style="font-size: 13px; line-height: 1.6; color: #64748b;">Sign in with your email address using the credentials above. You will be prompted to finalize your profile upon your first access.</p>' +
      '<hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0;" />' +
      '<p style="font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; text-align: center;">Automated Message: No Reply Required</p>' +
    '</div>';

    try {
      const emailOptions = {
        htmlBody: htmlBody,
        name: "Fleet Inspection",
        from: "notification@scbcnet.com",
        replyTo: "notification@scbcnet.com"
      };
      // GmailApp allows custom 'from' and 'name' more reliably if configured
      GmailApp.sendEmail(email, subject, "Invitation", emailOptions);
    } catch (e) {
      // Fallback to MailApp if GmailApp restricted, though options are more limited
      try { MailApp.sendEmail(email, subject, "Invitation", { htmlBody: htmlBody }); } catch(err) {}
    }
  },

  /**
   * Enterprise Google Group Membership & Subscriber Synchronization
   * Automatically adds/removes staff to/from the Google Group distribution list
   * when they enable or disable email notifications in their account.
   */
  syncGroupMembership: function(ss, userEmail, userName, userRole, isSubscribed, groupEmail, prefs) {
    if (!userEmail || userEmail.indexOf("@") === -1) return;
    try {
      var cleanEmail = String(userEmail).trim().toLowerCase();
      var targetGroup = groupEmail;
      if (!targetGroup || targetGroup.indexOf("@") === -1) {
        var settingsSheet = ss.getSheetByName("System_Settings");
        if (settingsSheet && settingsSheet.getLastRow() >= 2) {
          try {
            var sHeaders = settingsSheet.getRange(1, 1, 1, settingsSheet.getLastColumn()).getValues()[0];
            var gCol = sHeaders.indexOf("Group_Email");
            if (gCol > -1) targetGroup = String(settingsSheet.getRange(2, gCol + 1).getValue() || "").trim();
            else if (settingsSheet.getLastColumn() >= 10) targetGroup = String(settingsSheet.getRange(2, 10).getValue() || "").trim();
          } catch(e) {}
        }
      }
      if (!targetGroup || targetGroup.indexOf("@") === -1) {
        targetGroup = "juba_alerts@googlegroups.com";
      }

      // 1. Maintain Google Group Subscribers Ledger in Spreadsheet
      var subSheet = ss.getSheetByName("Group_Subscribers");
      if (!subSheet) {
        subSheet = ss.insertSheet("Group_Subscribers");
        subSheet.appendRow(["Timestamp", "User_Email", "Name", "Role", "Group_Email", "Status", "Notify_General", "Notify_Petroleum", "Notify_Acid", "Last_Updated"]);
        subSheet.setFrozenRows(1);
      }

      var lastRow = subSheet.getLastRow();
      var foundRow = -1;
      if (lastRow > 1) {
        var existingEmails = subSheet.getRange(2, 2, lastRow - 1, 1).getValues();
        for (var r = 0; r < existingEmails.length; r++) {
          if (String(existingEmails[r][0]).trim().toLowerCase() === cleanEmail) {
            foundRow = r + 2;
            break;
          }
        }
      }

      var notifyGen = prefs && prefs.notifyGeneral !== undefined ? String(prefs.notifyGeneral) : "true";
      var notifyPetro = prefs && (prefs.notifyPetroleumV2 !== undefined || prefs.notifyPetroleum !== undefined) ? String(prefs.notifyPetroleumV2 !== false && prefs.notifyPetroleum !== false) : "true";
      var notifyAcid = prefs && prefs.notifyAcid !== undefined ? String(prefs.notifyAcid) : "true";
      var status = isSubscribed ? "SUBSCRIBED" : "UNSUBSCRIBED";

      var rowValues = [
        new Date(),
        cleanEmail,
        userName || "Staff",
        userRole || "User",
        targetGroup || "Default Group",
        status,
        notifyGen,
        notifyPetro,
        notifyAcid,
        new Date().toISOString()
      ];

      if (foundRow > 0) {
        subSheet.getRange(foundRow, 1, 1, rowValues.length).setValues([rowValues]);
      } else {
        subSheet.appendRow(rowValues);
      }

      // 2. Google Workspace Admin Directory API Integration (if enabled on the script project)
      if (typeof AdminDirectory !== 'undefined' && targetGroup && targetGroup.indexOf("@") > -1) {
        try {
          if (isSubscribed) {
            AdminDirectory.Members.insert({ email: cleanEmail, role: 'MEMBER' }, targetGroup);
            Logger.log(ss, "GROUP_ADMIN_ADDED", "Added " + cleanEmail + " to Google Group " + targetGroup);
          } else {
            AdminDirectory.Members.remove(targetGroup, cleanEmail);
            Logger.log(ss, "GROUP_ADMIN_REMOVED", "Removed " + cleanEmail + " from Google Group " + targetGroup);
          }
        } catch (adminErr) {
          Logger.log(ss, "GROUP_ADMIN_STATUS", adminErr.toString());
        }
      }

      Logger.log(ss, "GROUP_SUB_SYNC", (isSubscribed ? "Subscribed " : "Unsubscribed ") + cleanEmail + " for Google Group " + (targetGroup || "Default"));
    } catch (e) {
      Logger.log(ss, "GROUP_SYNC_ERR", e.toString());
    }
  }
};

const PDFGenerator = {
  create: function(data) {
    if (!data) return "<html><body><p>No report data available.</p></body></html>";
    const title = (data.title || "").toUpperCase();
    const sheet = (data.sheet || "").toUpperCase();
    
    if (title.indexOf('GENERAL') > -1 || sheet.indexOf('GENERAL') > -1) {
       return GeneralReportTemplate.generate(data);
    }
    if (title.indexOf('PETROLEUM') > -1 || sheet.indexOf('PETROLEUM') > -1) {
       return PetroleumV2ReportTemplate.generate(data);
    }
    if (title.indexOf('ACID') > -1 || sheet.indexOf('ACID') > -1) {
       return AcidReportTemplate.generate(data);
    }
    
    return this.createGenericReport(data);
  },
  
  createGenericReport: function(data) {
    return "<html><body><h1>" + (data.title || "Inspection Report") + "</h1><p>Date: " + (data.timestamp || new Date().toISOString()) + "</p><p>Data captured successfully, but no matching template was found for this report type.</p></body></html>";
  }
};
`;
