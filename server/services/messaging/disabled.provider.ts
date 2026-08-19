import type { MessagingProvider, ProviderConnectionInfo, ProviderSendRequest, ProviderSendResult } from './types';

export class DisabledProvider implements MessagingProvider {
  readonly type = 'disabled' as const;
  async validate(): Promise<ProviderConnectionInfo> { return { status: 'disconnected', info: { message: 'Messaging is disabled' } }; }
  async send(_config: Record<string, unknown>, _request: ProviderSendRequest): Promise<ProviderSendResult> { return { status: 'queued', providerResponse: 'Messaging provider is disabled; message was queued only.' }; }
  test(config: Record<string, unknown>, recipient: string, message: string) { return this.send(config, { recipient, message, channel: 'auto' }); }
}
