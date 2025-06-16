import { Contract } from '@algorandfoundation/tealscript';

// Reputation Attestation State
interface ReputationAttestationState {
  // Registry configuration
  attestationFee: uint64;
  disputeFee: uint64;
  nexdenAssetId: uint64;
  registryOwner: Address;
  
  // Registry statistics
  totalAttestations: uint64;
  totalDisputes: uint64;
  isPaused: boolean;
}

// Attestation Metadata
interface AttestationMetadata {
  attestationId: bytes;
  attesterDID: string;
  subjectDID: string;
  attestationType: string;
  reputationScore: uint64; // 0-1000 (0.0-100.0 with 1 decimal precision)
  evidence: string;
  timestamp: uint64;
  expirationDate: uint64;
  status: uint64; // 0: Valid, 1: Disputed, 2: Revoked, 3: Expired
  attesterAddress: Address;
  category: string;
}

export class ReputationRegistry extends Contract {
  // Global state variables
  attestationFee = GlobalStateKey<uint64>();
  disputeFee = GlobalStateKey<uint64>();
  nexdenAssetId = GlobalStateKey<uint64>();
  registryOwner = GlobalStateKey<Address>();
  totalAttestations = GlobalStateKey<uint64>();
  totalDisputes = GlobalStateKey<uint64>();
  isPaused = GlobalStateKey<boolean>();
  
  // Attestation storage - using boxes for large data storage
  attestationMetadata = BoxKey<bytes>(); // Attestation ID -> Attestation metadata (encoded)
  attestationStatus = BoxKey<uint64>(); // Attestation ID -> Status
  attestationScore = BoxKey<uint64>(); // Attestation ID -> Reputation score
  attestationTimestamp = BoxKey<uint64>(); // Attestation ID -> Timestamp
  attestationExpiration = BoxKey<uint64>(); // Attestation ID -> Expiration date
  attestationAttester = BoxKey<Address>(); // Attestation ID -> Attester address
  
  // Subject mappings
  subjectAttestations = BoxKey<bytes>(); // Subject DID -> List of attestation IDs
  subjectReputationScore = BoxKey<uint64>(); // Subject DID -> Aggregated reputation score
  subjectAttestationCount = BoxKey<uint64>(); // Subject DID -> Number of attestations
  
  // Attester mappings
  attesterAttestations = BoxKey<bytes>(); // Attester address -> List of attestation IDs
  attesterReputation = BoxKey<uint64>(); // Attester address -> Attester reputation score
  
  // Category-based reputation
  categoryReputation = BoxKey<uint64>(); // Subject DID + Category -> Category-specific reputation
  
  // Dispute management
  disputedAttestations = BoxKey<bytes>(); // Attestation ID -> Dispute details
  disputeResolutions = BoxKey<bytes>(); // Attestation ID -> Resolution details

  /**
   * Initialize the Reputation Registry
   */
  createApplication(
    attestationFee: uint64,
    disputeFee: uint64,
    nexdenAssetId: uint64
  ): void {
    this.registryOwner.value = this.txn.sender;
    this.attestationFee.value = attestationFee;
    this.disputeFee.value = disputeFee;
    this.nexdenAssetId.value = nexdenAssetId;
    this.totalAttestations.value = 0;
    this.totalDisputes.value = 0;
    this.isPaused.value = false;
  }

