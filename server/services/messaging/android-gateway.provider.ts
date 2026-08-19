import { ApiError } from '../../utils/errors';
import type { MessagingProvider, ProviderConnectionInfo, ProviderSendRequest, ProviderSendResult } from './types';

export class AndroidSmsGatewayProvider implements MessagingProvider {
  readonly type = 'android_sms_gateway' as const;

  async validate(config: Record<string, unknown>): Promise<ProviderConnectionInfo> {
    const gatewayUrl = String(config.gateway_url || '').replace(/\/$/, '');
    const apiKey = String(config.api_key || '');
    if (!gatewayUrl) throw new ApiError(422, 'Android gateway URL is required');
    try {
      const response = await fetch(`${gatewayUrl}/status`, { headers: apiKey ? { authorization: `Bearer ${apiKey}` } : {}, signal: AbortSignal.timeout(10_000) });
      const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
      return response.ok ? { status: 'connected', info: { device: String(payload.device || payload.device_name || ''), sim_number: String(payload.sim_number || ''), battery: String(payload.battery || payload.battery_level || ''), http_status: response.status } } : { status: 'error', error: `Gateway returned HTTP ${response.status}` };
    } catch (error) {
      return { status: 'error', error: error instanceof Error ? error.message : 'Android gateway validation failed' };
    }
  }

  async send(config: Record<string, unknown>, request: ProviderSendRequest): Promise<ProviderSendResult> {
    const gatewayUrl = String(config.gateway_url || '').replace(/\/$/, '');
    const apiKey = String(config.api_key || '');
    if (!gatewayUrl) return { status: 'failed', errorMessage: 'Android gateway URL is required' };
    try {
      const response = await fetch(`${gatewayUrl}/send`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}) },
        body: JSON.stringify({ to: request.recipient, message: request.message }),
        signal: AbortSignal.timeout(20_000)
      });
      const payload = await response.text();
      return response.ok ? { status: 'sent', providerResponse: payload.slice(0, 2_000) } : { status: 'failed', providerResponse: payload.slice(0, 2_000), errorMessage: `Gateway returned HTTP ${response.status}` };
    } catch (error) {
      return { status: 'failed', errorMessage: error instanceof Error ? error.message : 'Android gateway delivery failed' };
    }
  }

  test(config: Record<string, unknown>, recipient: string, message: string) {
    return this.send(config, { recipient, message, channel: 'sms' });
  }
}
