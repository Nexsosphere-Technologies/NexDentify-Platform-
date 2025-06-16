import { Algodv2, Account, getApplicationAddress } from 'algosdk';
import { ReputationRegistry } from './ReputationRegistry';

export interface ReputationRegistryConfig {
  attestationFee: number;
  disputeFee: number;
  nexdenAssetId: number;
}

export interface AttestationMetadata {
  attestationId: string;
  attesterDID: string;
  subjectDID: string;
  attestationType: string;
  reputationScore: number; // 0-100.0
  evidence: string;
  timestamp: number;
  expirationDate: number;
  status: number; // 0: Valid, 1: Disputed, 2: Revoked, 3: Expired
  attesterAddress: string;
  category: string;
}

export interface ReputationAttestation {
  id: string;
  attester: string;
  subject: string;
  type: string;
  score: number;
  evidence: string;
  category: string;
  expirationDate: number;
}

export class ReputationRegistryClient {
  private algodClient: Algodv2;
  private contract: ReputationRegistry;
  private appId?: number;
  private appAddress?: string;

  constructor(algodClient: Algodv2, appId?: number) {
    this.algodClient = algodClient;
    this.contract = new ReputationRegistry();
    
    if (appId) {
      this.appId = appId;
      this.appAddress = getApplicationAddress(appId);
    }
  }

  /**
   * Deploy the Reputation Registry contract
   */
  async deploy(
    creator: Account,
    config: ReputationRegistryConfig
  ): Promise<{ appId: number; appAddress: string }> {
    try {
      const result = await this.contract.create({
        sender: creator,
        args: [
          config.attestationFee,
          config.disputeFee,
          config.nexdenAssetId,
        ],
      });

      this.appId = result.appId;
      this.appAddress = result.appAddress;

      console.log(`Reputation Registry deployed with App ID: ${this.appId}`);
      console.log(`App Address: ${this.appAddress}`);

      return { appId: this.appId, appAddress: this.appAddress };
    } catch (error) {
      console.error('Error deploying reputation registry:', error);
      throw error;
    }
  }

  /**
   * Record a reputation attestation
   */
  async recordAttestation(
    attester: Account,
    attestation: ReputationAttestation,
    nexdenAssetId: number,
    attestationFee: number
  ): Promise<string> {
    if (!this.appId || !this.appAddress) throw new Error('Contract not deployed');

    try {
      // Generate unique attestation ID
      const attestationId = this.generateAttestationId(attestation);
      
      // Convert score to contract format (0-1000)
      const contractScore = Math.floor(attestation.score * 10);

      const suggestedParams = await this.algodClient.getTransactionParams().do();

      // Create payment transaction for attestation fee
      const paymentTxn = {
        from: attester.addr,
        to: this.appAddress,
        amount: attestationFee,
        assetIndex: nexdenAssetId,
        suggestedParams,
      };

      const result = await this.contract.recordAttestation({
        sender: attester,
        appId: this.appId,
        args: [
          attestationId,
          attestation.attester,
          attestation.subject,
          attestation.type,
          contractScore,
          attestation.evidence,
          attestation.expirationDate,
          attestation.category,
          paymentTxn,
        ],
      });

      console.log(`Recorded attestation with ID: ${attestationId}`);
      return result.txId;
    } catch (error) {
      console.error('Error recording attestation:', error);
      throw error;
    }
  }

  /**
   * Dispute an attestation
   */
  async disputeAttestation(
    disputer: Account,
    attestationId: string,
    disputeReason: string,
    evidence: string,
    nexdenAssetId: number,
    disputeFee: number
  ): Promise<string> {
    if (!this.appId || !this.appAddress) throw new Error('Contract not deployed');

    try {
      const suggestedParams = await this.algodClient.getTransactionParams().do();

      const paymentTxn = {
        from: disputer.addr,
        to: this.appAddress,
        amount: disputeFee,
        assetIndex: nexdenAssetId,
        suggestedParams,
      };

      const result = await this.contract.disputeAttestation({
        sender: disputer,
        appId: this.appId,
        args: [attestationId, disputeReason, evidence, paymentTxn],
      });

      console.log(`Disputed attestation: ${attestationId}`);
      return result.txId;
    } catch (error) {
      console.error('Error disputing attestation:', error);
      throw error;
    }
  }

  /**
   * Revoke an attestation (attester only)
   */
  async revokeAttestation(attester: Account, attestationId: string): Promise<string> {
    if (!this.appId) throw new Error('Contract not deployed');

    try {
      const result = await this.contract.revokeAttestation({
        sender: attester,
        appId: this.appId,
        args: [attestationId],
      });

      console.log(`Revoked attestation: ${attestationId}`);
      return result.txId;
    } catch (error) {
      console.error('Error revoking attestation:', error);
      throw error;
    }
  }

