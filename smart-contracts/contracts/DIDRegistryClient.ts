import { Algodv2, Account, getApplicationAddress } from 'algosdk';
import { DIDRegistry } from './DIDRegistry';

export interface DIDRegistryConfig {
  registrationFee: number;
  updateFee: number;
  nexdenAssetId: number;
}

export interface DIDDocument {
  '@context': string[];
  id: string;
  controller: string;
  verificationMethod: VerificationMethod[];
  service: Service[];
  created: string;
  updated: string;
  version: number;
}

export interface VerificationMethod {
  id: string;
  type: string;
  controller: string;
  publicKeyBase58?: string;
  publicKeyMultibase?: string;
}

export interface Service {
  id: string;
  type: string;
  serviceEndpoint: string;
}

export interface DIDMetadata {
  controller: string;
  version: number;
  status: number; // 0: Active, 1: Deactivated, 2: Revoked
  created: number;
  updated: number;
}

export class DIDRegistryClient {
  private algodClient: Algodv2;
  private contract: DIDRegistry;
  private appId?: number;
  private appAddress?: string;

  constructor(algodClient: Algodv2, appId?: number) {
    this.algodClient = algodClient;
    this.contract = new DIDRegistry();
    
    if (appId) {
      this.appId = appId;
      this.appAddress = getApplicationAddress(appId);
    }
  }

  /**
   * Deploy the DID Registry contract
   */
  async deploy(
    creator: Account,
    config: DIDRegistryConfig
  ): Promise<{ appId: number; appAddress: string }> {
    try {
      const result = await this.contract.create({
        sender: creator,
        args: [
          config.registrationFee,
          config.updateFee,
          config.nexdenAssetId,
        ],
      });

      this.appId = result.appId;
      this.appAddress = result.appAddress;

      console.log(`DID Registry deployed with App ID: ${this.appId}`);
      console.log(`App Address: ${this.appAddress}`);

      return { appId: this.appId, appAddress: this.appAddress };
    } catch (error) {
      console.error('Error deploying DID registry:', error);
      throw error;
    }
  }

  /**
   * Register a new DID
   */
  async registerDID(
    user: Account,
    didIdentifier: string,
    didDocument: DIDDocument,
    nexdenAssetId: number,
    registrationFee: number
  ): Promise<string> {
    if (!this.appId || !this.appAddress) throw new Error('Contract not deployed');

    try {
      const suggestedParams = await this.algodClient.getTransactionParams().do();

      // Create payment transaction for registration fee
      const paymentTxn = {
        from: user.addr,
        to: this.appAddress,
        amount: registrationFee,
        assetIndex: nexdenAssetId,
        suggestedParams,
      };

      const result = await this.contract.registerDID({
        sender: user,
        appId: this.appId,
        args: [didIdentifier, JSON.stringify(didDocument), paymentTxn],
      });

      console.log(`Registered DID: did:algo:${didIdentifier}`);
      return result.txId;
    } catch (error) {
      console.error('Error registering DID:', error);
      throw error;
    }
  }

  /**
   * Update an existing DID document
   */
  async updateDID(
    user: Account,
    didIdentifier: string,
    didDocument: DIDDocument,
    nexdenAssetId: number,
    updateFee: number
  ): Promise<string> {
    if (!this.appId || !this.appAddress) throw new Error('Contract not deployed');

    try {
      const suggestedParams = await this.algodClient.getTransactionParams().do();

      const paymentTxn = {
        from: user.addr,
        to: this.appAddress,
        amount: updateFee,
        assetIndex: nexdenAssetId,
        suggestedParams,
      };

      const result = await this.contract.updateDID({
        sender: user,
        appId: this.appId,
        args: [didIdentifier, JSON.stringify(didDocument), paymentTxn],
      });

      console.log(`Updated DID: did:algo:${didIdentifier}`);
      return result.txId;
    } catch (error) {
      console.error('Error updating DID:', error);
      throw error;
    }
  }

  /**
   * Deactivate a DID
   */
  async deactivateDID(user: Account, didIdentifier: string): Promise<string> {
    if (!this.appId) throw new Error('Contract not deployed');

    try {
      const result = await this.contract.deactivateDID({
        sender: user,
        appId: this.appId,
        args: [didIdentifier],
      });

      console.log(`Deactivated DID: did:algo:${didIdentifier}`);
      return result.txId;
    } catch (error) {
      console.error('Error deactivating DID:', error);
      throw error;
    }
  }

