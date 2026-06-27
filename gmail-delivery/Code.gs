const CONFIG = {
  appName: "Mehfil-e-Shairee",
  tagline: "One poem, every morning.",
  contactEmail: "zaheer.aziz@gmail.com",
  senderName: "Mehfil-e-Shairee",
  deliveryHour: 7,
  timezone: "America/Chicago",
  sourceUrl: "https://www.allamaiqbal.com/works/poetry/urdu/bal/text/part02/40.htm",
  ownerReceivesDailyEmail: true,
  statusReportRecipient: "",
  observabilitySpreadsheetId: "",
  readingQueueSheetName: "Reading Queue",
  recipientStatusSheetName: "Recipient Status",
  lowQueueThreshold: 7,
  weeklyDigestDay: ScriptApp.WeekDay.SUNDAY,
  weeklyDigestHour: 8,
  unsubscribeFormUrl: "https://docs.google.com/forms/d/1CKKZAGFtEFbVL2ig5tMKqC95nIah71UIntJnx8LTrtA/viewform",
  unsubscribeInstructions: "To unsubscribe, use the unsubscribe form and enter the email you signed up with.",
  formResponsesSpreadsheetId: "1bNDtUDSPCUqvJRsBfkTE2SzS2tYpzCmjIJYTTu6wT4g",
  formResponsesSheetGid: 1851218699,
  formResponsesSheetName: "",
  formEmailHeader: "",
  formOptInHeader: "",
  formOptInAcceptedValues: ["yes", "y", "true", "1", "subscribe", "subscribed"],
  unsubscribeResponsesSpreadsheetId: "1_t-Jo75QiKVaUsQdCdNSgD0JDT0Me953qEHkx8EftCo",
  unsubscribeResponsesSheetGid: 1104712912,
  unsubscribeResponsesSheetName: "",
  unsubscribeEmailHeader: "",
  extraRecipients: [
    // Add recipient emails here, for example:
    // "friend@example.com"
  ]
};

/** Sends the first reading to you without changing delivery progress. */
function sendPreviewEmail() {
  sendReading_(getApprovedReadings_()[0], true, [getOwnerEmail_()]);
}

/** Sends the first reading to everyone on the active recipient list. */
function sendPreviewEmailToRecipients() {
  sendReading_(getApprovedReadings_()[0], true, getRecipientEmails_());
}

/** Sends the first reading to the first two form recipients only. Use this for a controlled test. */
function sendPreviewEmailToFirstTwoFormRecipients() {
  sendReading_(getApprovedReadings_()[0], true, getFormRecipientEmails_().slice(0, 2));
}

/** Logs recipient counts without sending email. */
function logRecipientSummary() {
  const formRecipients = getFormRecipientEmails_();
  const allRecipients = getRecipientEmails_();
  const unsubscribed = getUnsubscribedEmails_();
  refreshRecipientStatusSheet_();
  console.log(`Form recipients: ${formRecipients.length}`);
  console.log(`Unsubscribe records: ${unsubscribed.length}`);
  console.log(`Total active recipients, including owner/static list: ${allRecipients.length}`);
}

/** Creates/refreshes the unsubscribe sheet in the observability workbook. */
function setupUnsubscribeSheet() {
  getUnsubscribeSheet_();
}

/** Creates/refreshes the derived active/inactive recipient status sheet. */
function refreshRecipientStatus() {
  refreshRecipientStatusSheet_();
}

/** Seeds the Drive-backed reading queue from the generated fallback library. */
function setupReadingQueueSheet() {
  refreshReadingQueueSheetFromGenerated_();
}

/** Logs the Drive-backed reading queue without sending email. */
function logReadingQueueSummary() {
  const readings = getApprovedReadings_();
  console.log(`Approved queue readings: ${readings.length}`);
  console.log(readings.map((reading, index) => `${index + 1}. ${reading.id} · ${reading.title}`).join("\n"));
}

/** Records the signed-in owner as unsubscribed. Useful for testing the trial unsubscribe flow. */
function recordOwnerUnsubscribeTest() {
  addUnsubscribedEmail_(getOwnerEmail_(), "Owner reply test");
}

/** Logs the first two form recipients without sending email. */
function logFirstTwoFormRecipients() {
  console.log(getFormRecipientEmails_().slice(0, 2).join("\n"));
}

/** Sends the next unread poem exactly once. Intended for the daily trigger. */
function sendDailyReading() {
  try {
    refreshRecipientStatusSheet_();
  } catch (error) {
    console.error(`Recipient status refresh failed: ${error.message}`);
  }
  const sentIds = getSentReadingIds_();
  const readings = getApprovedReadings_();
  const reading = readings.find(item => !sentIds.includes(item.id));

  if (!reading) {
    console.log("No unread poems remain. Add another reading before the next delivery.");
    try {
      sendStatusReport_({ event: "queue-empty" });
    } catch (error) {
      console.error(`Status report failed: ${error.message}`);
    }
    return;
  }

  let recipients = [];
  try {
    recipients = getRecipientEmails_();
    const sendResult = sendReading_(reading, false, recipients);
    const deliveryEntry = recordDelivery_(reading, sendResult.sentCount);
    sendStatusReport_({ event: "delivered", deliveryEntry });
  } catch (error) {
    const failureEntry = recordDeliveryFailure_(reading, recipients.length, error);
    try {
      sendStatusReport_({ event: "delivery-failed", deliveryEntry: failureEntry, failureError: error });
    } catch (statusError) {
      console.error(`Failure alert failed: ${statusError.message}`);
    }
    throw error;
  }
}

/** Sends the owner an observability report without sending a poem. */
function sendDailyStatusReport() {
  sendStatusReport_({ event: "manual-status" });
}

/** Sends the owner a weekly operating digest without sending a poem. */
function sendWeeklyDigest() {
  sendWeeklyDigest_();
}

/** Logs the full delivery queue and current status without sending email. */
function logDeliveryPlan() {
  const plan = getDeliveryPlan_();
  console.log(plan.map(item => `${item.sequence}. ${item.status} · ${item.title} · ${item.deliveredDate || "not delivered"}`).join("\n"));
}

/** Installs one daily trigger. Run only after the preview looks right. */
function setupDailyDelivery() {
  removeDailyDelivery();
  ScriptApp.newTrigger("sendDailyReading")
    .timeBased()
    .atHour(CONFIG.deliveryHour)
    .everyDays(1)
    .inTimezone(CONFIG.timezone)
    .create();
}

/** Installs one weekly owner digest trigger. */
function setupWeeklyDigest() {
  removeWeeklyDigest();
  ScriptApp.newTrigger("sendWeeklyDigest")
    .timeBased()
    .onWeekDay(CONFIG.weeklyDigestDay)
    .atHour(CONFIG.weeklyDigestHour)
    .inTimezone(CONFIG.timezone)
    .create();
}

/** Removes the schedule without deleting delivery progress. */
function removeDailyDelivery() {
  ScriptApp.getProjectTriggers()
    .filter(trigger => trigger.getHandlerFunction() === "sendDailyReading")
    .forEach(trigger => ScriptApp.deleteTrigger(trigger));
}

