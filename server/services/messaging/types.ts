export type ProviderType = 'disabled' | 'gsm_modem' | 'sms_gateway_api' | 'android_sms_gateway' | 'whatsapp_business_api';
export type MessageChannel = 'sms' | 'whatsapp' | 'auto';
export type DeliveryStatus = 'queued' | 'sent' | 'failed' | 'delivered';

export type ProviderConfiguration = {
  id: number;
  provider_code: string;
  provider_name: string;
  provider_type: ProviderType;
  name: string;
  config: Record<string, unknown>;
  is_enabled: boolean;
  connection_status: string;
};

export type ProviderSendRequest = {
  recipient: string;
  message: string;
  channel: MessageChannel;
  recipientName?: string;
};

export type ProviderSendResult = {
  status: DeliveryStatus;
  providerResponse?: string;
  errorMessage?: string;
  externalMessageId?: string;
};

export type ProviderConnectionInfo = {
  status: 'connected' | 'disconnected' | 'error' | 'unknown';
  info?: Record<string, string | number | boolean | null>;
  error?: string;
};

export interface MessagingProvider {
  readonly type: ProviderType;
  validate(config: Record<string, unknown>): Promise<ProviderConnectionInfo>;
  send(config: Record<string, unknown>, request: ProviderSendRequest): Promise<ProviderSendResult>;
  test(config: Record<string, unknown>, recipient: string, message: string): Promise<ProviderSendResult>;
}
