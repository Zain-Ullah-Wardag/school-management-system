# Messaging Provider Guide

Open the module at:

```text
SMS & WhatsApp → Messaging Providers
```

## Provider Types

| Provider | Use case | Required configuration |
| --- | --- | --- |
| Disabled | Audit/queue-only mode | None |
| GSM Modem | Local USB modem with school SIM | COM port, baud rate, SIM information |
| SMS Gateway API | Commercial local/cloud SMS provider | API URL, API key, sender ID |
| Android SMS Gateway | Dedicated Android phone gateway | Gateway URL, API key |
| WhatsApp Business Cloud API | Meta-approved WhatsApp Business delivery | Phone Number ID, permanent token, business account ID |

## GSM modem setup

1. Connect the USB GSM modem to the server PC.
2. Install modem drivers if Windows does not expose a COM port.
3. Open Messaging Providers → GSM Modem.
4. Use **Refresh Ports**.
5. Choose COM port and baud rate (default `115200`).
6. Select **Connect** and **Auto Detect Modem**.
7. Confirm Manufacturer, Model, IMEI, SIM Status, Network, and Signal fields.
8. Save the configuration and use **Test SMS**.

On Linux, the ERP detects serial ports through the operating system. If no port is visible, ensure the server user has access to the appropriate `/dev/ttyUSB*` or `/dev/ttyACM*` device.

## SMS Gateway API

The implementation sends a standard JSON request:

```json
{
  "to": "03001234567",
  "message": "Message text",
  "sender_id": "SCHOOL"
}
```

with a Bearer token when an API key is supplied. For gateways with a different request schema, place a lightweight provider adapter/proxy at the configured API URL.

## Android SMS Gateway

The ERP expects these optional REST endpoints:

```text
GET  /status
POST /send
```

`/send` receives:

```json
{
  "to": "03001234567",
  "message": "Message text"
}
```

## WhatsApp Business Cloud API

The provider uses the Meta Graph API message endpoint:

```text
POST https://graph.facebook.com/v20.0/{PHONE_NUMBER_ID}/messages
```

Use a permanent access token in production. WhatsApp template-message requirements from Meta still apply outside the 24-hour customer service window.

## Delivery logs

Every send, failure, queue event, retry, and test message is stored in the provider-aware Delivery Log. Export CSV from the Delivery Log for audit or compliance use.

## Adding another provider

Implement the `MessagingProvider` interface in:

```text
server/services/messaging/types.ts
```

Then register it in:

```text
server/services/messaging/provider-registry.ts
```

No database schema change is required. Provider-specific fields belong in `provider_configurations.config_json`.