  /**
   * Record a reputation attestation
   */
  recordAttestation(
    attestationId: bytes,
    attesterDID: string,
    subjectDID: string,
    attestationType: string,
    reputationScore: uint64,
    evidence: string,
    expirationDate: uint64,
    category: string,
    payment: AssetTransferTxn
  ): void {
    // Verify registry is not paused
    assert(!this.isPaused.value);
    
    // Verify payment for attestation fee
    assert(payment.assetReceiver === this.app.address);
    assert(payment.xferAsset === this.nexdenAssetId.value);
    assert(payment.assetAmount >= this.attestationFee.value);
    assert(payment.sender === this.txn.sender);
    
    // Verify attestation doesn't already exist
    assert(!this.attestationMetadata(attestationId).exists);
    
    // Verify reputation score is valid (0-1000)
    assert(reputationScore <= 1000);
    
    // Verify expiration date is in the future
    assert(expirationDate > globals.latestTimestamp);
    
    // Store attestation metadata
    const metadata = this.encodeAttestationMetadata(
      attestationId,
      attesterDID,
      subjectDID,
      attestationType,
      reputationScore,
      evidence,
      globals.latestTimestamp,
      expirationDate,
      0, // Valid status
      this.txn.sender,
      category
    );
    
    this.attestationMetadata(attestationId).value = metadata;
    this.attestationStatus(attestationId).value = 0; // Valid
    this.attestationScore(attestationId).value = reputationScore;
    this.attestationTimestamp(attestationId).value = globals.latestTimestamp;
    this.attestationExpiration(attestationId).value = expirationDate;
    this.attestationAttester(attestationId).value = this.txn.sender;
    
    // Update subject's attestation list
    this.addAttestationToSubject(subjectDID, attestationId);
    
    // Update attester's attestation list
    this.addAttestationToAttester(this.txn.sender, attestationId);
    
    // Update aggregated reputation scores
    this.updateSubjectReputation(subjectDID, reputationScore);
    this.updateCategoryReputation(subjectDID, category, reputationScore);
    this.updateAttesterReputation(this.txn.sender);
    
    // Update total attestations count
    this.totalAttestations.value = this.totalAttestations.value + 1;
  }

  /**
   * Dispute an attestation
   */
  disputeAttestation(
    attestationId: bytes,
    disputeReason: string,
    evidence: string,
    payment: AssetTransferTxn
  ): void {
    // Verify registry is not paused
    assert(!this.isPaused.value);
    
    // Verify payment for dispute fee
    assert(payment.assetReceiver === this.app.address);
    assert(payment.xferAsset === this.nexdenAssetId.value);
    assert(payment.assetAmount >= this.disputeFee.value);
    assert(payment.sender === this.txn.sender);
    
    // Verify attestation exists and is valid
    assert(this.attestationMetadata(attestationId).exists);
    assert(this.attestationStatus(attestationId).value === 0); // Must be valid
    
    // Mark attestation as disputed
    this.attestationStatus(attestationId).value = 1; // Disputed
    
    // Store dispute details
    const disputeDetails = this.encodeDisputeDetails(
      this.txn.sender,
      disputeReason,
      evidence,
      globals.latestTimestamp
    );
    this.disputedAttestations(attestationId).value = disputeDetails;
    
    // Update total disputes count
    this.totalDisputes.value = this.totalDisputes.value + 1;
  }

  /**
   * Resolve a dispute (admin only)
   */
  resolveDispute(
    attestationId: bytes,
    resolution: string,
    upholdAttestation: boolean
  ): void {
    // Verify caller is registry owner
    assert(this.txn.sender === this.registryOwner.value);
    
    // Verify attestation exists and is disputed
    assert(this.attestationMetadata(attestationId).exists);
    assert(this.attestationStatus(attestationId).value === 1); // Must be disputed
    
    if (upholdAttestation) {
      // Restore attestation to valid status
      this.attestationStatus(attestationId).value = 0; // Valid
    } else {
      // Revoke the attestation
      this.attestationStatus(attestationId).value = 2; // Revoked
      
      // Update reputation scores (subtract the revoked attestation)
      const score = this.attestationScore(attestationId).value;
      const metadata = this.attestationMetadata(attestationId).value;
      const subjectDID = this.extractSubjectDIDFromMetadata(metadata);
      const category = this.extractCategoryFromMetadata(metadata);
      
      this.subtractFromSubjectReputation(subjectDID, score);
      this.subtractFromCategoryReputation(subjectDID, category, score);
    }
    
    // Store resolution details
    const resolutionDetails = this.encodeResolutionDetails(
      resolution,
      upholdAttestation,
      globals.latestTimestamp
    );
    this.disputeResolutions(attestationId).value = resolutionDetails;
  }

  /**
   * Revoke an attestation (attester only)
   */
  revokeAttestation(attestationId: bytes): void {
    // Verify attestation exists and caller is the attester
    assert(this.attestationMetadata(attestationId).exists);
    assert(this.attestationAttester(attestationId).value === this.txn.sender);
    assert(this.attestationStatus(attestationId).value === 0); // Must be valid
    
    // Revoke attestation
    this.attestationStatus(attestationId).value = 2; // Revoked
    
    // Update reputation scores (subtract the revoked attestation)
    const score = this.attestationScore(attestationId).value;
    const metadata = this.attestationMetadata(attestationId).value;
    const subjectDID = this.extractSubjectDIDFromMetadata(metadata);
    const category = this.extractCategoryFromMetadata(metadata);
    
    this.subtractFromSubjectReputation(subjectDID, score);
    this.subtractFromCategoryReputation(subjectDID, category, score);
  }