/** Removes the weekly digest schedule. */
function removeWeeklyDigest() {
  ScriptApp.getProjectTriggers()
    .filter(trigger => trigger.getHandlerFunction() === "sendWeeklyDigest")
    .forEach(trigger => ScriptApp.deleteTrigger(trigger));
}

/** Clears sent history so the library can be tested again. */
function resetDeliveryProgress() {
  PropertiesService.getUserProperties().deleteProperty("SENT_READING_IDS");
  clearDeliveryLog_();
}

function sendReading_(reading, isPreview, recipients) {
  if (!recipients.length) {
    throw new Error("No recipient email addresses are configured.");
  }

  const subjectPrefix = isPreview ? "Preview · " : "";
  const subject = `${subjectPrefix}${CONFIG.appName} · ${reading.transliteration}`;
  const plainText = buildPlainText_(reading);
  const htmlBody = buildHtml_(reading, isPreview);
  const failures = [];
  let sentCount = 0;

  recipients.forEach(recipient => {
    try {
      GmailApp.sendEmail(recipient, subject, plainText, {
        htmlBody,
        name: CONFIG.senderName
      });
      sentCount += 1;
    } catch (error) {
      failures.push({ recipient, message: error.message });
    }
  });

  if (failures.length) {
    const error = new Error(`Failed to send to ${failures.length} of ${recipients.length} recipients.`);
    error.failures = failures;
    error.sentCount = sentCount;
    throw error;
  }

  return { sentCount };
}

function getOwnerEmail_() {
  return Session.getEffectiveUser().getEmail();
}

function getRecipientEmails_() {
  return getRecipientStatusRows_()
    .filter(row => row.status === "Active")
    .map(row => row.email);
}

function getFormRecipientEmails_() {
  return uniqueValidEmails_(getFormRecipientActions_().map(action => action.email));
}

function getActiveFormRecipientEmails_() {
  const latestUnsubscribedAt = getLatestUnsubscribeTimes_();
  const latestSubscribeAt = {};
  getFormRecipientActions_().forEach(action => {
    if (!latestSubscribeAt[action.email] || action.timestamp >= latestSubscribeAt[action.email]) {
      latestSubscribeAt[action.email] = action.timestamp;
    }
  });

  return Object.keys(latestSubscribeAt)
    .filter(email => !latestUnsubscribedAt[email] || latestSubscribeAt[email] > latestUnsubscribedAt[email]);
}

function getFormRecipientActions_() {
  const settings = getFormRecipientSettings_();
  if (!settings.spreadsheetId) return [];

  const spreadsheet = SpreadsheetApp.openById(settings.spreadsheetId);
  const sheet = settings.sheetGid
    ? getSheetByGid_(spreadsheet, settings.sheetGid)
    : settings.sheetName
    ? spreadsheet.getSheetByName(settings.sheetName)
    : spreadsheet.getSheets()[0];
  if (!sheet) throw new Error(`Form response sheet not found: ${settings.sheetName || settings.sheetGid || "(first sheet)"}`);

  const values = sheet.getDataRange().getDisplayValues();
  if (values.length < 2) return [];

  const headers = values[0].map(value => String(value || "").trim());
  const emailColumn = findColumnIndex_(headers, settings.emailHeader, [
    /^email address$/i,
    /^email$/i,
    /e-?mail/i
  ]);
  if (emailColumn < 0) {
    throw new Error("Could not find an email column in the form response sheet. Set FORM_EMAIL_HEADER or CONFIG.formEmailHeader.");
  }

  const timestampColumn = findColumnIndex_(headers, "", [
    /^timestamp$/i,
    /^time stamp$/i,
    /^submitted at$/i,
    /^date$/i
  ]);
  const optInColumn = settings.optInHeader
    ? findColumnIndex_(headers, settings.optInHeader, [])
    : -1;
  const accepted = settings.optInAcceptedValues;

  return values.slice(1)
    .filter(row => {
      if (optInColumn < 0) return true;
      return accepted.includes(String(row[optInColumn] || "").trim().toLowerCase());
    })
    .map((row, index) => ({
      email: uniqueValidEmails_([row[emailColumn]])[0],
      timestamp: parseActionTimestamp_(timestampColumn >= 0 ? row[timestampColumn] : "", index),
      source: "Signup Form"
    }))
    .filter(action => action.email);
}

function getFormRecipientSettings_() {
  const properties = PropertiesService.getScriptProperties();
  return {
    spreadsheetId: properties.getProperty("FORM_RESPONSES_SPREADSHEET_ID") || CONFIG.formResponsesSpreadsheetId,
    sheetGid: Number(properties.getProperty("FORM_RESPONSES_SHEET_GID") || CONFIG.formResponsesSheetGid || 0),
    sheetName: properties.getProperty("FORM_RESPONSES_SHEET_NAME") || CONFIG.formResponsesSheetName,
    emailHeader: properties.getProperty("FORM_EMAIL_HEADER") || CONFIG.formEmailHeader,
    optInHeader: properties.getProperty("FORM_OPT_IN_HEADER") || CONFIG.formOptInHeader,
    optInAcceptedValues: parseRecipientList_(properties.getProperty("FORM_OPT_IN_ACCEPTED_VALUES"))
      .map(value => value.toLowerCase())
      .concat(CONFIG.formOptInAcceptedValues)
  };
}

function getSheetByGid_(spreadsheet, gid) {
  return spreadsheet.getSheets().find(sheet => sheet.getSheetId() === Number(gid));
}

function findColumnIndex_(headers, configuredHeader, fallbackPatterns) {
  if (configuredHeader) {
    const exact = headers.findIndex(header => header.toLowerCase() === configuredHeader.toLowerCase());
    if (exact >= 0) return exact;
  }

  return headers.findIndex(header => fallbackPatterns.some(pattern => pattern.test(header)));
}

function parseRecipientList_(value) {
  return String(value || "")
    .split(/[\n,;]+/)
    .map(email => email.trim())
    .filter(Boolean);
}

function uniqueValidEmails_(emails) {
  const seen = {};
  return emails
    .map(email => String(email || "").trim().toLowerCase())
    .filter(email => {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || seen[email]) return false;
      seen[email] = true;
      return true;
    });
}

function getUnsubscribedEmails_() {
  return uniqueValidEmails_(getUnsubscribeActions_().map(action => action.email));
}

function getLatestUnsubscribeTimes_() {
  const latest = {};
  getUnsubscribeActions_().forEach(action => {
    if (!latest[action.email] || action.timestamp >= latest[action.email]) {
      latest[action.email] = action.timestamp;
    }
  });
  return latest;
}

function addUnsubscribedEmail_(email, source) {
  const normalized = uniqueValidEmails_([email])[0];
  if (!normalized) throw new Error(`Invalid unsubscribe email: ${email}`);

  const sheet = getUnsubscribeSheet_();
  sheet.appendRow([
    normalized,
    Utilities.formatDate(new Date(), CONFIG.timezone, "yyyy-MM-dd HH:mm:ss z"),
    source || "Manual",
    "Added by Apps Script helper"
  ]);
  return normalized;
}

