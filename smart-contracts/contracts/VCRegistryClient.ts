import { Algodv2, Account, getApplicationAddress } from 'algosdk';
import { VCRegistry } from './VCRegistry';

export interface VCRegistryConfig {
  registrationFee: number;
  revocationFee: number;
  nexdenAssetId: number;
}

export interface VCMetadata {
  vcHash: string;
  issuerDID: string;
  subjectDID: string;
  credentialType: string;
  issuanceDate: number;
  expirationDate: number;
  status: number; // 0: Valid, 1: Revoked, 2: Suspended, 3: Expired
  revocationDate: number;
  issuerAddress: string;
  schemaHash: string;
}

export interface VerifiableCredential {
  '@context': string[];
  id: string;
  type: string[];
  issuer: string;
  issuanceDate: string;
  expirationDate?: string;
  credentialSubject: any;
  proof: any;
}

export class VCRegistryClient {
  private algodClient: Algodv2;
  private contract: VCRegistry;
  private appId?: number;
  private appAddress?: string;

  constructor(algodClient: Algodv2, appId?: number) {
    this.algodClient = algodClient;
    this.contract = new VCRegistry();
    
    if (appId) {
      this.appId = appId;
      this.appAddress = getApplicationAddress(appId);
    }
  }

  /**
   * Deploy the VC Registry contract
   */
  async deploy(
    creator: Account,
    config: VCRegistryConfig
  ): Promise<{ appId: number; appAddress: string }> {
    try {
      const result = await this.contract.create({
        sender: creator,
        args: [
          config.registrationFee,
          config.revocationFee,
          config.nexdenAssetId,
        ],
      });

      this.appId = result.appId;
      this.appAddress = result.appAddress;

      console.log(`VC Registry deployed with App ID: ${this.appId}`);
      console.log(`App Address: ${this.appAddress}`);

      return { appId: this.appId, appAddress: this.appAddress };
    } catch (error) {
      console.error('Error deploying VC registry:', error);
      throw error;
    }
  }

  /**
   * Anchor a Verifiable Credential hash on-chain
   */
  async anchorVC(
    issuer: Account,
    vc: VerifiableCredential,
    nexdenAssetId: number,
    registrationFee: number
  ): Promise<string> {
    if (!this.appId || !this.appAddress) throw new Error('Contract not deployed');

    try {
      // Calculate VC hash
      const vcHash = this.calculateVCHash(vc);
      
      // Extract schema hash (if available)
      const schemaHash = this.extractSchemaHash(vc);
      
      // Parse dates
      const expirationDate = vc.expirationDate 
        ? Math.floor(new Date(vc.expirationDate).getTime() / 1000)
        : Math.floor(Date.now() / 1000) + (365 * 24 * 3600); // Default 1 year

      const suggestedParams = await this.algodClient.getTransactionParams().do();

      // Create payment transaction for registration fee
      const paymentTxn = {
        from: issuer.addr,
        to: this.appAddress,
        amount: registrationFee,
        assetIndex: nexdenAssetId,
        suggestedParams,
      };

      const result = await this.contract.anchorVC({
        sender: issuer,
        appId: this.appId,
        args: [
          vcHash,
          vc.issuer,
          this.extractSubjectDID(vc),
          this.extractCredentialType(vc),
          expirationDate,
          schemaHash,
          paymentTxn,
        ],
      });

      console.log(`Anchored VC with hash: ${vcHash}`);
      return result.txId;
    } catch (error) {
      console.error('Error anchoring VC:', error);
      throw error;
    }
  }

  /**
   * Revoke a Verifiable Credential
   */
  async revokeVC(
    issuer: Account,
    vcHash: string,
    nexdenAssetId: number,
    revocationFee: number
  ): Promise<string> {
    if (!this.appId || !this.appAddress) throw new Error('Contract not deployed');

    try {
      const suggestedParams = await this.algodClient.getTransactionParams().do();

      const paymentTxn = {
        from: issuer.addr,
        to: this.appAddress,
        amount: revocationFee,
        assetIndex: nexdenAssetId,
        suggestedParams,
      };

      const result = await this.contract.revokeVC({
        sender: issuer,
        appId: this.appId,
        args: [vcHash, paymentTxn],
      });

      console.log(`Revoked VC with hash: ${vcHash}`);
      return result.txId;
    } catch (error) {
      console.error('Error revoking VC:', error);
      throw error;
    }
  }