  /**
   * Get attestation metadata
   */
  async getAttestationMetadata(attestationId: string): Promise<AttestationMetadata> {
    if (!this.appId) throw new Error('Contract not deployed');

    try {
      const result = await this.contract.getAttestationMetadata({
        appId: this.appId,
        args: [attestationId],
      });

      const metadataParts = result.return.split('|');
      return {
        attestationId: attestationId,
        attesterDID: metadataParts[0],
        subjectDID: metadataParts[1],
        attestationType: metadataParts[2],
        reputationScore: parseInt(metadataParts[3]) / 10, // Convert back to 0-100 scale
        evidence: metadataParts[4],
        timestamp: parseInt(metadataParts[5]),
        expirationDate: parseInt(metadataParts[6]),
        status: parseInt(metadataParts[7]),
        attesterAddress: metadataParts[8],
        category: metadataParts[9],
      };
    } catch (error) {
      console.error('Error getting attestation metadata:', error);
      throw error;
    }
  }

  /**
   * Get attestation status
   */
  async getAttestationStatus(attestationId: string): Promise<number> {
    if (!this.appId) throw new Error('Contract not deployed');

    try {
      const result = await this.contract.getAttestationStatus({
        appId: this.appId,
        args: [attestationId],
      });

      return result.return;
    } catch (error) {
      console.error('Error getting attestation status:', error);
      throw error;
    }
  }

  /**
   * Get subject's reputation score
   */
  async getSubjectReputation(subjectDID: string): Promise<number> {
    if (!this.appId) throw new Error('Contract not deployed');

    try {
      const result = await this.contract.getSubjectReputation({
        appId: this.appId,
        args: [subjectDID],
      });

      return result.return / 10; // Convert back to 0-100 scale
    } catch (error) {
      console.error('Error getting subject reputation:', error);
      throw error;
    }
  }

  /**
   * Get subject's category-specific reputation
   */
  async getCategoryReputation(subjectDID: string, category: string): Promise<number> {
    if (!this.appId) throw new Error('Contract not deployed');

    try {
      const result = await this.contract.getCategoryReputation({
        appId: this.appId,
        args: [subjectDID, category],
      });

      return result.return / 10; // Convert back to 0-100 scale
    } catch (error) {
      console.error('Error getting category reputation:', error);
      throw error;
    }
  }

  /**
   * Get attestations for a subject
   */
  async getSubjectAttestations(subjectDID: string): Promise<string[]> {
    if (!this.appId) throw new Error('Contract not deployed');

    try {
      const result = await this.contract.getSubjectAttestations({
        appId: this.appId,
        args: [subjectDID],
      });

      if (result.return) {
        return result.return.split(',');
      }
      return [];
    } catch (error) {
      console.error('Error getting subject attestations:', error);
      throw error;
    }
  }

  /**
   * Get attestations by an attester
   */
  async getAttesterAttestations(attesterAddress: string): Promise<string[]> {
    if (!this.appId) throw new Error('Contract not deployed');

    try {
      const result = await this.contract.getAttesterAttestations({
        appId: this.appId,
        args: [attesterAddress],
      });

      if (result.return) {
        return result.return.split(',');
      }
      return [];
    } catch (error) {
      console.error('Error getting attester attestations:', error);
      throw error;
    }
  }

  /**
   * Get attester's reputation score
   */
  async getAttesterReputation(attesterAddress: string): Promise<number> {
    if (!this.appId) throw new Error('Contract not deployed');

    try {
      const result = await this.contract.getAttesterReputation({
        appId: this.appId,
        args: [attesterAddress],
      });

      return result.return / 10; // Convert back to 0-100 scale
    } catch (error) {
      console.error('Error getting attester reputation:', error);
      throw error;
    }
  }

  /**
   * Batch verify multiple attestations
   */
  async batchVerifyAttestations(attestationIds: string[]): Promise<number[]> {
    if (!this.appId) throw new Error('Contract not deployed');

    try {
      const result = await this.contract.batchVerifyAttestations({
        appId: this.appId,
        args: [attestationIds],
      });

      const statusList = result.return.split(',').filter(s => s.length > 0);
      return statusList.map(s => parseInt(s));
    } catch (error) {
      console.error('Error batch verifying attestations:', error);
      throw error;
    }
  }

