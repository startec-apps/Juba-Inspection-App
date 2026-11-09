export const CODE_4_SUPPORT_MODULE = `/**
 * 4_SupportModule.gs - Support Ticketing System
 */

const SupportHandlers = {
  handleSubmitSupport: function(ss, body) {
    let sheet = ss.getSheetByName('Support_Tickets');
    if (!sheet) {
        sheet = ss.insertSheet('Support_Tickets');
        sheet.appendRow(["ID", "Type", "Subject", "Description", "Priority", "User", "Email", "Role", "Timestamp", "Status", "Comments", "AssignedTo", "Attachment"]);
    }
    const id = "TKT-" + Math.floor(Math.random()*90000 + 10000);
    const safeDesc = String(body.description || "").substring(0, 1500);
    sheet.appendRow([id, body.type, body.subject, safeDesc, body.priority, body.user, body.email, body.role, new Date().toISOString(), "Open", "[]", "", ""]);
    
    // Dispatch system alert
    let notifSheet = ss.getSheetByName('SystemNotification');
    if (notifSheet) {
        notifSheet.appendRow(["NOTIF-" + Date.now(), "Admin", "info", "New Support Ticket: " + id, new Date().toISOString(), "FALSE", "support"]);
        if (notifSheet.getLastRow() > 60) {
            try { notifSheet.deleteRows(2, notifSheet.getLastRow() - 50); } catch(e) {}
        }
    }

    return ResponseBuilder.success({ ticketId: id });
  },

  handleGetTickets: function(ss, body) {
    const sheet = ss.getSheetByName('Support_Tickets');
    if (!sheet) return ResponseBuilder.success({ tickets: [] });
    const data = sheet.getDataRange().getValues();
    const userRole = (body.role || "").toLowerCase();
    const userEmail = (body.email || "").toLowerCase();
    const isAdmin = userRole === 'admin' || userRole === 'superadmin';
    
    const tickets = data.slice(1).filter(r => {
        if (isAdmin) return true;
        return String(r[6]).toLowerCase() === userEmail;
    }).map(r => ({
        ticketId: r[0], type: r[1], subject: r[2], description: r[3],
        priority: r[4], user: r[5], email: r[6], role: r[7],
        timestamp: r[8], status: r[9], comments: JSON.parse(r[10] || "[]"),
        assignedTo: r[11], attachment: r[12]
    })).reverse();

    return ResponseBuilder.success({ tickets });
  },

  handleUpdateTicket: function(ss, body) {
    const sheet = ss.getSheetByName('Support_Tickets');
    if (!sheet) return ResponseBuilder.error("Sheet missing.");
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(body.ticketId)) {
            const rowIndex = i + 1;
            if (body.status) sheet.getRange(rowIndex, 10).setValue(body.status);
            if (body.comment) {
                const current = JSON.parse(sheet.getRange(rowIndex, 11).getValue() || "[]");
                current.push(body.comment);
                sheet.getRange(rowIndex, 11).setValue(JSON.stringify(current));
            }
            return ResponseBuilder.success();
        }
    }
    return ResponseBuilder.error("Ticket not found.");
  }
};`;