# Mehfil-e-Shairee TODO

## Active

- [ ] Publish/verify the unsubscribe Google Form responder link.
- [ ] Run `refreshRecipientStatus` and confirm unsubscribe/resubscribe behavior with two test emails.

## Backlog

- [ ] Decide whether to activate the weekly digest trigger, or run it manually at first.

## Done

- [x] Build full daily delivery queue.
- [x] Track delivered poems with dates.
- [x] Send daily owner status report after poem delivery.
- [x] Add low-queue alerts to daily status reports.
- [x] Add failed-send alerts for owner-only observability.
- [x] Add weekly digest reporting function.
- [x] Add content pipeline status reporting.
- [x] Verify locally and save the updated Apps Script.
- [x] Add unsubscribe handling through an observability sheet suppression list.
- [x] Verify unsubscribe support locally and save the updated Apps Script.
- [x] Fix resubscribe behavior so newer signup overrides older unsubscribe.
- [x] Verify latest-action-wins resubscribe behavior and save the updated Apps Script.
- [x] Make Google Drive/Sheets the source of truth for the daily reading queue.
- [x] Verify Drive-backed Reading Queue and seed it into the observability sheet.
- [x] Replace reply-based unsubscribe idea with form-based active/inactive recipient state.
- [x] Add derived `Recipient Status` sheet for the daily sender's main list.
- [x] Create unsubscribe Google Form and link it to a response Sheet.
- [x] Configure `UNSUBSCRIBE_FORM_URL` and `UNSUBSCRIBE_RESPONSES_SPREADSHEET_ID` in Apps Script.
