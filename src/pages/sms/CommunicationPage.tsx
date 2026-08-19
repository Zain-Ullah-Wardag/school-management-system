import { useState } from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { Tabs } from '../../components/common/Tabs';
import { Card } from '../../components/common/Card';
import { MessagingProviderPanel } from '../../components/forms/MessagingProviderPanel';
import { MessagingSendPanel } from '../../components/forms/MessagingSendPanel';
import { MessagingTemplatesPanel } from '../../components/forms/MessagingTemplatesPanel';
import { MessagingLogPanel } from '../../components/forms/MessagingLogPanel';

type Tab = 'send' | 'providers' | 'templates' | 'logs';

export default function CommunicationPage() {
  const [tab, setTab] = useState<Tab>('send');
  return <>
    <PageHeader title="SMS & WhatsApp" description="Configure commercial-grade delivery providers, create reusable templates, send messages, and monitor provider delivery logs." />
    <Tabs tabs={[{ id: 'send', label: 'Send Message' }, { id: 'providers', label: 'Messaging Providers' }, { id: 'templates', label: 'Message Templates' }, { id: 'logs', label: 'Delivery Log' }]} value={tab} onChange={setTab} />
    <Card className="p-5">{tab === 'send' && <MessagingSendPanel />}{tab === 'providers' && <MessagingProviderPanel />}{tab === 'templates' && <MessagingTemplatesPanel />}{tab === 'logs' && <MessagingLogPanel />}</Card>
  </>;
}
