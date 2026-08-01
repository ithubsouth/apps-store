// Entry point for the P2P share feature (scaffold)

import type { DiscoveryService, TransferService, ChecksumService } from './interfaces';

// Feature flag check should gate usage in application code.
export const FEATURE_P2P_SHARE = 'p2pShare';

export const createDiscoveryService = (): DiscoveryService => {
  // TODO: implement using Nearby Connections native bridge for Android.
  throw new Error('createDiscoveryService not implemented');
};

export const createTransferService = (): TransferService => {
  // TODO: implement transfer logic; for POC use Nearby Connections data bytes streaming.
  throw new Error('createTransferService not implemented');
};

export const createChecksumService = (): ChecksumService => {
  return {
    async computeSHA256(_filePath: string) {
      throw new Error('computeSHA256 not implemented');
    },
    async verifySHA256(_filePath: string, _expectedHash: string) {
      throw new Error('verifySHA256 not implemented');
    },
  };
};