  /**
   * Suspend a Verifiable Credential
   */
  async suspendVC(issuer: Account, vcHash: string): Promise<string> {
    if (!this.appId) throw new Error('Contract not deployed');

    try {
      const result = await this.contract.suspendVC({
        sender: issuer,
        appId: this.appId,
        args: [vcHash],
      });

      console.log(`Suspended VC with hash: ${vcHash}`);
      return result.txId;
    } catch (error) {
      console.error('Error suspending VC:', error);
      throw error;
    }
  }

  /**
   * Reinstate a suspended Verifiable Credential
   */
  async reinstateVC(issuer: Account, vcHash: string): Promise<string> {
    if (!this.appId) throw new Error('Contract not deployed');

    try {
      const result = await this.contract.reinstateVC({
        sender: issuer,
        appId: this.appId,
        args: [vcHash],
      });

      console.log(`Reinstated VC with hash: ${vcHash}`);
      return result.txId;
    } catch (error) {
      console.error('Error reinstating VC:', error);
      throw error;
    }
  }

  /**
   * Verify a Verifiable Credential's status
   */
  async verifyVC(vcHash: string): Promise<number> {
    if (!this.appId) throw new Error('Contract not deployed');

    try {
      const result = await this.contract.verifyVC({
        appId: this.appId,
        args: [vcHash],
      });

      return result.return;
    } catch (error) {
      console.error('Error verifying VC:', error);
      throw error;
    }
  }

  /**
   * Get VC metadata
   */
  async getVCMetadata(vcHash: string): Promise<VCMetadata> {
    if (!this.appId) throw new Error('Contract not deployed');

    try {
      const result = await this.contract.getVCMetadata({
        appId: this.appId,
        args: [vcHash],
      });

      const metadataParts = result.return.split('|');
      return {
        vcHash: vcHash,
        issuerDID: metadataParts[0],
        subjectDID: metadataParts[1],
        credentialType: metadataParts[2],
        issuanceDate: parseInt(metadataParts[3]),
        expirationDate: parseInt(metadataParts[4]),
        status: parseInt(metadataParts[5]),
        revocationDate: parseInt(metadataParts[6]),
        issuerAddress: metadataParts[7],
        schemaHash: metadataParts[8],
      };
    } catch (error) {
      console.error('Error getting VC metadata:', error);
      throw error;
    }
  }

  /**
   * Get VCs issued by an address
   */
  async getIssuerVCs(issuerAddress: string): Promise<string[]> {
    if (!this.appId) throw new Error('Contract not deployed');

    try {
      const result = await this.contract.getIssuerVCs({
        appId: this.appId,
        args: [issuerAddress],
      });

      if (result.return) {
        return result.return.split(',');
      }
      return [];
    } catch (error) {
      console.error('Error getting issuer VCs:', error);
      throw error;
    }
  }

  /**
   * Get VCs for a subject DID
   */
  async getSubjectVCs(subjectDID: string): Promise<string[]> {
    if (!this.appId) throw new Error('Contract not deployed');

    try {
      const result = await this.contract.getSubjectVCs({
        appId: this.appId,
        args: [subjectDID],
      });

      if (result.return) {
        return result.return.split(',');
      }
      return [];
    } catch (error) {
      console.error('Error getting subject VCs:', error);
      throw error;
    }
  }

  /**
   * Get revocation list for an issuer
   */
  async getRevocationList(issuerAddress: string): Promise<string[]> {
    if (!this.appId) throw new Error('Contract not deployed');

    try {
      const result = await this.contract.getRevocationList({
        appId: this.appId,
        args: [issuerAddress],
      });

      if (result.return) {
        return result.return.split(',');
      }
      return [];
    } catch (error) {
      console.error('Error getting revocation list:', error);
      throw error;
    }
  }

  /**
   * Register a credential schema
   */
  async registerSchema(
    issuer: Account,
    schemaHash: string,
    schemaMetadata: any,
    nexdenAssetId: number,
    registrationFee: number
  ): Promise<string> {
    if (!this.appId || !this.appAddress) throw new Error('Contract not deployed');

    try {
      const suggestedParams = await this.algodClient.getTransactionParams().do();

      const paymentTxn = {
        from: issuer.addr,
        to: this.appAddress,
        amount: registrationFee,
        assetIndex: nexdenAssetId,
        suggestedParams,
      };

      const result = await this.contract.registerSchema({
        sender: issuer,
        appId: this.appId,
        args: [schemaHash, JSON.stringify(schemaMetadata), paymentTxn],
      });

      console.log(`Registered schema with hash: ${schemaHash}`);
      return result.txId;
    } catch (error) {
      console.error('Error registering schema:', error);
      throw error;
    }
  }

