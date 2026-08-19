import { AndroidSmsGatewayProvider } from './android-gateway.provider';
import { DisabledProvider } from './disabled.provider';
import { GsmModemProvider } from './gsm-modem.provider';
import { SmsGatewayApiProvider } from './sms-gateway.provider';
import type { MessagingProvider, ProviderType } from './types';
import { WhatsAppBusinessProvider } from './whatsapp.provider';

export class ProviderRegistry {
  private providers: Record<ProviderType, MessagingProvider> = {
    disabled: new DisabledProvider(),
    gsm_modem: new GsmModemProvider(),
    sms_gateway_api: new SmsGatewayApiProvider(),
    android_sms_gateway: new AndroidSmsGatewayProvider(),
    whatsapp_business_api: new WhatsAppBusinessProvider()
  };

  get(type: ProviderType) { return this.providers[type]; }
  gsm() { return this.providers.gsm_modem as GsmModemProvider; }
}

export const providerRegistry = new ProviderRegistry();
