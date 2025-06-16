import { Algodv2, Account, getApplicationAddress } from 'algosdk';
import { VCVerifier } from './VCVerifier';

export interface VCVerifierConfig {
  vcRegistryAppId: number;
  didRegistryAppId: number;
}

export interface VCVerificationResult {
  isValid: boolean;
  status: number;
  issuerVerified: boolean;
  signatureValid: boolean;
  notExpired: boolean;
  notRevoked: boolean;
  schemaValid: boolean;
}

export interface VerificationPolicy {
  requireValidSignature: boolean;
  requireNonExpired: boolean;
  requireNonRevoked: boolean;
  requireSchemaValidation: boolean;
  trustedIssuers: string[];
  acceptedCredentialTypes: string[];
}

export class VCVerifierClient {
  private algodClient: Algodv2;
  private contract: VCVerifier;
  private appId?: number;
  private appAddress?: string;

  constructor(algodClient: Algodv2, appId?: number) {
    this.algodClient = algodClient;
    this.contract = new VCVerifier();
    
    if (appId) {
      this.appId = appId;
      this.appAddress = getApplicationAddress(appId);
    }
  }

  /**
   * Deploy the VC Verifier contract
   */
  async deploy(
    creator: Account,
    config: VCVerifierConfig
  ): Promise<{ appId: number; appAddress: string }> {
    try {
      const result = await this.contract.create({
        sender: creator,
        args: [config.vcRegistryAppId, config.didRegistryAppId],
      });

      this.appId = result.appId;
      this.appAddress = result.appAddress;

      console.log(`VC Verifier deployed with App ID: ${this.appId}`);
      console.log(`App Address: ${this.appAddress}`);

      return { appId: this.appId, appAddress: this.appAddress };
    } catch (error) {
      console.error('Error deploying VC verifier:', error);
      throw error;
    }
  }

  /**
   * Verify a Verifiable Credential comprehensively
   */
  async verifyVC(
    vcHash: string,
    vcData: string,
    signature: Uint8Array,
    verificationMethodId: string
  ): Promise<VCVerificationResult> {
    if (!this.appId) throw new Error('Contract not deployed');

    try {
      const result = await this.contract.verifyVC({
        appId: this.appId,
        args: [vcHash, vcData, signature, verificationMethodId],
      });

      return {
        isValid: result.return.isValid === 1,
        status: result.return.status,
        issuerVerified: result.return.issuerVerified === 1,
        signatureValid: result.return.signatureValid === 1,
        notExpired: result.return.notExpired === 1,
        notRevoked: result.return.notRevoked === 1,
        schemaValid: result.return.schemaValid === 1,
      };
    } catch (error) {
      console.error('Error verifying VC:', error);
      throw error;
    }
  }

  /**
   * Batch verify multiple VCs
   */
  async batchVerifyVCs(
    vcHashes: string[],
    vcDataList: string[],
    signatures: Uint8Array[],
    verificationMethodIds: string[]
  ): Promise<boolean[]> {
    if (!this.appId) throw new Error('Contract not deployed');

    try {
      const result = await this.contract.batchVerifyVCs({
        appId: this.appId,
        args: [vcHashes, vcDataList, signatures, verificationMethodIds],
      });

      const resultList = result.return.split(',').filter(r => r.length > 0);
      return resultList.map(r => r === '1');
    } catch (error) {
      console.error('Error batch verifying VCs:', error);
      throw error;
    }
  }

  /**
   * Verify VC against specific policy
   */
  async verifyVCWithPolicy(
    vcHash: string,
    vcData: string,
    signature: Uint8Array,
    verificationMethodId: string,
    policy: VerificationPolicy
  ): Promise<boolean> {
    if (!this.appId) throw new Error('Contract not deployed');

    try {
      const policyData = this.encodeVerificationPolicy(policy);
      
      const result = await this.contract.verifyVCWithPolicy({
        appId: this.appId,
        args: [vcHash, vcData, signature, verificationMethodId, policyData],
      });

      return result.return === 1;
    } catch (error) {
      console.error('Error verifying VC with policy:', error);
      throw error;
    }
  }

  /**
   * Quick status check for a VC
   */
  async quickVerifyVC(vcHash: string): Promise<number> {
    if (!this.appId) throw new Error('Contract not deployed');

    try {
      const result = await this.contract.quickVerifyVC({
        appId: this.appId,
        args: [vcHash],
      });

      return result.return;
    } catch (error) {
      console.error('Error quick verifying VC:', error);
      throw error;
    }
  }

  /**
   * Verify presentation of multiple VCs
   */
  async verifyPresentation(
    vcHashes: string[],
    presentationSignature: Uint8Array,
    holderDID: string,
    verificationMethodId: string
  ): Promise<boolean> {
    if (!this.appId) throw new Error('Contract not deployed');

    try {
      const result = await this.contract.verifyPresentation({
        appId: this.appId,
        args: [vcHashes, presentationSignature, holderDID, verificationMethodId],
      });

      return result.return === 1;
    } catch (error) {
      console.error('Error verifying presentation:', error);
      throw error;
    }
  }