function getUnsubscribeActions_() {
  const propertyActions = parseRecipientList_(PropertiesService.getScriptProperties().getProperty("UNSUBSCRIBED_EMAILS"))
    .map((email, index) => ({
      email: uniqueValidEmails_([email])[0],
      timestamp: new Date(8640000000000000 - index),
      source: "Emergency Script Property"
    }))
    .filter(action => action.email);
  return propertyActions
    .concat(readUnsubscribeSheetActions_())
    .concat(readUnsubscribeFormActions_());
}

function readUnsubscribeSheetActions_() {
  const spreadsheetId = getObservabilitySpreadsheetId_();
  if (!spreadsheetId) return [];

  try {
    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    const sheet = spreadsheet.getSheetByName("Unsubscribed");
    if (!sheet || sheet.getLastRow() < 2) return [];
    const headers = sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn())).getDisplayValues()[0]
      .map(value => String(value || "").trim());
    const emailColumn = findColumnIndex_(headers, "", [/^email$/i, /^email address$/i, /e-?mail/i]);
    const timestampColumn = findColumnIndex_(headers, "", [/^unsubscribed date$/i, /^timestamp$/i, /^date$/i]);
    if (emailColumn < 0) return [];
    return sheet.getRange(2, 1, sheet.getLastRow() - 1, Math.max(sheet.getLastColumn(), timestampColumn + 1)).getDisplayValues()
      .map((row, index) => ({
        email: uniqueValidEmails_([row[emailColumn]])[0],
        timestamp: parseActionTimestamp_(timestampColumn >= 0 ? row[timestampColumn] : "", index),
        source: "Manual Unsubscribed Sheet"
      }))
      .filter(action => action.email);
  } catch (error) {
    console.error(`Could not read unsubscribe sheet: ${error.message}`);
    return [];
  }
}

function readUnsubscribeFormActions_() {
  const settings = getUnsubscribeFormSettings_();
  if (!settings.spreadsheetId) return [];

  try {
    const spreadsheet = SpreadsheetApp.openById(settings.spreadsheetId);
    const sheet = settings.sheetGid
      ? getSheetByGid_(spreadsheet, settings.sheetGid)
      : settings.sheetName
      ? spreadsheet.getSheetByName(settings.sheetName)
      : spreadsheet.getSheets()[0];
    if (!sheet || sheet.getLastRow() < 2) return [];

    const values = sheet.getDataRange().getDisplayValues();
    const headers = values[0].map(value => String(value || "").trim());
    const emailColumn = findColumnIndex_(headers, settings.emailHeader, [
      /^email address$/i,
      /^email$/i,
      /e-?mail/i
    ]);
    const timestampColumn = findColumnIndex_(headers, "", [
      /^timestamp$/i,
      /^time stamp$/i,
      /^submitted at$/i,
      /^date$/i
    ]);
    if (emailColumn < 0) {
      throw new Error("Could not find an email column in the unsubscribe response sheet. Set UNSUBSCRIBE_EMAIL_HEADER or CONFIG.unsubscribeEmailHeader.");
    }

    return values.slice(1)
      .map((row, index) => ({
        email: uniqueValidEmails_([row[emailColumn]])[0],
        timestamp: parseActionTimestamp_(timestampColumn >= 0 ? row[timestampColumn] : "", index),
        source: "Unsubscribe Form"
      }))
      .filter(action => action.email);
  } catch (error) {
    console.error(`Could not read unsubscribe form responses: ${error.message}`);
    return [];
  }
}

function getUnsubscribeFormSettings_() {
  const properties = PropertiesService.getScriptProperties();
  return {
    spreadsheetId: properties.getProperty("UNSUBSCRIBE_RESPONSES_SPREADSHEET_ID") || CONFIG.unsubscribeResponsesSpreadsheetId,
    sheetGid: Number(properties.getProperty("UNSUBSCRIBE_RESPONSES_SHEET_GID") || CONFIG.unsubscribeResponsesSheetGid || 0),
    sheetName: properties.getProperty("UNSUBSCRIBE_RESPONSES_SHEET_NAME") || CONFIG.unsubscribeResponsesSheetName,
    emailHeader: properties.getProperty("UNSUBSCRIBE_EMAIL_HEADER") || CONFIG.unsubscribeEmailHeader
  };
}

function getStaticRecipientEmails_() {
  const recipients = [];
  if (CONFIG.ownerReceivesDailyEmail) recipients.push(getOwnerEmail_());
  recipients.push(...parseRecipientList_(PropertiesService.getScriptProperties().getProperty("RECIPIENT_EMAILS")));
  recipients.push(...CONFIG.extraRecipients);
  return uniqueValidEmails_(recipients);
}

function getRecipientStatusRows_() {
  const subscribeActions = getFormRecipientActions_();
  const unsubscribeActions = getUnsubscribeActions_();
  const latestSubscribe = latestActionByEmail_(subscribeActions);
  const latestUnsubscribe = latestActionByEmail_(unsubscribeActions);
  const staticEmails = getStaticRecipientEmails_();
  const emailMap = {};

  subscribeActions.forEach(action => {
    emailMap[action.email] = true;
  });
  unsubscribeActions.forEach(action => {
    emailMap[action.email] = true;
  });
  staticEmails.forEach(email => {
    emailMap[email] = true;
  });

  return Object.keys(emailMap).sort().map(email => {
    const subscribe = latestSubscribe[email];
    const unsubscribe = latestUnsubscribe[email];
    const isStatic = staticEmails.includes(email);
    const hasActiveSignup = subscribe && (!unsubscribe || subscribe.timestamp > unsubscribe.timestamp);
    const hasActiveStaticEntry = isStatic && !unsubscribe;
    const status = hasActiveSignup || hasActiveStaticEntry ? "Active" : "Inactive";
    const source = [
      isStatic ? "Static/Admin" : "",
      subscribe ? subscribe.source : "",
      unsubscribe ? unsubscribe.source : ""
    ].filter(Boolean).join(" + ");
    const notes = status === "Active"
      ? hasActiveSignup
        ? "Latest signup is newer than latest unsubscribe."
        : "Static/admin recipient with no unsubscribe."
      : unsubscribe
      ? "Latest unsubscribe is newer, or no newer signup exists."
      : "No active subscribe source found.";

    return {
      email,
      status,
      latestSubscribeAt: subscribe?.timestamp || null,
      latestUnsubscribeAt: unsubscribe?.timestamp || null,
      source,
      notes
    };
  });
}

function latestActionByEmail_(actions) {
  const latest = {};
  actions.forEach(action => {
    if (!latest[action.email] || action.timestamp >= latest[action.email].timestamp) {
      latest[action.email] = action;
    }
  });
  return latest;
}

function refreshRecipientStatusSheet_() {
  const sheet = getObservabilitySheet_(CONFIG.recipientStatusSheetName, [
    "Email",
    "Status",
    "Latest Subscribe",
    "Latest Unsubscribe",
    "Source",
    "Notes",
    "Refreshed At"
  ]);
  const rows = getRecipientStatusRows_();
  if (sheet.getLastRow() > 1) sheet.getRange(2, 1, sheet.getLastRow() - 1, 7).clearContent();
  if (!rows.length) return;
  const refreshedAt = Utilities.formatDate(new Date(), CONFIG.timezone, "yyyy-MM-dd HH:mm:ss z");
  sheet.getRange(2, 1, rows.length, 7).setValues(rows.map(row => [
    row.email,
    row.status,
    formatActionTimestamp_(row.latestSubscribeAt),
    formatActionTimestamp_(row.latestUnsubscribeAt),
    row.source,
    row.notes,
    refreshedAt
  ]));
  sheet.autoResizeColumns(1, 7);
}

