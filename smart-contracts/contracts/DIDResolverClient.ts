import { Algodv2, Account, getApplicationAddress } from 'algosdk';
import { DIDResolver } from './DIDResolver';

export interface DIDResolverConfig {
  registryAppId: number;
}

export interface DIDResolutionResult {
  didDocument: any;
  didDocumentMetadata: any;
  didResolutionMetadata: any;
}

export class DIDResolverClient {
  private algodClient: Algodv2;
  private contract: DIDResolver;
  private appId?: number;
  private appAddress?: string;

  constructor(algodClient: Algodv2, appId?: number) {
    this.algodClient = algodClient;
    this.contract = new DIDResolver();
    
    if (appId) {
      this.appId = appId;
      this.appAddress = getApplicationAddress(appId);
    }
  }

  /**
   * Deploy the DID Resolver contract
   */
  async deploy(
    creator: Account,
    config: DIDResolverConfig
  ): Promise<{ appId: number; appAddress: string }> {
    try {
      const result = await this.contract.create({
        sender: creator,
        args: [config.registryAppId],
      });

      this.appId = result.appId;
      this.appAddress = result.appAddress;

      console.log(`DID Resolver deployed with App ID: ${this.appId}`);
      console.log(`App Address: ${this.appAddress}`);

      return { appId: this.appId, appAddress: this.appAddress };
    } catch (error) {
      console.error('Error deploying DID resolver:', error);
      throw error;
    }
  }

  /**
   * Resolve a DID to its DID Document
   */
  async resolveDID(didIdentifier: string): Promise<DIDResolutionResult> {
    if (!this.appId) throw new Error('Contract not deployed');

    try {
      const result = await this.contract.resolveDID({
        appId: this.appId,
        args: [didIdentifier],
      });

      return {
        didDocument: JSON.parse(result.return.didDocument),
        didDocumentMetadata: JSON.parse(result.return.didDocumentMetadata),
        didResolutionMetadata: JSON.parse(result.return.didResolutionMetadata),
      };
    } catch (error) {
      console.error('Error resolving DID:', error);
      throw error;
    }
  }

  /**
   * Resolve a DID URL (with fragment)
   */
  async resolveDIDURL(didUrl: string): Promise<DIDResolutionResult> {
    if (!this.appId) throw new Error('Contract not deployed');

    try {
      const result = await this.contract.resolveDIDURL({
        appId: this.appId,
        args: [didUrl],
      });

      return {
        didDocument: JSON.parse(result.return.didDocument),
        didDocumentMetadata: JSON.parse(result.return.didDocumentMetadata),
        didResolutionMetadata: JSON.parse(result.return.didResolutionMetadata),
      };
    } catch (error) {
      console.error('Error resolving DID URL:', error);
      throw error;
    }
  }

  /**
   * Batch resolve multiple DIDs
   */
  async batchResolveDIDs(didIdentifiers: string[]): Promise<any[]> {
    if (!this.appId) throw new Error('Contract not deployed');

    try {
      const result = await this.contract.batchResolveDIDs({
        appId: this.appId,
        args: [didIdentifiers],
      });

      // Parse the batch result
      const documents = result.return.split('|').filter(doc => doc.length > 0);
      return documents.map(doc => JSON.parse(doc));
    } catch (error) {
      console.error('Error batch resolving DIDs:', error);
      throw error;
    }
  }

  /**
   * Get DID metadata only
   */
  async getDIDMetadata(didIdentifier: string): Promise<any> {
    if (!this.appId) throw new Error('Contract not deployed');

    try {
      const result = await this.contract.getDIDMetadata({
        appId: this.appId,
        args: [didIdentifier],
      });

      const metadataParts = result.return.split('|');
      return {
        controller: metadataParts[0],
        version: parseInt(metadataParts[1]),
        status: parseInt(metadataParts[2]),
        created: parseInt(metadataParts[3]),
        updated: parseInt(metadataParts[4]),
      };
    } catch (error) {
      console.error('Error getting DID metadata:', error);
      throw error;
    }
  }

