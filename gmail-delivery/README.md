# Mehfil-e-Shairee Gmail delivery

This Google Apps Script sends one complete annotated poem from your own Gmail account. It does not store a Gmail password or use a third-party email service.

## Install

1. Sign into the Gmail account that should send and receive the trial email.
2. Open [Google Apps Script](https://script.google.com) and create a **New project**.
3. Replace the project `Code.gs` with this folder's `Code.gs`.
4. Add a script file named `Readings` and paste this folder's generated `Readings.gs` into it.
5. Name the project `Roz-e-Iqbal Delivery` and save it.
6. Select `sendPreviewEmail` from the function menu and click **Run**.
7. Review Google's permission screen and allow the script to send email from your account.
8. Check the preview in your inbox.
9. Only after approving the preview, select and run `setupDailyDelivery` once.

The default schedule is around 7:00 AM in `America/Chicago`. Apps Script time triggers may run within the selected hour rather than at an exact minute.

## Controls

- `sendPreviewEmail`: sends a preview without marking the poem complete.
- `sendPreviewEmailToRecipients`: sends a preview to everyone in the configured recipient list.
- `sendPreviewEmailToFirstTwoFormRecipients`: sends a preview to only the first two valid emails from the Google Form response sheet.
- `logRecipientSummary`: logs recipient counts without sending email.
- `logDeliveryPlan`: logs the full poem queue and current delivery status.
- `sendDailyReading`: sends the next unread poem, records it in the delivery ledger, and emails the owner a status report.
- `sendDailyStatusReport`: emails the owner the current delivery status without sending a poem.
- `sendWeeklyDigest`: emails the owner a weekly operating digest without sending a poem.
- `setupReadingQueueSheet`: seeds the Drive-backed reading queue from `Readings.gs`.
- `logReadingQueueSummary`: logs the active Drive-backed reading queue without sending email.
- `setupUnsubscribeSheet`: creates/refreshes the unsubscribe sheet in the observability workbook.
- `refreshRecipientStatus`: creates/refreshes the active/inactive recipient status sheet.
- `recordOwnerUnsubscribeTest`: records the signed-in owner email in the unsubscribe sheet for testing.
- `setupDailyDelivery`: installs one daily trigger and removes older duplicates.
- `setupWeeklyDigest`: installs one weekly owner digest trigger.
- `removeDailyDelivery`: stops scheduled emails.
- `removeWeeklyDigest`: stops the weekly digest schedule.
- `resetDeliveryProgress`: allows the poem library to be sent again.

The current approved queue contains 17 poems. Once all are delivered, the script deliberately sends no further poems until another reviewed poem is added; it will send the owner a queue-empty status report instead of repeating poems accidentally.

## Observability

Daily delivery now maintains an automatically-created Google Sheet named
`Mehfil-e-Shairee Observability`.

- `Reading Queue`: the Drive-backed source of truth for approved daily poems.
  Each enabled row contains the reading metadata plus a full `Reading JSON`
  payload used by Apps Script at send time.
- `Delivery Plan`: the full ordered queue, status, delivered date, and source URL.
- `Delivery Log`: one row per real daily send, including date/time, reading ID,
  sequence, title, recipient count, status, sent count, failure count, and error
  message.
- `Content Pipeline`: approved queue, delivered count, remaining count, low queue
  threshold, next reading, and last delivered reading.
- `Recipient Status`: the derived main list used by delivery. It shows each
  email as `Active` or `Inactive`, with latest subscribe/unsubscribe dates.
- `Unsubscribed`: admin/emergency backup list for people who should no longer
  receive daily emails.

Daily status reports now include low-queue warnings when 7 or fewer approved
readings remain. If a delivery fails, the script writes a failed row in
`Delivery Log` and attempts an owner-only failure alert.

Run `setupReadingQueueSheet` after updating `Readings.gs` to seed or refresh the
Drive queue. After that, daily delivery reads from the `Reading Queue` tab first
and falls back to `Readings.gs` only if the queue tab is missing or empty.

Weekly digest support is available through `sendWeeklyDigest`. Run
`setupWeeklyDigest` only when you want a separate weekly scheduled digest in
addition to the daily owner status email.

The first status report creates the spreadsheet and stores its ID in Apps Script
Project Settings → Script properties as `OBSERVABILITY_SPREADSHEET_ID`.
You can set that property yourself if you want the script to use an existing
spreadsheet instead.

Older sends that happened before the dated ledger may appear as
`Delivered before dated ledger` if Apps Script still has their legacy sent IDs.
New deliveries are tracked with exact dates.

## Recipients

Daily delivery sends only to emails marked `Active` in the derived recipient
state. The script builds that state from:

- the signup Google Form response sheet,
- the unsubscribe Google Form response sheet,
- any static/admin recipients configured in Apps Script properties or `Code.gs`,
- the emergency `Unsubscribed` tab and `UNSUBSCRIBED_EMAILS` script property.

Subscription state uses a latest-action-wins rule. A newer signup makes the
email active again after an older unsubscribe. A newer unsubscribe makes the
email inactive again. The signup and unsubscribe response sheets stay as
append-only audit trails; the generated `Recipient Status` tab is the main
operational list.

Current recipient source files:

- Signup responses:
  `https://docs.google.com/spreadsheets/d/1bNDtUDSPCUqvJRsBfkTE2SzS2tYpzCmjIJYTTu6wT4g/edit?gid=1851218699#gid=1851218699`
- Unsubscribe responses:
  `https://docs.google.com/spreadsheets/d/1_t-Jo75QiKVaUsQdCdNSgD0JDT0Me953qEHkx8EftCo/edit?resourcekey=&gid=1104712912#gid=1104712912`

## Unsubscribe

Recipients unsubscribe through a separate Google Form with one required email
field. Link that form to a response Sheet and configure the response Sheet ID
in Apps Script. The next send reads that Sheet and marks matching emails
inactive in `Recipient Status`.

To resubscribe, the same person submits the signup Google Form again with the
same email address. If that signup row is newer than their unsubscribe row, the
daily sender marks them active and includes them again.

The script also supports an emergency manual suppression list through Apps
Script Project Settings → Script properties → `UNSUBSCRIBED_EMAILS`. Use
commas, semicolons, or new lines between addresses. This emergency list always
blocks those addresses until removed from the script property.

Every poem email includes this footer:

```text
To unsubscribe, use this form: YOUR_UNSUBSCRIBE_FORM_URL
```

### Google Form setup

1. Create a Google Form for signups.
2. Turn on email collection, or add a required question named `Email Address`.
3. Optional but recommended: add a required opt-in question such as
   `Do you want to receive Roz-e-Iqbal daily emails?` with answer `Yes`.
4. In the form's **Responses** tab, link responses to a Google Sheet.
5. Copy the response Sheet ID from the Sheet URL.

Example Sheet URL:

```text
https://docs.google.com/spreadsheets/d/SHEET_ID_HERE/edit
```

### Apps Script properties

Set these in Apps Script Project Settings → Script properties:

- `FORM_RESPONSES_SPREADSHEET_ID`: required, the linked response Sheet ID.
- `FORM_RESPONSES_SHEET_NAME`: optional; defaults to the first sheet.
- `FORM_EMAIL_HEADER`: optional; defaults to finding `Email Address` or `Email`.
- `FORM_OPT_IN_HEADER`: optional; when set, only accepted opt-in rows are used.
- `FORM_OPT_IN_ACCEPTED_VALUES`: optional comma-separated values; defaults include `yes`, `true`, and `subscribe`.
- `UNSUBSCRIBE_FORM_URL`: recommended, the unsubscribe form link shown in the email footer.
- `UNSUBSCRIBE_RESPONSES_SPREADSHEET_ID`: required for automatic unsubscribe handling, the linked unsubscribe response Sheet ID.
- `UNSUBSCRIBE_RESPONSES_SHEET_NAME`: optional; defaults to the first sheet.
- `UNSUBSCRIBE_RESPONSES_SHEET_GID`: optional; use when you want to target a specific tab by gid.
- `UNSUBSCRIBE_EMAIL_HEADER`: optional; defaults to finding `Email Address` or `Email`.

Manual backup lists are still supported:

- Apps Script Project Settings → Script properties → `RECIPIENT_EMAILS`
- `CONFIG.extraRecipients` inside `Code.gs`

Use commas, semicolons, or new lines between addresses in `RECIPIENT_EMAILS`.
Each recipient gets a separate email so addresses are not visible to others.
Keep `sendPreviewEmail` owner-only while testing. Then run
`logRecipientSummary`. After confirming the count, run
`sendPreviewEmailToFirstTwoFormRecipients` for the first live test. Run
`sendPreviewEmailToRecipients` only after confirming the list is correct.

## Generated library

The Apps Script project now uses two code files, while Google Sheets holds the
operational data:

- `Code.gs` contains the delivery and scheduling functions.
- `Readings.gs` is generated from approved local drafts by `npm run build:readings`
  and acts as the seed/fallback library for the Drive-backed `Reading Queue`.
- `content/delivery-plan.json` is generated locally by `npm run build:delivery-plan`.

After rebuilding and updating `Readings.gs`, run `sendPreviewEmail` once to
inspect the first reading; the existing daily trigger will use the expanded
library automatically.