  /**
   * Add trusted issuer (admin only)
   */
  async addTrustedIssuer(admin: Account, issuerAddress: string): Promise<string> {
    if (!this.appId) throw new Error('Contract not deployed');

    try {
      const result = await this.contract.addTrustedIssuer({
        sender: admin,
        appId: this.appId,
        args: [issuerAddress],
      });

      console.log(`Added trusted issuer: ${issuerAddress}`);
      return result.txId;
    } catch (error) {
      console.error('Error adding trusted issuer:', error);
      throw error;
    }
  }

  /**
   * Remove trusted issuer (admin only)
   */
  async removeTrustedIssuer(admin: Account, issuerAddress: string): Promise<string> {
    if (!this.appId) throw new Error('Contract not deployed');

    try {
      const result = await this.contract.removeTrustedIssuer({
        sender: admin,
        appId: this.appId,
        args: [issuerAddress],
      });

      console.log(`Removed trusted issuer: ${issuerAddress}`);
      return result.txId;
    } catch (error) {
      console.error('Error removing trusted issuer:', error);
      throw error;
    }
  }

  /**
   * Update verification policy (admin only)
   */
  async updateVerificationPolicy(
    admin: Account,
    policy: VerificationPolicy
  ): Promise<string> {
    if (!this.appId) throw new Error('Contract not deployed');

    try {
      const policyData = this.encodeVerificationPolicy(policy);
      
      const result = await this.contract.updateVerificationPolicy({
        sender: admin,
        appId: this.appId,
        args: [policyData],
      });

      console.log('Updated verification policy');
      return result.txId;
    } catch (error) {
      console.error('Error updating verification policy:', error);
      throw error;
    }
  }

  /**
   * Get verifier statistics
   */
  async getVerifierStats(): Promise<{
    totalVerifications: number;
    successfulVerifications: number;
    isActive: boolean;
  }> {
    if (!this.appId) throw new Error('Contract not deployed');

    try {
      const result = await this.contract.getVerifierStats({
        appId: this.appId,
      });

      const statsParts = result.return.split('|');
      return {
        totalVerifications: parseInt(statsParts[0]),
        successfulVerifications: parseInt(statsParts[1]),
        isActive: statsParts[2] === '1',
      };
    } catch (error) {
      console.error('Error getting verifier stats:', error);
      throw error;
    }
  }

  /**
   * Get verifier configuration
   */
  async getVerifierConfig(): Promise<{
    vcRegistryAppId: number;
    didRegistryAppId: number;
    isActive: boolean;
  }> {
    if (!this.appId) throw new Error('Contract not deployed');

    try {
      const result = await this.contract.getVerifierConfig({
        appId: this.appId,
      });

      const configParts = result.return.split('|');
      return {
        vcRegistryAppId: parseInt(configParts[0]),
        didRegistryAppId: parseInt(configParts[1]),
        isActive: configParts[2] === '1',
      };
    } catch (error) {
      console.error('Error getting verifier config:', error);
      throw error;
    }
  }

  /**
   * Encode verification policy for contract
   */
  private encodeVerificationPolicy(policy: VerificationPolicy): string {
    return [
      policy.requireValidSignature ? '1' : '0',
      policy.requireNonExpired ? '1' : '0',
      policy.requireNonRevoked ? '1' : '0',
      policy.requireSchemaValidation ? '1' : '0',
      policy.trustedIssuers.join(','),
      policy.acceptedCredentialTypes.join(','),
    ].join('|');
  }

  /**
   * Create a default verification policy
   */
  createDefaultPolicy(): VerificationPolicy {
    return {
      requireValidSignature: true,
      requireNonExpired: true,
      requireNonRevoked: true,
      requireSchemaValidation: false,
      trustedIssuers: [],
      acceptedCredentialTypes: [],
    };
  }

  /**
   * Create a strict verification policy
   */
  createStrictPolicy(trustedIssuers: string[] = []): VerificationPolicy {
    return {
      requireValidSignature: true,
      requireNonExpired: true,
      requireNonRevoked: true,
      requireSchemaValidation: true,
      trustedIssuers: trustedIssuers,
      acceptedCredentialTypes: ['DentalRecordCredential', 'TreatmentCredential'],
    };
  }

  /**
   * Create a lenient verification policy
   */
  createLenientPolicy(): VerificationPolicy {
    return {
      requireValidSignature: true,
      requireNonExpired: false,
      requireNonRevoked: true,
      requireSchemaValidation: false,
      trustedIssuers: [],
      acceptedCredentialTypes: [],
    };
  }

  /**
   * Utility: Get status string from status code
   */
  getStatusString(status: number): string {
    switch (status) {
      case 0: return 'Valid';
      case 1: return 'Revoked';
      case 2: return 'Suspended';
      case 3: return 'Expired';
      default: return 'Unknown';
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