  /**
   * Verify DID signature
   */
  async verifyDIDSignature(
    didIdentifier: string,
    signature: Uint8Array,
    message: Uint8Array,
    verificationMethodId: string
  ): Promise<boolean> {
    if (!this.appId) throw new Error('Contract not deployed');

    try {
      const result = await this.contract.verifyDIDSignature({
        appId: this.appId,
        args: [didIdentifier, signature, message, verificationMethodId],
      });

      return result.return === 1;
    } catch (error) {
      console.error('Error verifying DID signature:', error);
      throw error;
    }
  }

  /**
   * Check if DID is active
   */
  async isDIDActive(didIdentifier: string): Promise<boolean> {
    if (!this.appId) throw new Error('Contract not deployed');

    try {
      const result = await this.contract.isDIDActive({
        appId: this.appId,
        args: [didIdentifier],
      });

      return result.return === 1;
    } catch (error) {
      console.error('Error checking DID status:', error);
      throw error;
    }
  }

  /**
   * Get DID controller
   */
  async getDIDController(didIdentifier: string): Promise<string> {
    if (!this.appId) throw new Error('Contract not deployed');

    try {
      const result = await this.contract.getDIDController({
        appId: this.appId,
        args: [didIdentifier],
      });

      return result.return;
    } catch (error) {
      console.error('Error getting DID controller:', error);
      throw error;
    }
  }

  /**
   * Clear cache for a specific DID (admin only)
   */
  async clearDIDCache(admin: Account, didIdentifier: string): Promise<string> {
    if (!this.appId) throw new Error('Contract not deployed');

    try {
      const result = await this.contract.clearDIDCache({
        sender: admin,
        appId: this.appId,
        args: [didIdentifier],
      });

      console.log(`Cleared cache for DID: ${didIdentifier}`);
      return result.txId;
    } catch (error) {
      console.error('Error clearing DID cache:', error);
      throw error;
    }
  }

  /**
   * Update cache settings (admin only)
   */
  async updateCacheSettings(
    admin: Account,
    enabled: boolean,
    timeout: number
  ): Promise<string> {
    if (!this.appId) throw new Error('Contract not deployed');

    try {
      const result = await this.contract.updateCacheSettings({
        sender: admin,
        appId: this.appId,
        args: [enabled, timeout],
      });

      console.log('Updated cache settings');
      return result.txId;
    } catch (error) {
      console.error('Error updating cache settings:', error);
      throw error;
    }
  }

  /**
   * Get resolver configuration
   */
  async getResolverConfig(): Promise<{
    registryAppId: number;
    isActive: boolean;
    cacheEnabled: boolean;
    cacheTimeout: number;
  }> {
    if (!this.appId) throw new Error('Contract not deployed');

    try {
      const result = await this.contract.getResolverConfig({
        appId: this.appId,
      });

      const configParts = result.return.split('|');
      return {
        registryAppId: parseInt(configParts[0]),
        isActive: configParts[1] === '1',
        cacheEnabled: configParts[2] === '1',
        cacheTimeout: parseInt(configParts[3]),
      };
    } catch (error) {
      console.error('Error getting resolver config:', error);
      throw error;
    }
  }

  /**
   * Utility: Parse DID URL
   */
  parseDIDURL(didUrl: string): {
    did: string;
    path?: string;
    query?: string;
    fragment?: string;
  } {
    const url = new URL(didUrl.replace('did:', 'https://'));
    
    return {
      did: didUrl.split('#')[0].split('?')[0],
      path: url.pathname !== '/' ? url.pathname : undefined,
      query: url.search ? url.search.substring(1) : undefined,
      fragment: url.hash ? url.hash.substring(1) : undefined,
    };
  }

  /**
   * Utility: Validate DID format
   */
  validateDIDFormat(did: string): boolean {
    const didRegex = /^did:algo:[a-zA-Z0-9_-]+$/;
    return didRegex.test(did);
  }

  /**
   * Utility: Extract DID identifier from full DID
   */
  extractDIDIdentifier(fullDID: string): string {
    if (fullDID.startsWith('did:algo:')) {
      return fullDID.substring(9);
    }
    return fullDID;
  }

  // Getters
  get applicationId(): number | undefined {
    return this.appId;
  }

  get applicationAddress(): string | undefined {
    return this.appAddress;
  }
}