function formatActionTimestamp_(date) {
  return date ? Utilities.formatDate(date, CONFIG.timezone, "yyyy-MM-dd HH:mm:ss z") : "";
}

function parseActionTimestamp_(value, fallbackIndex) {
  const parsed = new Date(value);
  if (!isNaN(parsed.getTime())) return parsed;
  return new Date(0 + Number(fallbackIndex || 0));
}

function getUnsubscribeSheet_() {
  return getObservabilitySheet_("Unsubscribed", [
    "Email",
    "Unsubscribed Date",
    "Source",
    "Notes"
  ]);
}

function getStatusReportRecipient_() {
  return CONFIG.statusReportRecipient || getOwnerEmail_();
}

function getSentReadingIds_() {
  const sheetIds = readDeliveryLog_()
    .filter(entry => entry.status === "sent")
    .map(entry => entry.id);
  const legacyIds = parseJsonArray_(PropertiesService.getUserProperties().getProperty("SENT_READING_IDS"));
  return uniqueStrings_(sheetIds.concat(legacyIds));
}

function recordDelivery_(reading, recipientCount) {
  const now = new Date();
  const entry = {
    date: Utilities.formatDate(now, CONFIG.timezone, "yyyy-MM-dd"),
    sentAt: Utilities.formatDate(now, CONFIG.timezone, "yyyy-MM-dd HH:mm:ss z"),
    id: reading.id,
    sequence: getReadingSequence_(reading.id),
    title: reading.title,
    transliteration: reading.transliteration,
    recipientCount,
    status: "sent"
  };

  const sentIds = uniqueStrings_(getSentReadingIds_().concat([reading.id]));
  setLegacySentIds_(sentIds);

  try {
    appendDeliveryLog_(entry);
    refreshDeliveryPlanSheet_();
  } catch (error) {
    entry.sheetError = error.message;
    console.error(`Delivery log sheet update failed: ${error.message}`);
  }

  return entry;
}

function recordDeliveryFailure_(reading, recipientCount, error) {
  const now = new Date();
  const entry = {
    date: Utilities.formatDate(now, CONFIG.timezone, "yyyy-MM-dd"),
    sentAt: Utilities.formatDate(now, CONFIG.timezone, "yyyy-MM-dd HH:mm:ss z"),
    id: reading?.id || "",
    sequence: reading ? getReadingSequence_(reading.id) : "",
    title: reading?.title || "Unknown reading",
    transliteration: reading?.transliteration || "",
    recipientCount,
    status: "failed",
    errorMessage: error?.message || String(error || "Unknown error"),
    sentCount: Number(error?.sentCount || 0),
    failureCount: Array.isArray(error?.failures) ? error.failures.length : ""
  };

  try {
    appendDeliveryLog_(entry);
    refreshDeliveryPlanSheet_();
  } catch (sheetError) {
    entry.sheetError = sheetError.message;
    console.error(`Delivery failure log sheet update failed: ${sheetError.message}`);
  }

  return entry;
}

function sendStatusReport_(options) {
  const event = options?.event || "manual-status";
  const deliveryEntry = options?.deliveryEntry;
  const failureError = options?.failureError;
  const recipientCount = getRecipientEmails_().length;
  const plan = getDeliveryPlan_();
  const deliveredCount = plan.filter(item => item.status === "Delivered").length;
  const remainingCount = plan.length - deliveredCount;
  const nextReading = plan.find(item => item.status !== "Delivered");
  const spreadsheetUrl = getObservabilitySpreadsheet_().getUrl();
  const pipeline = getContentPipelineStatus_(plan);
  const alerts = getObservabilityAlerts_({ event, remainingCount, failureError });
  getReadingQueueSheet_();
  refreshDeliveryPlanSheet_();
  refreshContentPipelineSheet_(pipeline);
  getUnsubscribeSheet_();
  refreshRecipientStatusSheet_();

  const subject = `${CONFIG.appName} Status · ${Utilities.formatDate(new Date(), CONFIG.timezone, "MMM d")}`;
  GmailApp.sendEmail(getStatusReportRecipient_(), subject, buildStatusPlainText_({
    event,
    deliveryEntry,
    failureError,
    deliveredCount,
    remainingCount,
    recipientCount,
    nextReading,
    spreadsheetUrl,
    plan,
    pipeline,
    alerts
  }), {
    htmlBody: buildStatusHtml_({
      event,
      deliveryEntry,
      failureError,
      deliveredCount,
      remainingCount,
      recipientCount,
      nextReading,
      spreadsheetUrl,
      plan,
      pipeline,
      alerts
    }),
    name: CONFIG.senderName
  });
}

function sendWeeklyDigest_() {
  const plan = getDeliveryPlan_();
  const log = readDeliveryLog_();
  const now = new Date();
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const recent = log.filter(entry => {
    if (!entry.date) return false;
    const entryDate = new Date(`${entry.date}T00:00:00`);
    return entryDate >= weekStart;
  });
  const sentThisWeek = recent.filter(entry => entry.status === "sent");
  const failedThisWeek = recent.filter(entry => entry.status === "failed");
  const pipeline = getContentPipelineStatus_(plan);
  const spreadsheetUrl = getObservabilitySpreadsheet_().getUrl();
  getReadingQueueSheet_();
  refreshDeliveryPlanSheet_();
  refreshContentPipelineSheet_(pipeline);
  getUnsubscribeSheet_();
  refreshRecipientStatusSheet_();

  const payload = {
    plan,
    log,
    recent,
    sentThisWeek,
    failedThisWeek,
    pipeline,
    spreadsheetUrl,
    recipientCount: getRecipientEmails_().length,
    generatedAt: Utilities.formatDate(now, CONFIG.timezone, "yyyy-MM-dd HH:mm:ss z")
  };

  GmailApp.sendEmail(
    getStatusReportRecipient_(),
    `${CONFIG.appName} Weekly Digest · ${Utilities.formatDate(now, CONFIG.timezone, "MMM d")}`,
    buildWeeklyDigestPlainText_(payload),
    {
      htmlBody: buildWeeklyDigestHtml_(payload),
      name: CONFIG.senderName
    }
  );
}

function getApprovedReadings_() {
  const sheetReadings = readReadingQueueSheet_();
  return sheetReadings.length ? sheetReadings : GENERATED_READINGS;
}

function getReadingSequence_(readingId) {
  const index = getApprovedReadings_().findIndex(reading => reading.id === readingId);
  return index >= 0 ? index + 1 : "";
}

