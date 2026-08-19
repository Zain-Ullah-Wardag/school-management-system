import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, CircleOff, Cpu, Plug, RefreshCw, Save, Send, ShieldCheck, Smartphone, Wifi } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { schoolApi } from '../../services/schoolApi';
import { queryKeys } from '../../services/queryKeys';
import { useMutationToast } from '../../hooks/useMutationToast';
import { Button } from '../common/Button';
import { Card } from '../common/Card';
import { Field, SelectInput, TextInput } from '../common/FormFields';
import { Badge } from '../common/Badge';
import { useToast } from '../../context/ToastContext';
import { apiError } from '../../services/api';

const providerCards = [
  { code: 'gsm_modem', title: 'GSM Modem', description: 'Local SIM through USB/COM modem', icon: Cpu },
  { code: 'sms_gateway_api', title: 'SMS Gateway API', description: 'Commercial HTTP messaging gateway', icon: Wifi },
  { code: 'android_sms_gateway', title: 'Android SMS Gateway', description: 'School Android device gateway', icon: Smartphone },
  { code: 'whatsapp_business_api', title: 'WhatsApp Business API', description: 'Meta WhatsApp Cloud API', icon: MessageIcon },
  { code: 'disabled', title: 'Disabled', description: 'Queue and log messages without delivery', icon: CircleOff }
] as const;

export function MessagingProviderPanel() {
  const { data: configurations = [], isLoading } = useQuery({ queryKey: queryKeys.messaging.configurations, queryFn: schoolApi.messaging.configurations });
  const [selectedCode, setSelectedCode] = useState<string>('disabled');
  const [selectedId, setSelectedId] = useState<number | undefined>();
  const selected = useMemo(() => configurations.find((item: any) => item.id === selectedId) || configurations.find((item: any) => item.provider_code === selectedCode), [configurations, selectedCode, selectedId]);

  useEffect(() => {
    if (!configurations.length) return;
    const defaultConfig = configurations.find((item: any) => item.is_default) || configurations[0];
    setSelectedCode((current) => current === 'disabled' && defaultConfig ? defaultConfig.provider_code : current);
    setSelectedId((current) => current || defaultConfig?.id);
  }, [configurations]);

  const choose = (code: string) => {
    const existing = configurations.find((item: any) => item.provider_code === code);
    setSelectedCode(code);
    setSelectedId(existing?.id);
  };

  return <div className="space-y-5">
    <div><h2 className="text-lg font-bold text-slate-800">Messaging Provider</h2><p className="mt-1 text-sm text-slate-500">Choose how the school sends SMS and WhatsApp messages. Only settings for the selected provider are shown.</p></div>
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">{providerCards.map((provider) => { const Icon = provider.icon; const active = selectedCode === provider.code; const configuration = configurations.find((item: any) => item.provider_code === provider.code); return <button key={provider.code} onClick={() => choose(provider.code)} className={`rounded-2xl border p-4 text-left transition ${active ? 'border-brand-300 bg-brand-50 shadow-panel' : 'border-slate-100 bg-white hover:border-brand-100'}`}><span className={`inline-flex rounded-xl p-2 ${active ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'}`}><Icon className="h-4 w-4" /></span><p className="mt-3 font-bold text-slate-800">{provider.title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{provider.description}</p>{configuration && <span className="mt-3 inline-block"><Badge value={configuration.connection_status}>{configuration.is_enabled ? configuration.connection_status : 'Disabled'}</Badge></span>}</button>; })}</div>
    {!isLoading && <ProviderForm key={`${selectedCode}-${selected?.id || 'new'}`} providerCode={selectedCode} configuration={selected?.provider_code === selectedCode ? selected : undefined} onSaved={(id) => setSelectedId(id)} />}
  </div>;
}

