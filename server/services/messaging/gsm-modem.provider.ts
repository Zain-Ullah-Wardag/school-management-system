import fs from 'fs';
import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';
import { ApiError } from '../../utils/errors';
import type { MessagingProvider, ProviderConnectionInfo, ProviderSendRequest, ProviderSendResult } from './types';

type ModemSession = { port: SerialPort; parser: ReadlineParser; lines: string[]; connectedAt: string };

class GsmModemManager {
  private sessions = new Map<string, ModemSession>();

  async listPorts() {
    if (process.platform === 'linux' && !fs.existsSync('/usr/bin/udevadm') && !fs.existsSync('/bin/udevadm')) return [];
    try {
      const ports = await SerialPort.list();
      return ports.map((port) => ({ path: port.path, manufacturer: port.manufacturer || '', serial_number: port.serialNumber || '', vendor_id: port.vendorId || '', product_id: port.productId || '' }));
    } catch {
      // Linux containers and some restricted desktops may not expose udevadm.
      // Return an empty list so the UI remains usable and a real modem can still
      // be configured manually by entering/selecting a port on the target PC.
      return [];
    }
  }

  async connect(portPath: string, baudRate = 115200) {
    const existing = this.sessions.get(portPath);
    if (existing?.port.isOpen) return existing;
    const port = new SerialPort({ path: portPath, baudRate, autoOpen: false });
    const parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));
    const lines: string[] = [];
    parser.on('data', (line: string) => { lines.push(line.trim()); if (lines.length > 100) lines.shift(); });
    port.on('data', (buffer: Buffer) => { if (buffer.toString().includes('>')) { lines.push('>'); if (lines.length > 100) lines.shift(); } });
    await new Promise<void>((resolve, reject) => port.open((error) => error ? reject(error) : resolve()));
    const session = { port, parser, lines, connectedAt: new Date().toISOString() };
    this.sessions.set(portPath, session);
    await this.command(session, 'AT');
    return session;
  }

  async disconnect(portPath: string) {
    const session = this.sessions.get(portPath);
    if (!session) return;
    await new Promise<void>((resolve) => session.port.close(() => resolve()));
    this.sessions.delete(portPath);
  }

  async info(portPath: string, baudRate = 115200) {
    const session = await this.connect(portPath, baudRate);
    const ati = await this.command(session, 'ATI');
    const imei = await this.command(session, 'AT+CGSN');
    const sim = await this.command(session, 'AT+CPIN?');
    const network = await this.command(session, 'AT+COPS?');
    const signal = await this.command(session, 'AT+CSQ');
    return {
      manufacturer: ati.find((line) => line && line !== 'OK') || '',
      model: ati.filter((line) => line && line !== 'OK').slice(1).join(' ') || '',
      imei: imei.find((line) => /^\d{10,}$/.test(line)) || '',
      sim_status: sim.find((line) => line.includes('+CPIN')) || '',
      network: network.find((line) => line.includes('+COPS')) || '',
      signal: signal.find((line) => line.includes('+CSQ')) || '',
      connected_at: session.connectedAt
    };
  }

  async send(portPath: string, baudRate: number, recipient: string, message: string): Promise<ProviderSendResult> {
    try {
      const session = await this.connect(portPath, baudRate);
      await this.command(session, 'AT+CMGF=1');
      await this.command(session, `AT+CMGS="${recipient}"`, '>', 8_000);
      const lines = await this.command(session, `${message}\x1A`, 'OK', 25_000);
      return { status: lines.some((line) => /^\+CMGS:/.test(line)) || lines.includes('OK') ? 'sent' : 'failed', providerResponse: lines.join('\n') };
    } catch (error) {
      return { status: 'failed', errorMessage: error instanceof Error ? error.message : 'GSM modem delivery failed' };
    }
  }

  private command(session: ModemSession, command: string, expected = 'OK', timeout = 6_000) {
    const start = session.lines.length;
    return new Promise<string[]>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Modem command timeout: ${command.replace(/\x1A/g, '[CTRL+Z]')}`)), timeout);
      const check = () => {
        const received = session.lines.slice(start);
        if (received.some((line) => line.includes('ERROR'))) { clearTimeout(timer); reject(new Error(received.join('\n'))); return; }
        if (received.some((line) => line.includes(expected))) { clearTimeout(timer); resolve(received); return; }
        setTimeout(check, 80);
      };
      session.port.write(`${command}\r`, (error) => { if (error) { clearTimeout(timer); reject(error); return; } check(); });
    });
  }
}

const manager = new GsmModemManager();

export class GsmModemProvider implements MessagingProvider {
  readonly type = 'gsm_modem' as const;
  ports() { return manager.listPorts(); }
  async connect(config: Record<string, unknown>) { const port = String(config.com_port || ''); if (!port) throw new ApiError(422, 'Select a COM port'); const info = await manager.info(port, Number(config.baud_rate) || 115200); return { status: 'connected' as const, info }; }
  info(config: Record<string, unknown>) { const port = String(config.com_port || ''); if (!port) throw new ApiError(422, 'Select a COM port'); return manager.info(port, Number(config.baud_rate) || 115200); }
  disconnect(config: Record<string, unknown>) { return manager.disconnect(String(config.com_port || '')); }
  async validate(config: Record<string, unknown>): Promise<ProviderConnectionInfo> {
    try { const connection = await this.connect(config); return connection; } catch (error) { return { status: 'error', error: error instanceof Error ? error.message : 'Modem connection failed' }; }
  }
  send(config: Record<string, unknown>, request: ProviderSendRequest): Promise<ProviderSendResult> { return manager.send(String(config.com_port || ''), Number(config.baud_rate) || 115200, request.recipient, request.message); }
  test(config: Record<string, unknown>, recipient: string, message: string) { return this.send(config, { recipient, message, channel: 'sms' }); }
}