function refreshReadingQueueSheetFromGenerated_() {
  const sheet = getReadingQueueSheet_();
  if (sheet.getLastRow() > 1) sheet.getRange(2, 1, sheet.getLastRow() - 1, 9).clearContent();
  if (!GENERATED_READINGS.length) return;
  sheet.getRange(2, 1, GENERATED_READINGS.length, 9).setValues(GENERATED_READINGS.map((reading, index) => [
    index + 1,
    reading.id,
    "yes",
    reading.title,
    reading.transliteration,
    reading.collection,
    reading.sourceUrl,
    JSON.stringify(reading),
    "Seeded from Readings.gs"
  ]));
  sheet.autoResizeColumns(1, 9);
}

function readReadingQueueSheet_() {
  const spreadsheetId = getObservabilitySpreadsheetId_();
  if (!spreadsheetId) return [];

  try {
    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    const sheet = spreadsheet.getSheetByName(CONFIG.readingQueueSheetName);
    if (!sheet || sheet.getLastRow() < 2) return [];
    const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 9).getDisplayValues();
    return values
      .map(row => ({
        sequence: Number(row[0] || 0),
        id: row[1],
        enabled: String(row[2] || "").trim().toLowerCase(),
        json: row[7]
      }))
      .filter(row => row.id && row.json && !["no", "false", "0", "disabled"].includes(row.enabled))
      .sort((a, b) => (a.sequence || 999999) - (b.sequence || 999999))
      .map(row => {
        const reading = JSON.parse(row.json);
        if (reading.id !== row.id) throw new Error(`Reading Queue id mismatch: ${row.id}`);
        return reading;
      });
  } catch (error) {
    console.error(`Could not read Reading Queue sheet; falling back to generated readings: ${error.message}`);
    return [];
  }
}

function getReadingQueueSheet_() {
  return getObservabilitySheet_(CONFIG.readingQueueSheetName, [
    "Sequence",
    "Reading Id",
    "Enabled",
    "Title",
    "Transliteration",
    "Collection",
    "Source URL",
    "Reading JSON",
    "Notes"
  ]);
}

function getDeliveryPlan_() {
  const deliveredById = {};
  readDeliveryLog_().forEach(entry => {
    if (entry.status === "sent") deliveredById[entry.id] = entry.date;
  });
  parseJsonArray_(PropertiesService.getUserProperties().getProperty("SENT_READING_IDS")).forEach(id => {
    if (!deliveredById[id]) deliveredById[id] = "legacy";
  });

  return getApprovedReadings_().map((reading, index) => {
    const deliveredDate = deliveredById[reading.id] || "";
    return {
      sequence: index + 1,
      id: reading.id,
      title: reading.title,
      transliteration: reading.transliteration,
      collection: reading.collection,
      sourceUrl: reading.sourceUrl,
      status: deliveredDate ? "Delivered" : "Planned",
      deliveredDate
    };
  });
}

function appendDeliveryLog_(entry) {
  const sheet = getObservabilitySheet_("Delivery Log", [
    "Date",
    "Sent At",
    "Reading Id",
    "Sequence",
    "Title",
    "Transliteration",
    "Recipient Count",
    "Status",
    "Sent Count",
    "Failure Count",
    "Error Message"
  ]);
  sheet.appendRow([
    entry.date,
    entry.sentAt,
    entry.id,
    entry.sequence,
    entry.title,
    entry.transliteration,
    entry.recipientCount,
    entry.status,
    entry.sentCount === undefined ? entry.recipientCount : entry.sentCount,
    entry.failureCount || "",
    entry.errorMessage || ""
  ]);
}

function readDeliveryLog_() {
  const spreadsheetId = getObservabilitySpreadsheetId_();
  if (!spreadsheetId) return [];

  try {
    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    const sheet = spreadsheet.getSheetByName("Delivery Log");
    if (!sheet || sheet.getLastRow() < 2) return [];
    return sheet.getRange(2, 1, sheet.getLastRow() - 1, 11).getDisplayValues()
      .map(row => ({
        date: row[0],
        sentAt: row[1],
        id: row[2],
        sequence: Number(row[3]),
        title: row[4],
        transliteration: row[5],
        recipientCount: Number(row[6] || 0),
        status: row[7],
        sentCount: Number(row[8] || 0),
        failureCount: Number(row[9] || 0),
        errorMessage: row[10]
      }))
      .filter(entry => entry.id);
  } catch (error) {
    console.error(`Could not read delivery log: ${error.message}`);
    return [];
  }
}

function refreshDeliveryPlanSheet_() {
  const sheet = getObservabilitySheet_("Delivery Plan", [
    "Sequence",
    "Reading Id",
    "Title",
    "Transliteration",
    "Collection",
    "Status",
    "Delivered Date",
    "Source URL"
  ]);
  const plan = getDeliveryPlan_();
  if (sheet.getLastRow() > 1) sheet.getRange(2, 1, sheet.getLastRow() - 1, 8).clearContent();
  if (!plan.length) return;
  sheet.getRange(2, 1, plan.length, 8).setValues(plan.map(item => [
    item.sequence,
    item.id,
    item.title,
    item.transliteration,
    item.collection,
    item.status,
    item.deliveredDate === "legacy" ? "Delivered before dated ledger" : item.deliveredDate,
    item.sourceUrl
  ]));
  sheet.autoResizeColumns(1, 8);
}

function clearDeliveryLog_() {
  const spreadsheetId = getObservabilitySpreadsheetId_();
  if (!spreadsheetId) return;
  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  const logSheet = spreadsheet.getSheetByName("Delivery Log");
  if (logSheet && logSheet.getLastRow() > 1) logSheet.getRange(2, 1, logSheet.getLastRow() - 1, 11).clearContent();
  refreshDeliveryPlanSheet_();
}

function refreshContentPipelineSheet_(pipeline) {
  const sheet = getObservabilitySheet_("Content Pipeline", [
    "Metric",
    "Value",
    "Notes"
  ]);
  const rows = [
    ["Approved queue", pipeline.approvedQueue, "Enabled readings in the Drive-backed Reading Queue"],
    ["Delivered", pipeline.delivered, "Readings marked delivered in delivery log or legacy progress"],
    ["Remaining", pipeline.remaining, "Approved readings not yet delivered"],
    ["Low queue threshold", pipeline.lowQueueThreshold, "Status report warns at or below this number"],
    ["Next reading", pipeline.nextReadingTitle || "None", pipeline.nextReadingId || "Queue empty"],
    ["Last delivered", pipeline.lastDeliveredTitle || "None", pipeline.lastDeliveredDate || ""],
    ["Generated at", pipeline.generatedAt, CONFIG.timezone]
  ];
  if (sheet.getLastRow() > 1) sheet.getRange(2, 1, sheet.getLastRow() - 1, 3).clearContent();
  sheet.getRange(2, 1, rows.length, 3).setValues(rows);
  sheet.autoResizeColumns(1, 3);
}

function getObservabilitySheet_(name, headers) {
  const spreadsheet = getObservabilitySpreadsheet_();
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) sheet = spreadsheet.insertSheet(name);
  const existing = sheet.getRange(1, 1, 1, headers.length).getDisplayValues()[0];
  if (existing.join("") !== headers.join("")) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getObservabilitySpreadsheet_() {
  const properties = PropertiesService.getScriptProperties();
  const spreadsheetId = getObservabilitySpreadsheetId_();
  if (spreadsheetId) return SpreadsheetApp.openById(spreadsheetId);

  const spreadsheet = SpreadsheetApp.create(`${CONFIG.appName} Observability`);
  properties.setProperty("OBSERVABILITY_SPREADSHEET_ID", spreadsheet.getId());
  return spreadsheet;
}

