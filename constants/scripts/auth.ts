export const CODE_2_AUTH_AND_ADMIN = `/**
 * 2_AuthAndAdmin.gs - Authentication & User Management
 */

const AuthHandlers = {
  handleLogin: function(ss, body) {
    let userSheet = ss.getSheetByName('Users');
    if (!userSheet) return ResponseBuilder.error("Database Configuration Error: 'Users' sheet not found.");
    const data = userSheet.getDataRange().getValues();
    const username = body.username.toLowerCase().trim();
    
    // Master Administrator Built-in Credential Support
    if ((username === 'admin' || username === 'admin@safetycheck.pro' || username === 'admin@scbcnet.com') && body.password === 'admin') {
        return ResponseBuilder.success({ 
          user: { 
            id: 'USR-MASTER-ADMIN', 
            username: 'admin', 
            name: 'System Administrator', 
            role: 'SuperAdmin', 
            position: 'Fleet & Safety Operations Director', 
            isActive: true,
            preferences: { emailNotifications: true, notifyGeneral: true, notifyPetroleum: true, notifyAcid: true }
          } 
        });
    }

    for (let i = 1; i < data.length; i++) {
        const storedUser = String(data[i][1]).toLowerCase().trim();
        const storedPass = String(data[i][2]);
        const storedName = String(data[i][3]);
        const userRole = data[i][4];
        const userId = data[i][0];

        if (storedUser === username) {
            const passwordMatch = (storedPass === body.password);
            const isNewUserInvite = (storedName === "" && storedPass === "" && body.password === "");

            if (passwordMatch || isNewUserInvite) {
                const isEnabled = data[i][8] === undefined || data[i][8] === "" || String(data[i][8]).toUpperCase() === "TRUE";
                if (!isEnabled) return ResponseBuilder.error("Account Access Disabled.", "ACCOUNT_DISABLED");

                userSheet.getRange(i + 1, 10).setValue(new Date().toISOString());
                let prefs = {};
                try { if (data[i][7]) prefs = JSON.parse(data[i][7]); } catch(e) {}

                return ResponseBuilder.success({ 
                  user: { id: userId, username: storedUser, name: storedName, role: String(userRole).trim(), position: data[i][5] || '', preferences: prefs, isActive: isEnabled } 
                });
            }
        }
    }
    return ResponseBuilder.error("Invalid credentials.", "INVALID_CREDENTIALS");
  },

  handleRegisterUser: function(ss, body) {
    let userSheet = ss.getSheetByName('Users');
    if (!userSheet) {
        userSheet = ss.insertSheet('Users');
        userSheet.appendRow(["ID", "Username", "Password", "Name", "Role", "Position", "Registered_At", "Preferences", "Enabled", "Last_Seen", "Is_Typing"]);
        userSheet.setFrozenRows(1);
    }
    const newUsername = String(body.username).trim().toLowerCase();
    const id = "USR-" + Date.now();
    const defaultPrefs = JSON.stringify({ emailNotifications: true, notifyGeneral: true, notifyPetroleum: true, notifyAcid: true });
    userSheet.appendRow([id, newUsername, body.password || "", body.name || "", String(body.role).trim(), body.position || "", new Date().toISOString(), defaultPrefs, "TRUE", "", "FALSE"]);
    
    // Sync Google Group membership for newly registered user
    if (typeof EmailHandlers !== 'undefined' && EmailHandlers.syncGroupMembership) {
      try {
        EmailHandlers.syncGroupMembership(ss, newUsername, body.name, body.role, true, body.groupEmail || null, JSON.parse(defaultPrefs));
      } catch(e) {}
    }

    // Only send invitation if requested
    if (body.sendEmail !== false && typeof EmailHandlers !== 'undefined' && EmailHandlers.sendInvitation) {
      let portalUrl = "";
      let companyName = "Fleet Portal";
      try {
        const settingsSheet = ss.getSheetByName('System_Settings');
        if (settingsSheet && settingsSheet.getLastRow() >= 2) {
          const settings = settingsSheet.getRange(2, 1, 1, 8).getValues()[0];
          companyName = settings[0] || companyName;
          portalUrl = settings[7] || "";
        }
      } catch (e) { Logger.log(ss, "INVITE_SETTINGS_ERROR", e.toString()); }

      EmailHandlers.sendInvitation(newUsername, body.role, companyName, body.password || "", portalUrl);
    }
    return ResponseBuilder.success({ message: "User registered." });
  },

  handleUpdateUser: function(ss, body) {
    let sheet = ss.getSheetByName('Users');
    if (!sheet) return ResponseBuilder.error("Users sheet missing");
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][1].toLowerCase() === (body.originalUsername || body.username).toLowerCase()) {
        if (body.username) sheet.getRange(i + 1, 2).setValue(body.username.toLowerCase());
        if (body.password) sheet.getRange(i + 1, 3).setValue(body.password);
        if (body.name) sheet.getRange(i + 1, 4).setValue(body.name);
        if (body.role) sheet.getRange(i + 1, 5).setValue(String(body.role).trim());
        if (body.position !== undefined) sheet.getRange(i + 1, 6).setValue(body.position);
        
        let prefs = {};
        try { if (data[i][7]) prefs = JSON.parse(data[i][7]); } catch(e) {}
        if (body.preferences) prefs = Object.assign({}, prefs, body.preferences);

        let isAct = (data[i][8] === undefined || data[i][8] === "" || String(data[i][8]).toUpperCase() === "TRUE");

        if (body.isActive !== undefined) {
          isAct = (body.isActive === true || body.isActive === "true" || body.isActive === "TRUE");
          sheet.getRange(i + 1, 9).setValue(isAct ? "TRUE" : "FALSE");
          
          if (!isAct) {
            // STRICT SERVICE & NOTIFICATION DISABLMENT:
            // When user State is disabled, all services including receiving emails are revoked
            prefs.emailNotifications = false;
            prefs.notifyGeneral = false;
            prefs.notifyPetroleum = false;
            prefs.notifyPetroleumV2 = false;
            prefs.notifyAcid = false;
            prefs.servicesDisabled = true;
            prefs.disabledAt = new Date().toISOString();
          }
        }
        
        sheet.getRange(i + 1, 8).setValue(JSON.stringify(prefs));

        // Sync Google Group membership automatically based on active state and email preferences
        const isSubscribed = isAct && (prefs.emailNotifications !== false) && (!prefs.servicesDisabled);
        if (typeof EmailHandlers !== 'undefined' && EmailHandlers.syncGroupMembership) {
          try {
            EmailHandlers.syncGroupMembership(ss, data[i][1], data[i][3], data[i][4], isSubscribed, body.groupEmail || null, prefs);
          } catch(e) {}
        }

        return ResponseBuilder.success({ message: "User updated successfully", groupSubscribed: isSubscribed });
      }
    }
    return ResponseBuilder.error("User not found");
  },

  handleSyncGroupSubscribers: function(ss, body) {
    let userSheet = ss.getSheetByName('Users');
    if (!userSheet) return ResponseBuilder.error("Users sheet missing");
    
    var groupEmail = body.groupEmail || "juba_alerts@googlegroups.com";
    var users = userSheet.getDataRange().getValues();
    var count = 0;
    var subscribers = [];
    
    for (var i = 1; i < users.length; i++) {
      var email = String(users[i][1]).trim().toLowerCase();
      var name = users[i][3] || "Staff";
      var role = users[i][4] || "User";
      var rawPrefs = users[i][7];
      var rawEnabled = users[i][8];
      
      var isAct = (rawEnabled === undefined || rawEnabled === "" || String(rawEnabled).toUpperCase() === "TRUE");
      var prefs = {};
      try { if (rawPrefs) prefs = JSON.parse(rawPrefs); } catch(e) {}
      
      var isSubscribed = isAct && (prefs.emailNotifications !== false) && (!prefs.servicesDisabled);
      if (typeof EmailHandlers !== 'undefined' && EmailHandlers.syncGroupMembership) {
        EmailHandlers.syncGroupMembership(ss, email, name, role, isSubscribed, groupEmail, prefs);
        if (isSubscribed) {
          count++;
          subscribers.push({ email: email, name: name, role: role });
        }
      }
    }
    
    var groupSlug = groupEmail.indexOf("@") > -1 ? groupEmail.split("@")[0] : groupEmail;
    return ResponseBuilder.success({ 
      subscribedCount: count, 
      groupEmail: groupEmail,
      subscribers: subscribers,
      groupUrl: "https://groups.google.com/g/" + groupSlug
    });
  },

  handleGetUsers: function(ss) {
    let userSheet = ss.getSheetByName('Users');
    if (!userSheet) return ResponseBuilder.success({ users: [] });
    const userData = userSheet.getDataRange().getValues();
    const users = userData.slice(1).map(r => ({ 
      id: r[0], username: r[1], name: r[3], role: r[4], position: r[5], lastLogin: r[6],
      isActive: r[8] === undefined || r[8] === "" || String(r[8]).toUpperCase() === "TRUE"
    }));
    return ResponseBuilder.success({ users });
  }
};`;