  /**
   * Batch verify multiple VCs
   */
  async batchVerifyVCs(vcHashes: string[]): Promise<number[]> {
    if (!this.appId) throw new Error('Contract not deployed');

    try {
      const result = await this.contract.batchVerifyVCs({
        appId: this.appId,
        args: [vcHashes],
      });

      const statusList = result.return.split(',').filter(s => s.length > 0);
      return statusList.map(s => parseInt(s));
    } catch (error) {
      console.error('Error batch verifying VCs:', error);
      throw error;
    }
  }

  /**
   * Get registry statistics
   */
  async getRegistryStats(): Promise<{
    totalVCs: number;
    totalRevoked: number;
    registrationFee: number;
    revocationFee: number;
    isPaused: boolean;
  }> {
    if (!this.appId) throw new Error('Contract not deployed');

    try {
      const result = await this.contract.getRegistryStats({
        appId: this.appId,
      });

      const statsParts = result.return.split('|');
      return {
        totalVCs: parseInt(statsParts[0]),
        totalRevoked: parseInt(statsParts[1]),
        registrationFee: parseInt(statsParts[2]),
        revocationFee: parseInt(statsParts[3]),
        isPaused: statsParts[4] === '1',
      };
    } catch (error) {
      console.error('Error getting registry stats:', error);
      throw error;
    }
  }

  /**
   * Calculate VC hash from credential
   */
  calculateVCHash(vc: VerifiableCredential): string {
    // Remove proof for hash calculation
    const vcForHash = { ...vc };
    delete vcForHash.proof;
    
    // Calculate SHA-256 hash of canonical JSON
    const canonicalJson = JSON.stringify(vcForHash, Object.keys(vcForHash).sort());
    return this.sha256(canonicalJson);
  }

  /**
   * Extract subject DID from VC
   */
  private extractSubjectDID(vc: VerifiableCredential): string {
    if (typeof vc.credentialSubject.id === 'string') {
      return vc.credentialSubject.id;
    }
    return 'unknown';
  }

  /**
   * Extract credential type from VC
   */
  private extractCredentialType(vc: VerifiableCredential): string {
    const types = vc.type.filter(t => t !== 'VerifiableCredential');
    return types.length > 0 ? types[0] : 'VerifiableCredential';
  }

  /**
   * Extract schema hash from VC
   */
  private extractSchemaHash(vc: VerifiableCredential): string {
    // Look for schema reference in VC
    if (vc.credentialSubject && vc.credentialSubject.schema) {
      return this.sha256(JSON.stringify(vc.credentialSubject.schema));
    }
    return '';
  }

  /**
   * Simple SHA-256 hash function (placeholder)
   */
  private sha256(data: string): string {
    // In a real implementation, use a proper crypto library
    // This is a simplified hash for demonstration
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Create a dental credential template
   */
  createDentalCredential(
    issuerDID: string,
    subjectDID: string,
    dentalData: any
  ): VerifiableCredential {
    const now = new Date().toISOString();
    const expirationDate = new Date(Date.now() + (365 * 24 * 60 * 60 * 1000)).toISOString(); // 1 year

    return {
      '@context': [
        'https://www.w3.org/2018/credentials/v1',
        'https://nexdentify.com/contexts/dental/v1'
      ],
      id: `urn:uuid:${this.generateUUID()}`,
      type: ['VerifiableCredential', 'DentalRecordCredential'],
      issuer: issuerDID,
      issuanceDate: now,
      expirationDate: expirationDate,
      credentialSubject: {
        id: subjectDID,
        type: 'Patient',
        dentalRecord: dentalData,
      },
      proof: {
        type: 'Ed25519Signature2020',
        created: now,
        verificationMethod: `${issuerDID}#key-1`,
        proofPurpose: 'assertionMethod',
        // Signature would be added here
      }
    };
  }

  /**
   * Generate UUID (simplified)
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // Admin functions

  /**
   * Update registry fees (admin only)
   */
  async updateFees(
    admin: Account,
    newRegistrationFee: number,
    newRevocationFee: number
  ): Promise<string> {
    if (!this.appId) throw new Error('Contract not deployed');

    try {
      const result = await this.contract.updateFees({
        sender: admin,
        appId: this.appId,
        args: [newRegistrationFee, newRevocationFee],
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