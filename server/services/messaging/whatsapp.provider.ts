import { ApiError } from '../../utils/errors';
import type { MessagingProvider, ProviderConnectionInfo, ProviderSendRequest, ProviderSendResult } from './types';

export class WhatsAppBusinessProvider implements MessagingProvider {
  readonly type = 'whatsapp_business_api' as const;

  async validate(config: Record<string, unknown>): Promise<ProviderConnectionInfo> {
    const phoneNumberId = String(config.phone_number_id || '').trim();
    const accessToken = String(config.permanent_access_token || config.access_token || '').trim();
    if (!phoneNumberId || !accessToken) throw new ApiError(422, 'Phone Number ID and access token are required');
    try {
      const response = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}`, { headers: { authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(12_000) });
      const payload = await response.text();
      return response.ok ? { status: 'connected', info: { phone_number_id: phoneNumberId, response: payload.slice(0, 500) } } : { status: 'error', error: `WhatsApp API returned HTTP ${response.status}` };
    } catch (error) {
      return { status: 'error', error: error instanceof Error ? error.message : 'WhatsApp API validation failed' };
    }
  }

  async send(config: Record<string, unknown>, request: ProviderSendRequest): Promise<ProviderSendResult> {
    const phoneNumberId = String(config.phone_number_id || '').trim();
    const accessToken = String(config.permanent_access_token || config.access_token || '').trim();
    if (!phoneNumberId || !accessToken) return { status: 'failed', errorMessage: 'Phone Number ID and access token are required' };
    const recipient = request.recipient.replace(/\D/g, '').replace(/^0/, '92');
    try {
      const response = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', to: recipient, type: 'text', text: { preview_url: false, body: request.message } }),
        signal: AbortSignal.timeout(20_000)
      });
      const payload = await response.text();
      if (!response.ok) return { status: 'failed', providerResponse: payload.slice(0, 2_000), errorMessage: `WhatsApp API returned HTTP ${response.status}` };
      let externalMessageId: string | undefined;
      try { externalMessageId = (JSON.parse(payload) as { messages?: { id?: string }[] }).messages?.[0]?.id; } catch { /* raw response retained */ }
      return { status: 'sent', providerResponse: payload.slice(0, 2_000), externalMessageId };
    } catch (error) {
      return { status: 'failed', errorMessage: error instanceof Error ? error.message : 'WhatsApp delivery failed' };
    }
  }

  test(config: Record<string, unknown>, recipient: string, message: string) {
    return this.send(config, { recipient, message, channel: 'whatsapp' });
  }
}
