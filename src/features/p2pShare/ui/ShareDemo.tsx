import React, { useEffect, useState } from 'react';
import type { DiscoveryResult } from '../interfaces';
import {
  FEATURE_P2P_SHARE,
  createDiscoveryService,
  createTransferService,
  createChecksumService,
} from '../index';

// Simple demo UI to exercise P2P share flows. This is a scaffold and uses the
// service factories exported from src/features/p2pShare/index.ts which are not
// yet implemented. Replace those with the native bridge implementation.

export const ShareDemo: React.FC = () => {
  const [devices, setDevices] = useState<DiscoveryResult[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [discovering, setDiscovering] = useState(false);
  const [advertising, setAdvertising] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);

  const appendLog = (line: string) => setLog((l) => [...l, `${new Date().toLocaleTimeString()} - ${line}`]);

  useEffect(() => {
    // No-op: real implementation should register native callbacks
    appendLog('ShareDemo mounted (scaffold)');
    return () => appendLog('ShareDemo unmounted');
  }, []);

  const handleStartDiscovery = async () => {
    appendLog('startDiscovery clicked');
    setDiscovering(true);
    try {
      const ds = createDiscoveryService();
      ds.onFound((d) => {
        appendLog(`found device ${d.id} (${d.name ?? 'unknown'})`);
        setDevices((prev) => {
          if (prev.find((p) => p.id === d.id)) return prev;
          return [...prev, d];
        });
      });
      ds.onLost((id) => {
        appendLog(`lost device ${id}`);
        setDevices((prev) => prev.filter((p) => p.id !== id));
      });
      await ds.startDiscovery();
      appendLog('discovery started (note: underlying service not implemented)');
    } catch (err: any) {
      appendLog(`discovery error: ${err?.message ?? String(err)}`);
      setDiscovering(false);
    }
  };

  const handleStopDiscovery = async () => {
    appendLog('stopDiscovery clicked');
    try {
      const ds = createDiscoveryService();
      await ds.stopDiscovery();
      appendLog('discovery stopped');
      setDiscovering(false);
    } catch (err: any) {
      appendLog(`stop discovery error: ${err?.message ?? String(err)}`);
    }
  };

  const handleStartAdvertising = async () => {
    appendLog('startAdvertising clicked');
    setAdvertising(true);
    try {
      const ds = createDiscoveryService();
      await ds.startAdvertising('AppsStore P2P Demo');
      appendLog('advertising started (note: underlying service not implemented)');
    } catch (err: any) {
      appendLog(`advertise error: ${err?.message ?? String(err)}`);
      setAdvertising(false);
    }
  };

  const handleStopAdvertising = async () => {
    appendLog('stopAdvertising clicked');
    try {
      const ds = createDiscoveryService();
      await ds.stopAdvertising();
      appendLog('advertising stopped');
      setAdvertising(false);
    } catch (err: any) {
      appendLog(`stop advertise error: ${err?.message ?? String(err)}`);
    }
  };

  const handleConnect = async (deviceId: string) => {
    appendLog(`connect to ${deviceId}`);
    setSelectedDevice(deviceId);
    try {
      const ds = createDiscoveryService();
      await ds.connect(deviceId);
      appendLog(`connected to ${deviceId}`);
    } catch (err: any) {
      appendLog(`connect error: ${err?.message ?? String(err)}`);
    }
  };

  const handleSendFile = async (ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    if (!selectedDevice) {
      appendLog('no device selected');
      return;
    }
    appendLog(`sendFile ${file.name} to ${selectedDevice}`);
    try {
      const ts = createTransferService();
      for await (const progress of ts.sendFile(selectedDevice, file.name)) {
        appendLog(`progress ${progress.bytesTransferred}/${progress.totalBytes}`);
      }
      appendLog('send finished (underlying implementation required)');
    } catch (err: any) {
      appendLog(`send error: ${err?.message ?? String(err)}`);
    }
  };

  return (
    <div style={{ padding: 12 }}>
      <h3>P2P Share — Demo (scaffold)</h3>
      <p>Feature flag: {FEATURE_P2P_SHARE}</p>

      <div style={{ marginBottom: 8 }}>
        <button onClick={handleStartDiscovery} disabled={discovering} style={{ marginRight: 8 }}>
          Start Discovery
        </button>
        <button onClick={handleStopDiscovery} disabled={!discovering} style={{ marginRight: 8 }}>
          Stop Discovery
        </button>

        <button onClick={handleStartAdvertising} disabled={advertising} style={{ marginRight: 8 }}>
          Start Advertising
        </button>
        <button onClick={handleStopAdvertising} disabled={!advertising}>
          Stop Advertising
        </button>
      </div>

      <div style={{ marginBottom: 8 }}>
        <strong>Discovered devices</strong>
        <ul>
          {devices.map((d) => (
            <li key={d.id}>
              <button onClick={() => handleConnect(d.id)} style={{ marginRight: 8 }}>
                Connect
              </button>
              {d.name ?? d.id}
            </li>
          ))}
        </ul>
      </div>

      <div style={{ marginBottom: 8 }}>
        <strong>Selected device:</strong> {selectedDevice ?? 'none'}
        <div>
          <input type="file" onChange={handleSendFile} />
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <strong>Log</strong>
        <div style={{ whiteSpace: 'pre-wrap', background: '#f6f6f6', padding: 8, minHeight: 120 }}>
          {log.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ShareDemo;