  /**
   * Reactivate a DID
   */
  async reactivateDID(
    user: Account,
    didIdentifier: string,
    nexdenAssetId: number,
    updateFee: number
  ): Promise<string> {
    if (!this.appId || !this.appAddress) throw new Error('Contract not deployed');

    try {
      const suggestedParams = await this.algodClient.getTransactionParams().do();

      const paymentTxn = {
        from: user.addr,
        to: this.appAddress,
        amount: updateFee,
        assetIndex: nexdenAssetId,
        suggestedParams,
      };

      const result = await this.contract.reactivateDID({
        sender: user,
        appId: this.appId,
        args: [didIdentifier, paymentTxn],
      });

      console.log(`Reactivated DID: did:algo:${didIdentifier}`);
      return result.txId;
    } catch (error) {
      console.error('Error reactivating DID:', error);
      throw error;
    }
  }

  /**
   * Transfer DID control to another address
   */
  async transferDIDControl(
    user: Account,
    didIdentifier: string,
    newController: string,
    nexdenAssetId: number,
    updateFee: number
  ): Promise<string> {
    if (!this.appId || !this.appAddress) throw new Error('Contract not deployed');

    try {
      const suggestedParams = await this.algodClient.getTransactionParams().do();

      const paymentTxn = {
        from: user.addr,
        to: this.appAddress,
        amount: updateFee,
        assetIndex: nexdenAssetId,
        suggestedParams,
      };

      const result = await this.contract.transferDIDControl({
        sender: user,
        appId: this.appId,
        args: [didIdentifier, newController, paymentTxn],
      });

      console.log(`Transferred control of DID: did:algo:${didIdentifier} to ${newController}`);
      return result.txId;
    } catch (error) {
      console.error('Error transferring DID control:', error);
      throw error;
    }
  }

  /**
   * Add verification method to DID
   */
  async addVerificationMethod(
    user: Account,
    didIdentifier: string,
    methodId: string,
    methodType: string,
    publicKey: string,
    nexdenAssetId: number,
    updateFee: number
  ): Promise<string> {
    if (!this.appId || !this.appAddress) throw new Error('Contract not deployed');

    try {
      const suggestedParams = await this.algodClient.getTransactionParams().do();

      const paymentTxn = {
        from: user.addr,
        to: this.appAddress,
        amount: updateFee,
        assetIndex: nexdenAssetId,
        suggestedParams,
      };

      const result = await this.contract.addVerificationMethod({
        sender: user,
        appId: this.appId,
        args: [didIdentifier, methodId, methodType, publicKey, paymentTxn],
      });

      console.log(`Added verification method ${methodId} to DID: did:algo:${didIdentifier}`);
      return result.txId;
    } catch (error) {
      console.error('Error adding verification method:', error);
      throw error;
    }
  }

  /**
   * Add service endpoint to DID
   */
  async addServiceEndpoint(
    user: Account,
    didIdentifier: string,
    serviceId: string,
    serviceType: string,
    endpoint: string,
    nexdenAssetId: number,
    updateFee: number
  ): Promise<string> {
    if (!this.appId || !this.appAddress) throw new Error('Contract not deployed');

    try {
      const suggestedParams = await this.algodClient.getTransactionParams().do();

      const paymentTxn = {
        from: user.addr,
        to: this.appAddress,
        amount: updateFee,
        assetIndex: nexdenAssetId,
        suggestedParams,
      };

      const result = await this.contract.addServiceEndpoint({
        sender: user,
        appId: this.appId,
        args: [didIdentifier, serviceId, serviceType, endpoint, paymentTxn],
      });

      console.log(`Added service endpoint ${serviceId} to DID: did:algo:${didIdentifier}`);
      return result.txId;
    } catch (error) {
      console.error('Error adding service endpoint:', error);
      throw error;
    }
  }

  /**
   * Resolve DID document
   */
  async resolveDID(didIdentifier: string): Promise<DIDDocument> {
    if (!this.appId) throw new Error('Contract not deployed');

    try {
      const result = await this.contract.resolveDID({
        appId: this.appId,
        args: [didIdentifier],
      });

      const didDocument = JSON.parse(result.return) as DIDDocument;
      return didDocument;
    } catch (error) {
      console.error('Error resolving DID:', error);
      throw error;
    }
  }