function ProviderForm({ providerCode, configuration, onSaved }: { providerCode: string; configuration?: any; onSaved: (id: number) => void }) {
  const { toast } = useToast();
  const [ports, setPorts] = useState<any[]>([]);
  const [modemInfo, setModemInfo] = useState<any>();
  const { register, handleSubmit, watch } = useForm<any>({ defaultValues: { name: configuration?.name || providerCards.find((item) => item.code === providerCode)?.title || 'Messaging Provider', is_enabled: configuration ? Boolean(configuration.is_enabled) : providerCode !== 'disabled', is_default: configuration ? Boolean(configuration.is_default) : true, ...(configuration?.config || {}) } });
  const values = watch();
  const save = useMutationToast((body: any) => schoolApi.messaging.saveConfiguration({ provider_code: providerCode, name: body.name, is_enabled: body.is_enabled, is_default: body.is_default, config: configFor(providerCode, body) }, configuration?.id), { success: 'Messaging provider configuration saved', sync: ['messaging'], onSuccess: (data: any) => onSaved(data.id) });
  const validate = useMutationToast((id: number) => schoolApi.messaging.validateConfiguration(id), { success: 'Connection validation completed', sync: ['messaging'] });
  const test = useMutationToast((body: any) => schoolApi.messaging.testConfiguration(configuration?.id, body), { success: 'Test message processed', sync: ['messaging'] });

  const refreshPorts = async () => { try { const rows = await schoolApi.messaging.modemPorts(); setPorts(rows); if (!rows.length) toast('info', 'No serial ports found', 'Connect a GSM modem and refresh again.'); } catch (error) { toast('error', 'Port detection failed', apiError(error)); } };
  const connectModem = async () => { try { const info = await schoolApi.messaging.modemConnect({ com_port: values.com_port, baud_rate: values.baud_rate || 115200 }); setModemInfo(info.info); toast('success', 'GSM modem connected'); } catch (error) { toast('error', 'Modem connection failed', apiError(error)); } };
  const disconnectModem = async () => { try { await schoolApi.messaging.modemDisconnect({ com_port: values.com_port }); setModemInfo(undefined); toast('success', 'GSM modem disconnected'); } catch (error) { toast('error', 'Modem disconnect failed', apiError(error)); } };
  const detectInfo = async () => { try { const info = await schoolApi.messaging.modemInfo({ com_port: values.com_port, baud_rate: values.baud_rate || 115200 }); setModemInfo(info); toast('success', 'Modem information refreshed'); } catch (error) { toast('error', 'Modem detection failed', apiError(error)); } };

  const isGsm = providerCode === 'gsm_modem';
  const isSms = providerCode === 'sms_gateway_api';
  const isAndroid = providerCode === 'android_sms_gateway';
  const isWhatsApp = providerCode === 'whatsapp_business_api';
  const isDisabled = providerCode === 'disabled';

  return <Card className="p-5"><form onSubmit={handleSubmit((body) => save.mutate(body))} className="space-y-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-base font-bold text-slate-800">{providerCards.find((item) => item.code === providerCode)?.title} Settings</h3><p className="mt-1 text-sm text-slate-500">Configuration is stored separately so multiple providers can be added without a schema change.</p></div>{configuration && <Badge value={configuration.connection_status} />}</div><div className="grid gap-4 md:grid-cols-3"><Field label="Configuration Name"><TextInput {...register('name', { required: true })} /></Field><Field label="Live Delivery"><SelectInput {...register('is_enabled')}><option value="true">Enabled</option><option value="false">Disabled / Queue Only</option></SelectInput></Field><Field label="Default Provider"><SelectInput {...register('is_default')}><option value="true">Use as default</option><option value="false">Do not use by default</option></SelectInput></Field></div>
    {isGsm && <GsmFields register={register} ports={ports} refreshPorts={refreshPorts} connect={connectModem} disconnect={disconnectModem} detect={detectInfo} info={modemInfo} />}
    {isSms && <SmsFields register={register} />}
    {isAndroid && <AndroidFields register={register} />}
    {isWhatsApp && <WhatsAppFields register={register} />}
    {isDisabled && <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Messages are recorded as queued but no provider sends them. Select another provider and enable delivery when ready.</div>}
    <div className="flex flex-wrap justify-end gap-2">{configuration && !isDisabled && <><Button type="button" variant="outline" loading={validate.isPending} icon={<ShieldCheck className="h-4 w-4" />} onClick={() => validate.mutate(configuration.id)}>{isSms ? 'Validate Connection' : isWhatsApp ? 'Verify Connection' : 'Refresh Connection'}</Button><TestMessageButton loading={test.isPending} onTest={(body) => test.mutate(body)} /></>}<Button type="submit" loading={save.isPending} icon={<Save className="h-4 w-4" />}>{isSms ? 'Save Gateway' : isWhatsApp ? 'Save WhatsApp API' : 'Save Provider'}</Button></div>
  </form></Card>;
}