  /**
   * Get attestation metadata
   */
  getAttestationMetadata(attestationId: bytes): bytes {
    // Verify attestation exists
    assert(this.attestationMetadata(attestationId).exists);
    
    return this.attestationMetadata(attestationId).value;
  }

  /**
   * Get attestation status
   */
  getAttestationStatus(attestationId: bytes): uint64 {
    // Verify attestation exists
    assert(this.attestationMetadata(attestationId).exists);
    
    const currentStatus = this.attestationStatus(attestationId).value;
    const expirationDate = this.attestationExpiration(attestationId).value;
    
    // Check if attestation has expired
    if (globals.latestTimestamp > expirationDate && currentStatus === 0) {
      // Mark as expired
      this.attestationStatus(attestationId).value = 3;
      return 3; // Expired
    }
    
    return currentStatus;
  }

  /**
   * Get subject's reputation score
   */
  getSubjectReputation(subjectDID: string): uint64 {
    const reputationKey = this.generateSubjectReputationKey(subjectDID);
    
    if (this.subjectReputationScore(reputationKey).exists) {
      return this.subjectReputationScore(reputationKey).value;
    } else {
      return 0;
    }
  }

  /**
   * Get subject's category-specific reputation
   */
  getCategoryReputation(subjectDID: string, category: string): uint64 {
    const categoryKey = this.generateCategoryReputationKey(subjectDID, category);
    
    if (this.categoryReputation(categoryKey).exists) {
      return this.categoryReputation(categoryKey).value;
    } else {
      return 0;
    }
  }

  /**
   * Get attestations for a subject
   */
  getSubjectAttestations(subjectDID: string): bytes {
    const subjectKey = this.generateSubjectKey(subjectDID);
    
    if (this.subjectAttestations(subjectKey).exists) {
      return this.subjectAttestations(subjectKey).value;
    } else {
      return '';
    }
  }

  /**
   * Get attestations by an attester
   */
  getAttesterAttestations(attester: Address): bytes {
    const attesterKey = this.generateAttesterKey(attester);
    
    if (this.attesterAttestations(attesterKey).exists) {
      return this.attesterAttestations(attesterKey).value;
    } else {
      return '';
    }
  }

  /**
   * Get attester's reputation score
   */
  getAttesterReputation(attester: Address): uint64 {
    const attesterKey = this.generateAttesterReputationKey(attester);
    
    if (this.attesterReputation(attesterKey).exists) {
      return this.attesterReputation(attesterKey).value;
    } else {
      return 500; // Default neutral reputation
    }
  }

  /**
   * Batch verify multiple attestations
   */
  batchVerifyAttestations(attestationIds: bytes[]): bytes {
    let results = '';
    
    // Limit to 10 attestations for gas efficiency
    for (let i = 0; i < 10 && i < attestationIds.length; i++) {
      const status = this.getAttestationStatus(attestationIds[i]);
      results = results + itoa(status) + ',';
    }
    
    return results;
  }

  // Helper methods

  /**
   * Encode attestation metadata
   */
  private encodeAttestationMetadata(
    attestationId: bytes,
    attesterDID: string,
    subjectDID: string,
    attestationType: string,
    reputationScore: uint64,
    evidence: string,
    timestamp: uint64,
    expirationDate: uint64,
    status: uint64,
    attesterAddress: Address,
    category: string
  ): bytes {
    return attesterDID + '|' + 
           subjectDID + '|' + 
           attestationType + '|' + 
           itoa(reputationScore) + '|' + 
           evidence + '|' + 
           itoa(timestamp) + '|' + 
           itoa(expirationDate) + '|' + 
           itoa(status) + '|' + 
           attesterAddress + '|' + 
           category;
  }

  /**
   * Encode dispute details
   */
  private encodeDisputeDetails(
    disputer: Address,
    reason: string,
    evidence: string,
    timestamp: uint64
  ): bytes {
    return disputer + '|' + reason + '|' + evidence + '|' + itoa(timestamp);
  }

