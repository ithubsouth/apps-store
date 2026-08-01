import type { DiscoveryService, TransferService, ChecksumService, DiscoveryResult, TransferProgress } from './interfaces';

let _foundCb: ((d: DiscoveryResult) => void) | null = null;
let _lostCb: ((id: string) => void) | null = null;

export const FEATURE_P2P_SHARE = 'p2pShare';

// A tiny in-memory mock discovery service to simulate devices for the demo.
export const createDiscoveryService = (): DiscoveryService => {
  let advertising = false;
  let discovering = false;
  let fakeDeviceTimer: any = null;
  const fakeDevice: DiscoveryResult = { id: 'mock-device-1', name: 'Receiver-Device-1', payload: { type: 'android' } };

  return {
    async startAdvertising(_name?: string) {
      advertising = true;
      // no-op for mock
      return;
    },
    async stopAdvertising() {
      advertising = false;
      return;
    },
    async startDiscovery() {
      discovering = true;
      // simulate a discovered device after 1s
      fakeDeviceTimer = setTimeout(() => {
        if (discovering && _foundCb) _foundCb(fakeDevice);
      }, 1000);
    },
    async stopDiscovery() {
      discovering = false;
      if (fakeDeviceTimer) clearTimeout(fakeDeviceTimer);
    },
    onFound(cb: (device: DiscoveryResult) => void) {
      _foundCb = cb;
    },
    onLost(cb: (id: string) => void) {
      _lostCb = cb;
    },
    async connect(_deviceId: string) {
      // immediate success in mock
      return;
    },
    async disconnect(_deviceId: string) {
      // immediate success
      return;
    },
  };
};

// Mock transfer service that fakes progress for a file.
export const createTransferService = (): TransferService => {
  return {
    async *sendFile(_deviceId: string, _filePath: string) {
      // In the demo the UI passes file.name; treat that as a small file
      const total = 5_000_000; // pretend 5 MB
      let sent = 0;
      const chunk = 256_000; // 256KB per step
      while (sent < total) {
        await new Promise((r) => setTimeout(r, 300)); // wait 300ms between chunks
        sent = Math.min(total, sent + chunk);
        yield { bytesTransferred: sent, totalBytes: total } as TransferProgress;
      }
    },
    async *receiveFile(_deviceId: string, _destinationPath: string) {
      // mirror the same behavior for receiver
      const total = 5_000_000;
      let got = 0;
      const chunk = 256_000;
      while (got < total) {
        await new Promise((r) => setTimeout(r, 300));
        got = Math.min(total, got + chunk);
        yield { bytesTransferred: got, totalBytes: total } as TransferProgress;
      }
    },
    async resumeTransfer(_transferId: string) {
      // no-op for mock
    },
    async cancelTransfer(_transferId: string) {
      // no-op
    },
  };
};

export const createChecksumService = (): ChecksumService => {
  return {
    async computeSHA256(_filePath: string) {
      // return fixed mock hash for demo
      return 'MOCK_SHA256_HASH_0000000000000000000000000000000000000000000000000000000000';
    },
    async verifySHA256(_filePath: string, _expectedHash: string) {
      // always pass in mock
      return true;
    },
  };
};