function getObservabilitySpreadsheetId_() {
  return PropertiesService.getScriptProperties().getProperty("OBSERVABILITY_SPREADSHEET_ID") || CONFIG.observabilitySpreadsheetId;
}

function setLegacySentIds_(sentIds) {
  const encoded = JSON.stringify(sentIds);
  if (encoded.length < 8000) {
    PropertiesService.getUserProperties().setProperty("SENT_READING_IDS", encoded);
  }
}

function parseJsonArray_(value) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function uniqueStrings_(values) {
  const seen = {};
  return values
    .map(value => String(value || "").trim())
    .filter(value => {
      if (!value || seen[value]) return false;
      seen[value] = true;
      return true;
    });
}

function getContentPipelineStatus_(plan) {
  const delivered = plan.filter(item => item.status === "Delivered");
  const remaining = plan.filter(item => item.status !== "Delivered");
  const lastDelivered = delivered[delivered.length - 1];
  const nextReading = remaining[0];
  return {
    approvedQueue: plan.length,
    delivered: delivered.length,
    remaining: remaining.length,
    lowQueueThreshold: CONFIG.lowQueueThreshold,
    nextReadingId: nextReading?.id || "",
    nextReadingTitle: nextReading?.title || "",
    lastDeliveredId: lastDelivered?.id || "",
    lastDeliveredTitle: lastDelivered?.title || "",
    lastDeliveredDate: lastDelivered?.deliveredDate || "",
    generatedAt: Utilities.formatDate(new Date(), CONFIG.timezone, "yyyy-MM-dd HH:mm:ss z")
  };
}

function getObservabilityAlerts_(status) {
  const alerts = [];
  if (status.failureError) {
    alerts.push({
      level: "critical",
      title: "Delivery failed",
      detail: status.failureError.message || String(status.failureError)
    });
  }
  if (status.event === "queue-empty") {
    alerts.push({
      level: "critical",
      title: "Queue empty",
      detail: "No approved readings remain for tomorrow."
    });
  } else if (status.remainingCount <= CONFIG.lowQueueThreshold) {
    alerts.push({
      level: "warning",
      title: "Low queue",
      detail: `${status.remainingCount} approved readings remain. Add more before the queue runs out.`
    });
  }
  return alerts;
}

function buildStatusPlainText_(status) {
  const deliveryLine = status.event === "delivery-failed"
    ? `Delivery failed: #${status.deliveryEntry?.sequence || "?"} ${status.deliveryEntry?.title || "Unknown reading"}`
    : status.deliveryEntry
    ? `Delivered today: #${status.deliveryEntry.sequence} ${status.deliveryEntry.title} (${status.deliveryEntry.recipientCount} recipients)`
    : status.event === "queue-empty"
    ? "No unread poem remained today."
    : "Manual status report.";
  const nextLine = status.nextReading
    ? `Next planned: #${status.nextReading.sequence} ${status.nextReading.title}`
    : "Next planned: none; queue is empty.";
  const alertLines = status.alerts.length
    ? `\n\nAlerts:\n${status.alerts.map(alert => `${alert.level.toUpperCase()}: ${alert.title} — ${alert.detail}`).join("\n")}`
    : "";
  const pipelineLines = `Approved queue: ${status.pipeline.approvedQueue}\nPipeline delivered: ${status.pipeline.delivered}\nPipeline remaining: ${status.pipeline.remaining}`;
  const upcoming = status.plan
    .filter(item => item.status !== "Delivered")
    .slice(0, 7)
    .map(item => `${item.sequence}. ${item.title}`)
    .join("\n");

  return `${CONFIG.appName} Status\n${CONFIG.tagline}\n\n${deliveryLine}${alertLines}\n\nDelivered: ${status.deliveredCount}\nRemaining: ${status.remainingCount}\nActive recipients: ${status.recipientCount}\n${nextLine}\n\nContent pipeline:\n${pipelineLines}\n\nObservability sheet:\n${status.spreadsheetUrl}\n\nUpcoming queue:\n${upcoming || "No upcoming poems."}`;
}

function buildStatusHtml_(status) {
  const deliveryLine = status.event === "delivery-failed"
    ? `Delivery failed: <b>#${status.deliveryEntry?.sequence || "?"} ${status.deliveryEntry?.title || "Unknown reading"}</b>.`
    : status.deliveryEntry
    ? `Delivered today: <b>#${status.deliveryEntry.sequence} ${status.deliveryEntry.title}</b> to ${status.deliveryEntry.recipientCount} recipients.`
    : status.event === "queue-empty"
    ? "No unread poem remained today."
    : "Manual status report.";
  const nextLine = status.nextReading
    ? `#${status.nextReading.sequence} ${status.nextReading.title}`
    : "None; queue is empty.";
  const alertBox = status.alerts.length
    ? `<div style="margin:0 0 20px">${status.alerts.map(alert => `<div style="margin:0 0 8px;padding:12px 14px;background:${alert.level === "critical" ? "#fff0ed" : "#fff6df"};border-left:3px solid ${alert.level === "critical" ? "#c45645" : "#bd8145"}"><b>${alert.title}</b><br><span style="color:#68716b">${alert.detail}</span></div>`).join("")}</div>`
    : "";
  const upcomingRows = status.plan
    .filter(item => item.status !== "Delivered")
    .slice(0, 7)
    .map(item => `<tr><td style="padding:7px 8px;border-top:1px solid #eadfce">${item.sequence}</td><td style="padding:7px 8px;border-top:1px solid #eadfce;direction:rtl;font-family:'Noto Nastaliq Urdu','Noto Naskh Arabic',serif">${item.title}</td><td style="padding:7px 8px;border-top:1px solid #eadfce">${item.collection}</td></tr>`)
    .join("");

  return `<!doctype html>
    <html><body style="margin:0;background:#f3efe6;color:#17352d;font-family:Arial,sans-serif">
      <div style="max-width:720px;margin:0 auto;padding:26px 14px 38px">
        <div style="padding:24px;background:#fffdf8;border:1px solid #e3dacb;border-radius:5px">
          <p style="margin:0;color:#bd8145;font-size:11px;font-weight:bold;letter-spacing:2px;text-transform:uppercase">Daily Status</p>
          <h1 style="margin:8px 0 0;font-family:Georgia,serif;font-size:28px">${CONFIG.appName}</h1>
          <p style="margin:4px 0 22px;color:#68716b">${CONFIG.tagline}</p>
          <p style="margin:0 0 18px;font-size:16px;line-height:1.5">${deliveryLine}</p>
          ${alertBox}
          <div style="display:flex;gap:10px;flex-wrap:wrap;margin:0 0 20px">
            <div style="padding:13px 15px;background:#f4efe6;border-radius:4px"><b>${status.deliveredCount}</b><br><span style="color:#68716b;font-size:12px">Delivered</span></div>
            <div style="padding:13px 15px;background:#f4efe6;border-radius:4px"><b>${status.remainingCount}</b><br><span style="color:#68716b;font-size:12px">Remaining</span></div>
            <div style="padding:13px 15px;background:#f4efe6;border-radius:4px"><b>${status.recipientCount}</b><br><span style="color:#68716b;font-size:12px">Recipients</span></div>
          </div>
          <p style="margin:0 0 8px;color:#bd8145;font-size:10px;font-weight:bold;letter-spacing:2px;text-transform:uppercase">Content Pipeline</p>
          <p style="margin:0 0 18px;color:#17352d;line-height:1.6">Approved queue: <b>${status.pipeline.approvedQueue}</b> · Delivered: <b>${status.pipeline.delivered}</b> · Remaining: <b>${status.pipeline.remaining}</b></p>
          <p style="margin:0 0 12px"><b>Next planned:</b> ${nextLine}</p>
          <p style="margin:0 0 22px"><a href="${status.spreadsheetUrl}" style="color:#bd8145">Open observability sheet</a></p>
          <p style="margin:0 0 8px;color:#bd8145;font-size:10px;font-weight:bold;letter-spacing:2px;text-transform:uppercase">Next 7 in Queue</p>
          <table style="width:100%;border-collapse:collapse;font-size:13px">${upcomingRows || '<tr><td style="padding:7px 8px;border-top:1px solid #eadfce">No upcoming poems.</td></tr>'}</table>
        </div>
      </div>
    </body></html>`;
}

