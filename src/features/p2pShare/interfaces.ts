// Service interfaces for P2P sharing (POC scaffold)

export interface DiscoveryResult {
  id: string; // unique device id
  name?: string;
  payload?: any; // metadata like device type
}

export interface DiscoveryService {
  startAdvertising(name?: string): Promise<void>;
  stopAdvertising(): Promise<void>;
  startDiscovery(): Promise<void>;
  stopDiscovery(): Promise<void>;
  onFound(callback: (device: DiscoveryResult) => void): void;
  onLost(callback: (deviceId: string) => void): void;
  connect(deviceId: string): Promise<void>;
  disconnect(deviceId: string): Promise<void>;
}

export interface TransferProgress {
  bytesTransferred: number;
  totalBytes: number;
}

export interface TransferService {
  sendFile(deviceId: string, filePath: string): AsyncIterable<TransferProgress>;
  receiveFile(deviceId: string, destinationPath: string): AsyncIterable<TransferProgress>;
  resumeTransfer?(transferId: string): Promise<void>;
  cancelTransfer?(transferId: string): Promise<void>;
}

export interface ChecksumService {
  computeSHA256(filePath: string): Promise<string>;
  verifySHA256(filePath: string, expectedHash: string): Promise<boolean>;
}
