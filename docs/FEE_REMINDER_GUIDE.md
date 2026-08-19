# Automatic Fee Reminder Guide

Open:

```text
Fees & Finance → Fee Reminders
```

## Default behavior

| Setting | Default |
| --- | --- |
| Automatic reminders | Disabled until configured |
| Reminder day | 5th of each month |
| Template | `fee_due` |
| Channel | SMS gateway |

The scheduler checks once per minute while the server is running. On the configured day, it finds invoices with these statuses:

```text
unpaid
partial
overdue
```

Students are grouped by outstanding balance. The scheduler records a `fee.reminder_last_date` value and never runs the scheduled batch more than once on the same day.

## Supported placeholders

```text
{{student_name}}
{{father_name}}
{{class}}
{{section}}
{{due_amount}}
{{due_date}}
{{school_name}}
```

Legacy one-brace placeholders such as `{student}`, `{amount}`, and `{due_date}` continue to work.

## Manual reminders

Use **Send Reminder Now** to resend to all students with outstanding invoices. Manual runs are intentionally logged separately and are not blocked by the scheduled-run duplicate guard.

## Offline gateway behavior

If the SMS gateway is disabled, the system still creates `queued` SMS log records. Once a gateway is enabled, queued records remain auditable and administrators can resend them from SMS & WhatsApp → Delivery Log.

Regular WhatsApp click-to-send is supported for manual communication. Fully automatic WhatsApp delivery requires an approved WhatsApp provider/API configured by the school.