function buildWeeklyDigestPlainText_(digest) {
  const recentLines = digest.sentThisWeek
    .map(entry => `${entry.date}: #${entry.sequence} ${entry.title} (${entry.recipientCount} recipients)`)
    .join("\n");
  const failureLines = digest.failedThisWeek
    .map(entry => `${entry.date}: #${entry.sequence} ${entry.title} — ${entry.errorMessage}`)
    .join("\n");
  const nextSeven = digest.plan
    .filter(item => item.status !== "Delivered")
    .slice(0, 7)
    .map(item => `${item.sequence}. ${item.title}`)
    .join("\n");

  return `${CONFIG.appName} Weekly Digest\nGenerated: ${digest.generatedAt}\n\nSent this week: ${digest.sentThisWeek.length}\nFailed this week: ${digest.failedThisWeek.length}\nActive recipients: ${digest.recipientCount}\nApproved queue: ${digest.pipeline.approvedQueue}\nDelivered total: ${digest.pipeline.delivered}\nRemaining: ${digest.pipeline.remaining}\n\nRecent sends:\n${recentLines || "No sends recorded this week."}\n\nFailures:\n${failureLines || "No failures recorded this week."}\n\nNext 7:\n${nextSeven || "No upcoming poems."}\n\nObservability sheet:\n${digest.spreadsheetUrl}`;
}

function buildWeeklyDigestHtml_(digest) {
  const recentRows = digest.sentThisWeek
    .map(entry => `<tr><td style="padding:7px 8px;border-top:1px solid #eadfce">${entry.date}</td><td style="padding:7px 8px;border-top:1px solid #eadfce">${entry.sequence}</td><td style="padding:7px 8px;border-top:1px solid #eadfce;direction:rtl;font-family:'Noto Nastaliq Urdu','Noto Naskh Arabic',serif">${entry.title}</td><td style="padding:7px 8px;border-top:1px solid #eadfce">${entry.recipientCount}</td></tr>`)
    .join("");
  const failureRows = digest.failedThisWeek
    .map(entry => `<tr><td style="padding:7px 8px;border-top:1px solid #eadfce">${entry.date}</td><td style="padding:7px 8px;border-top:1px solid #eadfce">${entry.sequence}</td><td style="padding:7px 8px;border-top:1px solid #eadfce;direction:rtl;font-family:'Noto Nastaliq Urdu','Noto Naskh Arabic',serif">${entry.title}</td><td style="padding:7px 8px;border-top:1px solid #eadfce;color:#c45645">${entry.errorMessage}</td></tr>`)
    .join("");
  const nextRows = digest.plan
    .filter(item => item.status !== "Delivered")
    .slice(0, 7)
    .map(item => `<tr><td style="padding:7px 8px;border-top:1px solid #eadfce">${item.sequence}</td><td style="padding:7px 8px;border-top:1px solid #eadfce;direction:rtl;font-family:'Noto Nastaliq Urdu','Noto Naskh Arabic',serif">${item.title}</td><td style="padding:7px 8px;border-top:1px solid #eadfce">${item.collection}</td></tr>`)
    .join("");

  return `<!doctype html>
    <html><body style="margin:0;background:#f3efe6;color:#17352d;font-family:Arial,sans-serif">
      <div style="max-width:760px;margin:0 auto;padding:26px 14px 38px">
        <div style="padding:24px;background:#fffdf8;border:1px solid #e3dacb;border-radius:5px">
          <p style="margin:0;color:#bd8145;font-size:11px;font-weight:bold;letter-spacing:2px;text-transform:uppercase">Weekly Digest</p>
          <h1 style="margin:8px 0 0;font-family:Georgia,serif;font-size:28px">${CONFIG.appName}</h1>
          <p style="margin:4px 0 22px;color:#68716b">Generated ${digest.generatedAt}</p>
          <div style="display:flex;gap:10px;flex-wrap:wrap;margin:0 0 22px">
            <div style="padding:13px 15px;background:#f4efe6;border-radius:4px"><b>${digest.sentThisWeek.length}</b><br><span style="color:#68716b;font-size:12px">Sent This Week</span></div>
            <div style="padding:13px 15px;background:#f4efe6;border-radius:4px"><b>${digest.failedThisWeek.length}</b><br><span style="color:#68716b;font-size:12px">Failed This Week</span></div>
            <div style="padding:13px 15px;background:#f4efe6;border-radius:4px"><b>${digest.recipientCount}</b><br><span style="color:#68716b;font-size:12px">Recipients</span></div>
            <div style="padding:13px 15px;background:#f4efe6;border-radius:4px"><b>${digest.pipeline.remaining}</b><br><span style="color:#68716b;font-size:12px">Remaining</span></div>
          </div>
          <p style="margin:0 0 22px"><a href="${digest.spreadsheetUrl}" style="color:#bd8145">Open observability sheet</a></p>
          <p style="margin:0 0 8px;color:#bd8145;font-size:10px;font-weight:bold;letter-spacing:2px;text-transform:uppercase">Recent Sends</p>
          <table style="width:100%;border-collapse:collapse;font-size:13px">${recentRows || '<tr><td style="padding:7px 8px;border-top:1px solid #eadfce">No sends recorded this week.</td></tr>'}</table>
          <p style="margin:24px 0 8px;color:#bd8145;font-size:10px;font-weight:bold;letter-spacing:2px;text-transform:uppercase">Failures</p>
          <table style="width:100%;border-collapse:collapse;font-size:13px">${failureRows || '<tr><td style="padding:7px 8px;border-top:1px solid #eadfce">No failures recorded this week.</td></tr>'}</table>
          <p style="margin:24px 0 8px;color:#bd8145;font-size:10px;font-weight:bold;letter-spacing:2px;text-transform:uppercase">Next 7</p>
          <table style="width:100%;border-collapse:collapse;font-size:13px">${nextRows || '<tr><td style="padding:7px 8px;border-top:1px solid #eadfce">No upcoming poems.</td></tr>'}</table>
        </div>
      </div>
    </body></html>`;
}