  /**
   * Get registry statistics
   */
  async getRegistryStats(): Promise<{
    totalAttestations: number;
    totalDisputes: number;
    attestationFee: number;
    disputeFee: number;
    isPaused: boolean;
  }> {
    if (!this.appId) throw new Error('Contract not deployed');

    try {
      const result = await this.contract.getRegistryStats({
        appId: this.appId,
      });

      const statsParts = result.return.split('|');
      return {
        totalAttestations: parseInt(statsParts[0]),
        totalDisputes: parseInt(statsParts[1]),
        attestationFee: parseInt(statsParts[2]),
        disputeFee: parseInt(statsParts[3]),
        isPaused: statsParts[4] === '1',
      };
    } catch (error) {
      console.error('Error getting registry stats:', error);
      throw error;
    }
  }

  /**
   * Generate unique attestation ID
   */
  private generateAttestationId(attestation: ReputationAttestation): string {
    const data = `${attestation.attester}-${attestation.subject}-${attestation.type}-${Date.now()}`;
    return this.simpleHash(data);
  }

  /**
   * Simple hash function for attestation IDs
   */
  private simpleHash(data: string): string {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Create a dental service attestation
   */
  createDentalServiceAttestation(
    attesterDID: string,
    subjectDID: string,
    serviceType: string,
    score: number,
    evidence: string
  ): ReputationAttestation {
    const expirationDate = Math.floor(Date.now() / 1000) + (365 * 24 * 3600); // 1 year

    return {
      id: '',
      attester: attesterDID,
      subject: subjectDID,
      type: serviceType,
      score: Math.max(0, Math.min(100, score)), // Ensure 0-100 range
      evidence: evidence,
      category: 'dental-service',
      expirationDate: expirationDate,
    };
  }

  /**
   * Create a professional competency attestation
   */
  createProfessionalAttestation(
    attesterDID: string,
    subjectDID: string,
    competencyArea: string,
    score: number,
    evidence: string
  ): ReputationAttestation {
    const expirationDate = Math.floor(Date.now() / 1000) + (2 * 365 * 24 * 3600); // 2 years

    return {
      id: '',
      attester: attesterDID,
      subject: subjectDID,
      type: 'professional-competency',
      score: Math.max(0, Math.min(100, score)),
      evidence: evidence,
      category: competencyArea,
      expirationDate: expirationDate,
    };
  }

  /**
   * Create a patient satisfaction attestation
   */
  createPatientSatisfactionAttestation(
    patientDID: string,
    clinicDID: string,
    satisfactionScore: number,
    feedback: string
  ): ReputationAttestation {
    const expirationDate = Math.floor(Date.now() / 1000) + (180 * 24 * 3600); // 6 months

    return {
      id: '',
      attester: patientDID,
      subject: clinicDID,
      type: 'patient-satisfaction',
      score: Math.max(0, Math.min(100, satisfactionScore)),
      evidence: feedback,
      category: 'patient-experience',
      expirationDate: expirationDate,
    };
  }

  /**
   * Utility: Get status string from status code
   */
  getStatusString(status: number): string {
    switch (status) {
      case 0: return 'Valid';
      case 1: return 'Disputed';
      case 2: return 'Revoked';
      case 3: return 'Expired';
      default: return 'Unknown';
    }
  }

  /**
   * Utility: Calculate reputation grade from score
   */
  getReputationGrade(score: number): string {
    if (score >= 90) return 'A+';
    if (score >= 85) return 'A';
    if (score >= 80) return 'A-';
    if (score >= 75) return 'B+';
    if (score >= 70) return 'B';
    if (score >= 65) return 'B-';
    if (score >= 60) return 'C+';
    if (score >= 55) return 'C';
    if (score >= 50) return 'C-';
    return 'D';
  }

  // Admin functions

  /**
   * Resolve dispute (admin only)
   */
  async resolveDispute(
    admin: Account,
    attestationId: string,
    resolution: string,
    upholdAttestation: boolean
  ): Promise<string> {
    if (!this.appId) throw new Error('Contract not deployed');

    try {
      const result = await this.contract.resolveDispute({
        sender: admin,
        appId: this.appId,
        args: [attestationId, resolution, upholdAttestation],
      });

      console.log(`Resolved dispute for attestation: ${attestationId}`);
      return result.txId;
    } catch (error) {
      console.error('Error resolving dispute:', error);
      throw error;
    }
  }

  /**
   * Update registry fees (admin only)
   */
  async updateFees(
    admin: Account,
    newAttestationFee: number,
    newDisputeFee: number
  ): Promise<string> {
    if (!this.appId) throw new Error('Contract not deployed');

    try {
      const result = await this.contract.updateFees({
        sender: admin,
        appId: this.appId,
        args: [newAttestationFee, newDisputeFee],
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