function GsmFields({ register, ports, refreshPorts, connect, disconnect, detect, info }: any) { return <><div className="grid gap-4 md:grid-cols-3"><Field label="COM Port"><div className="flex gap-2"><SelectInput {...register('com_port')}><option value="">Select port</option>{ports.map((port: any) => <option key={port.path} value={port.path}>{port.path} {port.manufacturer ? `· ${port.manufacturer}` : ''}</option>)}</SelectInput><Button type="button" variant="outline" className="shrink-0 px-2" onClick={refreshPorts}><RefreshCw className="h-4 w-4" /></Button></div></Field><Field label="Baud Rate"><SelectInput {...register('baud_rate')}><option value="115200">115200</option><option value="9600">9600</option><option value="57600">57600</option></SelectInput></Field><Field label="SIM Number"><TextInput {...register('sim_number')} /></Field><Field label="Network Operator"><TextInput {...register('network_operator')} /></Field><Field label="Signal Strength"><TextInput readOnly value={info?.signal || ''} placeholder="Available after connection" /></Field><Field label="Connection Status"><TextInput readOnly value={info ? 'Connected' : 'Disconnected'} /></Field></div><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" icon={<Plug className="h-4 w-4" />} onClick={connect}>Connect</Button><Button type="button" variant="outline" onClick={disconnect}>Disconnect</Button><Button type="button" variant="outline" onClick={refreshPorts}>Refresh Ports</Button><Button type="button" variant="outline" onClick={detect}>Auto Detect Modem</Button></div>{info && <div className="grid gap-3 rounded-xl bg-slate-50 p-4 text-sm md:grid-cols-3">{[['Manufacturer', info.manufacturer], ['Model', info.model], ['IMEI', info.imei], ['SIM Status', info.sim_status], ['Network', info.network], ['Signal', info.signal]].map(([label, value]) => <div key={String(label)}><p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 font-semibold text-slate-700">{value || '—'}</p></div>)}</div>}</> }
function SmsFields({ register }: any) { return <div className="grid gap-4 md:grid-cols-2"><Field label="Provider Name"><TextInput {...register('provider_name')} /></Field><Field label="Sender ID"><TextInput {...register('sender_id')} /></Field><Field label="API URL"><TextInput type="url" {...register('api_url')} /></Field><Field label="API Key"><TextInput type="password" {...register('api_key')} /></Field></div>; }
function AndroidFields({ register }: any) { return <div className="grid gap-4 md:grid-cols-2"><Field label="Gateway URL"><TextInput type="url" {...register('gateway_url')} /></Field><Field label="API Key"><TextInput type="password" {...register('api_key')} /></Field><Field label="Connected Device"><TextInput {...register('device_name')} /></Field><Field label="SIM Number"><TextInput {...register('sim_number')} /></Field><Field label="Battery Status"><TextInput {...register('battery_status')} /></Field><Field label="Connection Status"><TextInput {...register('connection_status')} /></Field></div>; }
function WhatsAppFields({ register }: any) { return <div className="grid gap-4 md:grid-cols-2"><Field label="Business Phone Number"><TextInput {...register('business_phone_number')} /></Field><Field label="Phone Number ID"><TextInput {...register('phone_number_id')} /></Field><Field label="Access Token"><TextInput type="password" {...register('access_token')} /></Field><Field label="Permanent Access Token"><TextInput type="password" {...register('permanent_access_token')} /></Field><Field label="Webhook Verify Token"><TextInput type="password" {...register('webhook_verify_token')} /></Field><Field label="Business Account ID"><TextInput {...register('business_account_id')} /></Field></div>; }
function TestMessageButton({ loading, onTest }: { loading: boolean; onTest: (body: any) => void }) { const [recipient, setRecipient] = useState(''); return <div className="flex gap-2"><TextInput className="w-40" placeholder="Test phone" value={recipient} onChange={(event) => setRecipient(event.target.value)} /><Button type="button" variant="outline" disabled={!recipient.trim()} loading={loading} icon={<Send className="h-4 w-4" />} onClick={() => onTest({ recipient, message: 'Green Valley School messaging provider test.' })}>Test SMS</Button></div>; }
function MessageIcon({ className }: { className?: string }) { return <Activity className={className} />; }
function configFor(providerCode: string, values: Record<string, unknown>) { const ignored = ['name', 'is_enabled', 'is_default']; return Object.fromEntries(Object.entries(values).filter(([key]) => !ignored.includes(key) && values[key] !== undefined && values[key] !== '')); }