function buildHtml_(reading, isPreview) {
  const unsubscribeInstructions = getUnsubscribeInstructions_();
  const verses = reading.verses.map((verse, index) => {
    const words = verse.words
      .map(word => `<span style="display:inline-block;margin:3px 8px;color:#68716b;font-size:13px"><b style="color:#17352d">${word[0]}</b>&nbsp; — &nbsp;${word[1]}</span>`)
      .join("");
    const english = verse.englishTranslation
      ? `<p style="margin:13px auto 0;max-width:610px;color:#68716b;font-family:Georgia,serif;font-size:15px;line-height:1.6;font-style:italic;direction:ltr">${verse.englishTranslation}</p>`
      : "";

    return `
      <div style="padding:26px 10px;border-top:${index ? "1px solid #eadfce" : "0"};text-align:center">
        <div style="font-family:'Noto Nastaliq Urdu','Noto Naskh Arabic',serif;font-size:27px;line-height:2.15;color:#17352d;direction:rtl">
          ${verse.lines.join("<br>")}
        </div>
        <div style="margin:15px auto 0;padding:14px 16px;background:#f4efe6;border-radius:4px;max-width:610px;direction:rtl">
          <p style="margin:0;color:#68716b;font-family:'Noto Nastaliq Urdu','Noto Naskh Arabic',serif;font-size:15px;line-height:2">${verse.explanation}</p>
          <div style="margin-top:9px;padding-top:8px;border-top:1px solid #ded3c2">${words}</div>
        </div>
        ${english}
      </div>`;
  }).join("");
  const historical = buildHistoricalHtml_(reading.historicalContext);

  return `<!doctype html>
    <html><body style="margin:0;background:#f3efe6;color:#17352d;font-family:Arial,sans-serif">
      <div style="display:none;max-height:0;overflow:hidden">One complete poem from Iqbal, with Urdu guidance.</div>
      <div style="max-width:720px;margin:0 auto;padding:28px 14px 42px">
        ${isPreview ? '<p style="margin:0 0 14px;text-align:center;color:#bd8145;font-size:11px;letter-spacing:2px">PREVIEW EMAIL</p>' : ""}
        <div style="padding:28px 24px;background:#fffdf8;border:1px solid #e3dacb;border-radius:5px">
          <div style="margin:0 0 22px;text-align:right">
            <p style="margin:0;color:#17352d;font-family:Georgia,serif;font-size:18px;line-height:1.2">${CONFIG.appName}</p>
            <p style="margin:4px 0 0;color:#7b817d;font-size:11px;letter-spacing:1.2px;text-transform:uppercase">${CONFIG.tagline}</p>
          </div>
          <p style="margin:0;text-align:center;color:#bd8145;font-size:12px">${reading.collection}</p>
          <h1 style="margin:10px 0 2px;text-align:center;font-family:'Noto Nastaliq Urdu','Noto Naskh Arabic',serif;font-size:30px;font-weight:normal;line-height:1.8;direction:rtl">${reading.title}</h1>
          <p style="margin:0 0 24px;text-align:center;color:#7b817d;font-family:Georgia,serif;font-size:13px;font-style:italic">${reading.transliteration}</p>
          ${historical}
          ${verses}
        </div>
        <div style="padding:28px 18px;text-align:center">
          <p style="margin:0 0 8px;color:#bd8145;font-size:10px;font-weight:bold;letter-spacing:2px">PAUSE & REFLECT</p>
          <p style="margin:0;color:#17352d;font-family:Georgia,serif;font-size:20px;line-height:1.5">${reading.reflection}</p>
          <p style="margin:28px 0 5px;color:#bd8145;font-size:10px;font-weight:bold;letter-spacing:2px">TODAY'S TAKEAWAY</p>
          <p style="margin:0;color:#17352d;font-family:Georgia,serif;font-size:18px;line-height:1.5">${reading.takeaway}</p>
        </div>
        <p style="margin:0;text-align:center;color:#818783;font-size:11px">${CONFIG.appName} · <a href="${reading.sourceUrl}" style="color:#818783">Text source</a></p>
        <p style="margin:10px 0 0;text-align:center;color:#818783;font-size:11px">Contact <a href="mailto:${CONFIG.contactEmail}" style="color:#818783">${CONFIG.contactEmail}</a> with any Questions.</p>
        <p style="margin:7px 0 0;text-align:center;color:#818783;font-size:11px">${unsubscribeInstructions}</p>
      </div>
    </body></html>`;
}

function buildPlainText_(reading) {
  const unsubscribeInstructions = getUnsubscribeInstructions_();
  const verses = reading.verses.map(verse => {
    const words = verse.words.map(word => `${word[0]} — ${word[1]}`).join(" | ");
    const english = verse.englishTranslation ? `\nEnglish: ${verse.englishTranslation}` : "";
    return `${verse.lines.join("\n")}\n${verse.explanation}${english}\n${words}`;
  }).join("\n\n");

  const context = reading.historicalContext
    ? `\n\nHistorical note (${reading.historicalContext.confidence || "unknown"}): ${reading.historicalContext.summaryEnglish || reading.historicalContext.summaryUrdu}\n${reading.historicalContext.sourceNote || ""}`
    : "";
  return `${CONFIG.appName}\n${CONFIG.tagline}\n\n${reading.title}\n${reading.transliteration}${context}\n\n${verses}\n\nReflection: ${reading.reflection}\n\nToday's takeaway: ${reading.takeaway}\n\nContact ${CONFIG.contactEmail} with any Questions.\n${unsubscribeInstructions}`;
}

function getUnsubscribeInstructions_() {
  const formUrl = PropertiesService.getScriptProperties().getProperty("UNSUBSCRIBE_FORM_URL") || CONFIG.unsubscribeFormUrl;
  return formUrl
    ? `To unsubscribe, use this form: ${formUrl}`
    : CONFIG.unsubscribeInstructions;
}

function buildHistoricalHtml_(context) {
  if (!context) return "";
  const source = [context.period && `Period: ${context.period}`, context.place && `Place: ${context.place}`, context.sourceNote]
    .filter(Boolean)
    .join(" · ");

  return `
    <div style="margin:20px auto 26px;padding:15px 17px;max-width:610px;border-left:2px solid #bd8145;background:#f4efe6;text-align:left">
      <p style="margin:0 0 6px;color:#bd8145;font-size:10px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase">Historical Note · ${(context.confidence || "unknown").toUpperCase()}</p>
      <p style="margin:0;color:#17352d;font-family:Georgia,serif;font-size:14px;line-height:1.6">${context.summaryEnglish || context.summaryUrdu || ""}</p>
      <p style="margin:7px 0 0;color:#68716b;font-size:11px;line-height:1.5">${source}</p>
    </div>`;
}