  /**
   * Encode resolution details
   */
  private encodeResolutionDetails(
    resolution: string,
    upheld: boolean,
    timestamp: uint64
  ): bytes {
    return resolution + '|' + (upheld ? '1' : '0') + '|' + itoa(timestamp);
  }

  /**
   * Generate subject key
   */
  private generateSubjectKey(subjectDID: string): bytes {
    return 'subject:' + subjectDID;
  }

  /**
   * Generate attester key
   */
  private generateAttesterKey(attester: Address): bytes {
    return 'attester:' + attester;
  }

  /**
   * Generate subject reputation key
   */
  private generateSubjectReputationKey(subjectDID: string): bytes {
    return 'rep:' + subjectDID;
  }

  /**
   * Generate attester reputation key
   */
  private generateAttesterReputationKey(attester: Address): bytes {
    return 'attrep:' + attester;
  }

  /**
   * Generate category reputation key
   */
  private generateCategoryReputationKey(subjectDID: string, category: string): bytes {
    return 'catrep:' + subjectDID + ':' + category;
  }

  /**
   * Add attestation to subject's list
   */
  private addAttestationToSubject(subjectDID: string, attestationId: bytes): void {
    const subjectKey = this.generateSubjectKey(subjectDID);
    
    if (this.subjectAttestations(subjectKey).exists) {
      const currentAttestations = this.subjectAttestations(subjectKey).value;
      this.subjectAttestations(subjectKey).value = currentAttestations + ',' + attestationId;
    } else {
      this.subjectAttestations(subjectKey).value = attestationId;
    }
    
    // Update attestation count
    const countKey = this.generateSubjectKey(subjectDID + ':count');
    if (this.subjectAttestationCount(countKey).exists) {
      this.subjectAttestationCount(countKey).value = this.subjectAttestationCount(countKey).value + 1;
    } else {
      this.subjectAttestationCount(countKey).value = 1;
    }
  }

  /**
   * Add attestation to attester's list
   */
  private addAttestationToAttester(attester: Address, attestationId: bytes): void {
    const attesterKey = this.generateAttesterKey(attester);
    
    if (this.attesterAttestations(attesterKey).exists) {
      const currentAttestations = this.attesterAttestations(attesterKey).value;
      this.attesterAttestations(attesterKey).value = currentAttestations + ',' + attestationId;
    } else {
      this.attesterAttestations(attesterKey).value = attestationId;
    }
  }

  /**
   * Update subject's aggregated reputation
   */
  private updateSubjectReputation(subjectDID: string, newScore: uint64): void {
    const reputationKey = this.generateSubjectReputationKey(subjectDID);
    const countKey = this.generateSubjectKey(subjectDID + ':count');
    
    if (this.subjectReputationScore(reputationKey).exists) {
      const currentScore = this.subjectReputationScore(reputationKey).value;
      const count = this.subjectAttestationCount(countKey).value;
      
      // Calculate weighted average
      const totalScore = currentScore * (count - 1) + newScore;
      const averageScore = totalScore / count;
      
      this.subjectReputationScore(reputationKey).value = averageScore;
    } else {
      this.subjectReputationScore(reputationKey).value = newScore;
    }
  }

  /**
   * Update category-specific reputation
   */
  private updateCategoryReputation(subjectDID: string, category: string, newScore: uint64): void {
    const categoryKey = this.generateCategoryReputationKey(subjectDID, category);
    
    if (this.categoryReputation(categoryKey).exists) {
      const currentScore = this.categoryReputation(categoryKey).value;
      // Simple average for now - could be more sophisticated
      const averageScore = (currentScore + newScore) / 2;
      this.categoryReputation(categoryKey).value = averageScore;
    } else {
      this.categoryReputation(categoryKey).value = newScore;
    }
  }

  /**
   * Update attester's reputation based on their attestation history
   */
  private updateAttesterReputation(attester: Address): void {
    const attesterKey = this.generateAttesterReputationKey(attester);
    
    // Simple reputation boost for making attestations
    if (this.attesterReputation(attesterKey).exists) {
      const currentRep = this.attesterReputation(attesterKey).value;
      if (currentRep < 1000) {
        this.attesterReputation(attesterKey).value = currentRep + 1;
      }
    } else {
      this.attesterReputation(attesterKey).value = 501; // Slightly above neutral
    }
  }