  /**
   * Get DID metadata
   */
  async getDIDMetadata(didIdentifier: string): Promise<DIDMetadata> {
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
   * Get verification method
   */
  async getVerificationMethod(didIdentifier: string, methodId: string): Promise<VerificationMethod> {
    if (!this.appId) throw new Error('Contract not deployed');

    try {
      const result = await this.contract.getVerificationMethod({
        appId: this.appId,
        args: [didIdentifier, methodId],
      });

      const methodParts = result.return.split('|');
      return {
        id: `did:algo:${didIdentifier}#${methodId}`,
        type: methodParts[0],
        controller: `did:algo:${didIdentifier}`,
        publicKeyBase58: methodParts[1],
      };
    } catch (error) {
      console.error('Error getting verification method:', error);
      throw error;
    }
  }

  /**
   * Get service endpoint
   */
  async getServiceEndpoint(didIdentifier: string, serviceId: string): Promise<Service> {
    if (!this.appId) throw new Error('Contract not deployed');

    try {
      const result = await this.contract.getServiceEndpoint({
        appId: this.appId,
        args: [didIdentifier, serviceId],
      });

      const serviceParts = result.return.split('|');
      return {
        id: `did:algo:${didIdentifier}#${serviceId}`,
        type: serviceParts[0],
        serviceEndpoint: serviceParts[1],
      };
    } catch (error) {
      console.error('Error getting service endpoint:', error);
      throw error;
    }
  }

  /**
   * Get DIDs controlled by an address
   */
  async getControllerDIDs(controllerAddress: string): Promise<string[]> {
    if (!this.appId) throw new Error('Contract not deployed');

    try {
      const result = await this.contract.getControllerDIDs({
        appId: this.appId,
        args: [controllerAddress],
      });

      if (result.return) {
        return result.return.split(',');
      }
      return [];
    } catch (error) {
      console.error('Error getting controller DIDs:', error);
      throw error;
    }
  }

  /**
   * Get registry statistics
   */
  async getRegistryStats(): Promise<{
    totalDIDs: number;
    registrationFee: number;
    updateFee: number;
    isPaused: boolean;
  }> {
    if (!this.appId) throw new Error('Contract not deployed');

    try {
      const result = await this.contract.getRegistryStats({
        appId: this.appId,
      });

      const statsParts = result.return.split('|');
      return {
        totalDIDs: parseInt(statsParts[0]),
        registrationFee: parseInt(statsParts[1]),
        updateFee: parseInt(statsParts[2]),
        isPaused: statsParts[3] === '1',
      };
    } catch (error) {
      console.error('Error getting registry stats:', error);
      throw error;
    }
  }

  /**
   * Create a standard DID document
   */
  createDIDDocument(
    didIdentifier: string,
    controller: string,
    verificationMethods: VerificationMethod[] = [],
    services: Service[] = []
  ): DIDDocument {
    const fullDID = `did:algo:${didIdentifier}`;
    const now = new Date().toISOString();

    return {
      '@context': [
        'https://www.w3.org/ns/did/v1',
        'https://w3id.org/security/suites/ed25519-2020/v1'
      ],
      id: fullDID,
      controller: controller,
      verificationMethod: verificationMethods.map(vm => ({
        ...vm,
        id: vm.id.startsWith('did:') ? vm.id : `${fullDID}#${vm.id}`,
        controller: vm.controller || fullDID,
      })),
      service: services.map(service => ({
        ...service,
        id: service.id.startsWith('did:') ? service.id : `${fullDID}#${service.id}`,
      })),
      created: now,
      updated: now,
      version: 1,
    };
  }

  /**
   * Validate DID identifier format
   */
  validateDIDIdentifier(didIdentifier: string): boolean {
    // Basic validation for Algorand DID format
    const didRegex = /^[a-zA-Z0-9_-]+$/;
    return didRegex.test(didIdentifier) && didIdentifier.length >= 3 && didIdentifier.length <= 64;
  }

  // Admin functions

  /**
   * Update registry fees (admin only)
   */
  async updateFees(
    admin: Account,
    newRegistrationFee: number,
    newUpdateFee: number
  ): Promise<string> {
    if (!this.appId) throw new Error('Contract not deployed');

    try {
      const result = await this.contract.updateFees({
        sender: admin,
        appId: this.appId,
        args: [newRegistrationFee, newUpdateFee],
      });

      console.log('Updated registry fees');
      return result.txId;
    } catch (error) {
      console.error('Error updating fees:', error);
      throw error;
    }
  }

  /**
   * Pause registry (admin only)
   */
  async pauseRegistry(admin: Account): Promise<string> {
    if (!this.appId) throw new Error('Contract not deployed');

    try {
      const result = await this.contract.pauseRegistry({
        sender: admin,
        appId: this.appId,
      });

      console.log('Registry paused');
      return result.txId;
    } catch (error) {
      console.error('Error pausing registry:', error);
      throw error;
    }
  }

  /**
   * Resume registry (admin only)
   */
  async resumeRegistry(admin: Account): Promise<string> {
    if (!this.appId) throw new Error('Contract not deployed');

    try {
      const result = await this.contract.resumeRegistry({
        sender: admin,
        appId: this.appId,
      });

      console.log('Registry resumed');
      return result.txId;
    } catch (error) {
      console.error('Error resuming registry:', error);
      throw error;
    }
  }

  // Getters
  get applicationId(): number | undefined {
    return this.appId;
  }

  get applicationAddress(): string | undefined {
    return this.appAddress;
  }
}