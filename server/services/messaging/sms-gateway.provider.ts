import { ApiError } from '../../utils/errors';
import type { MessagingProvider, ProviderConnectionInfo, ProviderSendRequest, ProviderSendResult } from './types';

export class SmsGatewayApiProvider implements MessagingProvider {
  readonly type = 'sms_gateway_api' as const;

  async validate(config: Record<string, unknown>): Promise<ProviderConnectionInfo> {
    const url = String(config.api_url || '').trim();
    if (!url) throw new ApiError(422, 'API URL is required');
    try {
      const response = await fetch(url, { method: 'OPTIONS', signal: AbortSignal.timeout(10_000) });
      return { status: response.ok || response.status === 405 ? 'connected' : 'error', info: { http_status: response.status }, error: response.ok || response.status === 405 ? undefined : `Gateway returned HTTP ${response.status}` };
    } catch (error) {
      return { status: 'error', error: error instanceof Error ? error.message : 'Gateway validation failed' };
    }
  }

  async send(config: Record<string, unknown>, request: ProviderSendRequest): Promise<ProviderSendResult> {
    const apiUrl = String(config.api_url || '').trim();
    const apiKey = String(config.api_key || '').trim();
    const senderId = String(config.sender_id || '').trim();
    if (!apiUrl) return { status: 'failed', errorMessage: 'API URL is required' };
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}) },
        body: JSON.stringify({ to: request.recipient, message: request.message, sender_id: senderId }),
        signal: AbortSignal.timeout(20_000)
      });
      const payload = await response.text();
      return response.ok ? { status: 'sent', providerResponse: payload.slice(0, 2_000) } : { status: 'failed', providerResponse: payload.slice(0, 2_000), errorMessage: `Gateway returned HTTP ${response.status}` };
    } catch (error) {
      return { status: 'failed', errorMessage: error instanceof Error ? error.message : 'Gateway delivery failed' };
    }
  }

  test(config: Record<string, unknown>, recipient: string, message: string) {
    return this.send(config, { recipient, message, channel: 'sms' });
  }
}