  /**
   * Subtract score from subject reputation (for revoked attestations)
   */
  private subtractFromSubjectReputation(subjectDID: string, score: uint64): void {
    const reputationKey = this.generateSubjectReputationKey(subjectDID);
    const countKey = this.generateSubjectKey(subjectDID + ':count');
    
    if (this.subjectReputationScore(reputationKey).exists && this.subjectAttestationCount(countKey).exists) {
      const currentScore = this.subjectReputationScore(reputationKey).value;
      const count = this.subjectAttestationCount(countKey).value;
      
      if (count > 1) {
        // Recalculate average without the revoked score
        const totalScore = currentScore * count - score;
        const newAverage = totalScore / (count - 1);
        this.subjectReputationScore(reputationKey).value = newAverage;
      } else {
        // This was the only attestation
        this.subjectReputationScore(reputationKey).value = 0;
      }
      
      // Decrease count
      this.subjectAttestationCount(countKey).value = count - 1;
    }
  }

  /**
   * Subtract score from category reputation
   */
  private subtractFromCategoryReputation(subjectDID: string, category: string, score: uint64): void {
    const categoryKey = this.generateCategoryReputationKey(subjectDID, category);
    
    if (this.categoryReputation(categoryKey).exists) {
      const currentScore = this.categoryReputation(categoryKey).value;
      // Simple subtraction - could be more sophisticated
      if (currentScore > score) {
        this.categoryReputation(categoryKey).value = currentScore - score;
      } else {
        this.categoryReputation(categoryKey).value = 0;
      }
    }
  }

  /**
   * Extract subject DID from metadata
   */
  private extractSubjectDIDFromMetadata(metadata: bytes): string {
    // Parse metadata and extract subject DID (2nd field)
    return 'did:algo:example'; // Simplified - should parse metadata
  }

  /**
   * Extract category from metadata
   */
  private extractCategoryFromMetadata(metadata: bytes): string {
    // Parse metadata and extract category (10th field)
    return 'general'; // Simplified - should parse metadata
  }

  // Admin functions

  /**
   * Update registry fees (admin only)
   */
  updateFees(newAttestationFee: uint64, newDisputeFee: uint64): void {
    assert(this.txn.sender === this.registryOwner.value);
    
    this.attestationFee.value = newAttestationFee;
    this.disputeFee.value = newDisputeFee;
  }

  /**
   * Pause registry (admin only)
   */
  pauseRegistry(): void {
    assert(this.txn.sender === this.registryOwner.value);
    this.isPaused.value = true;
  }

  /**
   * Resume registry (admin only)
   */
  resumeRegistry(): void {
    assert(this.txn.sender === this.registryOwner.value);
    this.isPaused.value = false;
  }

  /**
   * Emergency revoke attestation (admin only)
   */
  emergencyRevokeAttestation(attestationId: bytes): void {
    assert(this.txn.sender === this.registryOwner.value);
    
    assert(this.attestationMetadata(attestationId).exists);
    
    this.attestationStatus(attestationId).value = 2; // Revoked
    
    // Update reputation scores
    const score = this.attestationScore(attestationId).value;
    const metadata = this.attestationMetadata(attestationId).value;
    const subjectDID = this.extractSubjectDIDFromMetadata(metadata);
    const category = this.extractCategoryFromMetadata(metadata);
    
    this.subtractFromSubjectReputation(subjectDID, score);
    this.subtractFromCategoryReputation(subjectDID, category, score);
  }

  /**
   * Withdraw fees (admin only)
   */
  withdrawFees(amount: uint64): void {
    assert(this.txn.sender === this.registryOwner.value);
    
    sendAssetTransfer({
      assetReceiver: this.registryOwner.value,
      assetAmount: amount,
      xferAsset: this.nexdenAssetId.value,
    });
  }

  /**
   * Transfer registry ownership (admin only)
   */
  transferOwnership(newOwner: Address): void {
    assert(this.txn.sender === this.registryOwner.value);
    this.registryOwner.value = newOwner;
  }

  /**
   * Get registry statistics
   */
  getRegistryStats(): bytes {
    const stats = itoa(this.totalAttestations.value) + '|' + 
                 itoa(this.totalDisputes.value) + '|' + 
                 itoa(this.attestationFee.value) + '|' + 
                 itoa(this.disputeFee.value) + '|' + 
                 (this.isPaused.value ? '1' : '0');
    return stats;
  }
}