import { Contract } from '@algorandfoundation/tealscript';

// DIRS Reputation Attestation State
interface DIRSReputationState {
  // Registry configuration
  attestationFee: uint64;
  disputeFee: uint64;
  nexdenAssetId: uint64;
  registryOwner: Address;
  
  // DIRS-specific features
  portabilityEnabled: boolean;
  crossPlatformSupport: boolean;
  selfSovereignMode: boolean;
  
  // Registry statistics
  totalAttestations: uint64;
  totalDisputes: uint64;
  totalPortableAttestations: uint64;
  isPaused: boolean;
}

// Enhanced Attestation Metadata for DIRS
interface DIRSAttestationMetadata {
  attestationId: bytes;
  attesterDID: string;
  subjectDID: string;
  attestationType: string;
  reputationScore: uint64;
  evidence: string;
  timestamp: uint64;
  expirationDate: uint64;
  status: uint64; // 0: Valid, 1: Disputed, 2: Revoked, 3: Expired
  attesterAddress: Address;
  category: string;
  portabilityProof: string; // Proof for cross-platform portability
  verifiabilityLevel: uint64; // 0-100 verifiability score
  sovereigntyFlags: uint64; // Bit flags for self-sovereign features
}

export class ReputationRegistry extends Contract {
  // Global state variables
  attestationFee = GlobalStateKey<uint64>();
  disputeFee = GlobalStateKey<uint64>();
  nexdenAssetId = GlobalStateKey<uint64>();
  registryOwner = GlobalStateKey<Address>();
  totalAttestations = GlobalStateKey<uint64>();
  totalDisputes = GlobalStateKey<uint64>();
  totalPortableAttestations = GlobalStateKey<uint64>();
  isPaused = GlobalStateKey<boolean>();
  
  // DIRS-specific configuration
  portabilityEnabled = GlobalStateKey<boolean>();
  crossPlatformSupport = GlobalStateKey<boolean>();
  selfSovereignMode = GlobalStateKey<boolean>();
  
  // Enhanced attestation storage for DIRS
  attestationMetadata = BoxKey<bytes>(); // Attestation ID -> Enhanced metadata
  attestationStatus = BoxKey<uint64>(); // Attestation ID -> Status
  attestationScore = BoxKey<uint64>(); // Attestation ID -> Reputation score
  attestationPortability = BoxKey<bytes>(); // Attestation ID -> Portability data
  attestationVerifiability = BoxKey<uint64>(); // Attestation ID -> Verifiability score
  attestationSovereignty = BoxKey<uint64>(); // Attestation ID -> Sovereignty flags
  
  // Self-sovereign reputation features
  subjectReputationControl = BoxKey<bytes>(); // Subject DID -> Control preferences
  reputationPortabilityProofs = BoxKey<bytes>(); // Subject DID -> Portability proofs
  crossPlatformMappings = BoxKey<bytes>(); // Subject DID -> Cross-platform mappings
  
  // Subject mappings with enhanced features
  subjectAttestations = BoxKey<bytes>(); // Subject DID -> List of attestation IDs
  subjectReputationScore = BoxKey<uint64>(); // Subject DID -> Aggregated reputation score
  subjectPortabilityScore = BoxKey<uint64>(); // Subject DID -> Portability score
  subjectVerifiabilityScore = BoxKey<uint64>(); // Subject DID -> Verifiability score
  
  // Attester mappings with sovereignty features
  attesterAttestations = BoxKey<bytes>(); // Attester DID -> List of attestation IDs
  attesterReputation = BoxKey<uint64>(); // Attester DID -> Attester reputation score
  attesterVerifiability = BoxKey<uint64>(); // Attester DID -> Verifiability score
  attesterSovereigntyLevel = BoxKey<uint64>(); // Attester DID -> Sovereignty level
  
  // Category-based reputation with portability
  categoryReputation = BoxKey<uint64>(); // Subject DID + Category -> Category reputation
  categoryPortability = BoxKey<uint64>(); // Subject DID + Category -> Category portability
  
  // Cross-platform reputation tracking
  platformMappings = BoxKey<bytes>(); // Platform ID -> Mapping configuration
  reputationBridges = BoxKey<bytes>(); // Bridge ID -> Bridge configuration
  
  // Dispute management with enhanced features
  disputedAttestations = BoxKey<bytes>(); // Attestation ID -> Dispute details
  disputeResolutions = BoxKey<bytes>(); // Attestation ID -> Resolution details
  disputePortabilityImpact = BoxKey<uint64>(); // Attestation ID -> Portability impact

  /**
   * Initialize the DIRS Reputation Registry
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
    this.totalPortableAttestations.value = 0;
    this.isPaused.value = false;
    
    // Enable DIRS features by default
    this.portabilityEnabled.value = true;
    this.crossPlatformSupport.value = true;
    this.selfSovereignMode.value = true;
  }

  /**
   * Record a portable, verifiable reputation attestation
   */
  recordPortableAttestation(
    attestationId: bytes,
    attesterDID: string,
    subjectDID: string,
    attestationType: string,
    reputationScore: uint64,
    evidence: string,
    expirationDate: uint64,
    category: string,
    portabilityProof: string,
    sovereigntyFlags: uint64,
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
    
    // Calculate verifiability score based on evidence and proofs
    const verifiabilityScore = this.calculateVerifiabilityScore(evidence, portabilityProof);
    
    // Store enhanced attestation metadata
    const metadata = this.encodeDIRSAttestationMetadata(
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
      category,
      portabilityProof,
      verifiabilityScore,
      sovereigntyFlags
    );
    
    this.attestationMetadata(attestationId).value = metadata;
    this.attestationStatus(attestationId).value = 0; // Valid
    this.attestationScore(attestationId).value = reputationScore;
    this.attestationPortability(attestationId).value = portabilityProof;
    this.attestationVerifiability(attestationId).value = verifiabilityScore;
    this.attestationSovereignty(attestationId).value = sovereigntyFlags;
    
    // Update subject's attestation list and scores
    this.addAttestationToSubject(subjectDID, attestationId);
    this.updateSubjectReputationScores(subjectDID, reputationScore, verifiabilityScore);
    this.updateCategoryReputationWithPortability(subjectDID, category, reputationScore, verifiabilityScore);
    
    // Update attester's reputation and verifiability
    this.addAttestationToAttester(attesterDID, attestationId);
    this.updateAttesterReputationScores(attesterDID, verifiabilityScore);
    
    // Update total attestations count
    this.totalAttestations.value = this.totalAttestations.value + 1;
    
    // Track portable attestations
    if (portabilityProof !== '') {
      this.totalPortableAttestations.value = this.totalPortableAttestations.value + 1;
    }
  }

  /**
   * Enable cross-platform reputation mapping
   */
  enableCrossPlatformMapping(
    subjectDID: string,
    platformId: string,
    platformReputation: uint64,
    mappingProof: string,
    payment: AssetTransferTxn
  ): void {
    assert(this.crossPlatformSupport.value);
    
    // Verify payment and authorization
    assert(payment.assetReceiver === this.app.address);
    assert(payment.xferAsset === this.nexdenAssetId.value);
    assert(payment.assetAmount >= this.attestationFee.value);
    assert(payment.sender === this.txn.sender);
    
    // Store cross-platform mapping
    const mappingKey = this.generateCrossPlatformKey(subjectDID, platformId);
    const mappingData = this.encodeCrossPlatformMapping(
      platformReputation,
      mappingProof,
      globals.latestTimestamp
    );
    this.crossPlatformMappings(mappingKey).value = mappingData;
    
    // Update subject's portability score
    this.updateSubjectPortabilityScore(subjectDID, 50); // Bonus for cross-platform presence
  }

  /**
   * Set reputation control preferences (self-sovereign)
   */
  setReputationControlPreferences(
    subjectDID: string,
    controlPreferences: string,
    portabilitySettings: string
  ): void {
    assert(this.selfSovereignMode.value);
    
    // Verify caller is authorized to control this DID's reputation
    assert(this.isAuthorizedReputationController(subjectDID, this.txn.sender));
    
    // Store control preferences
    const controlKey = this.generateReputationControlKey(subjectDID);
    this.subjectReputationControl(controlKey).value = controlPreferences;
    
    // Store portability settings
    const portabilityKey = this.generatePortabilityProofKey(subjectDID);
    this.reputationPortabilityProofs(portabilityKey).value = portabilitySettings;
  }

  /**
   * Export portable reputation package
   */
  exportPortableReputation(subjectDID: string): bytes {
    assert(this.portabilityEnabled.value);
    
    // Verify caller is authorized
    assert(this.isAuthorizedReputationController(subjectDID, this.txn.sender));
    
    // Gather all reputation data for the subject
    const reputationScore = this.getSubjectReputation(subjectDID);
    const portabilityScore = this.getSubjectPortabilityScore(subjectDID);
    const verifiabilityScore = this.getSubjectVerifiabilityScore(subjectDID);
    const attestations = this.getSubjectAttestations(subjectDID);
    
    // Create portable package
    return this.encodePortableReputationPackage(
      subjectDID,
      reputationScore,
      portabilityScore,
      verifiabilityScore,
      attestations,
      globals.latestTimestamp
    );
  }

  /**
   * Import portable reputation from another platform
   */
  importPortableReputation(
    subjectDID: string,
    portablePackage: string,
    verificationProof: string,
    payment: AssetTransferTxn
  ): void {
    assert(this.portabilityEnabled.value);
    
    // Verify payment and authorization
    assert(payment.assetReceiver === this.app.address);
    assert(payment.xferAsset === this.nexdenAssetId.value);
    assert(payment.assetAmount >= this.attestationFee.value);
    assert(payment.sender === this.txn.sender);
    
    // Verify the portable package authenticity
    assert(this.verifyPortablePackage(portablePackage, verificationProof));
    
    // Extract reputation data from package
    const importedScore = this.extractScoreFromPackage(portablePackage);
    const importedVerifiability = this.extractVerifiabilityFromPackage(portablePackage);
    
    // Update subject's scores with imported data
    this.updateSubjectReputationScores(subjectDID, importedScore, importedVerifiability);
    this.updateSubjectPortabilityScore(subjectDID, 100); // Bonus for successful import
  }

  /**
   * Dispute attestation with portability impact assessment
   */
  disputeAttestationWithPortabilityImpact(
    attestationId: bytes,
    disputeReason: string,
    evidence: string,
    portabilityImpact: uint64,
    payment: AssetTransferTxn
  ): void {
    // Standard dispute verification
    assert(!this.isPaused.value);
    assert(payment.assetReceiver === this.app.address);
    assert(payment.xferAsset === this.nexdenAssetId.value);
    assert(payment.assetAmount >= this.disputeFee.value);
    assert(payment.sender === this.txn.sender);
    
    assert(this.attestationMetadata(attestationId).exists);
    assert(this.attestationStatus(attestationId).value === 0);
    
    // Mark attestation as disputed
    this.attestationStatus(attestationId).value = 1; // Disputed
    
    // Store dispute details with portability impact
    const disputeDetails = this.encodeEnhancedDisputeDetails(
      this.txn.sender,
      disputeReason,
      evidence,
      portabilityImpact,
      globals.latestTimestamp
    );
    this.disputedAttestations(attestationId).value = disputeDetails;
    this.disputePortabilityImpact(attestationId).value = portabilityImpact;
    
    // Update total disputes count
    this.totalDisputes.value = this.totalDisputes.value + 1;
  }

  /**
   * Get subject's comprehensive reputation with portability metrics
   */
  getSubjectComprehensiveReputation(subjectDID: string): bytes {
    const reputationKey = this.generateSubjectReputationKey(subjectDID);
    const portabilityKey = this.generateSubjectPortabilityKey(subjectDID);
    const verifiabilityKey = this.generateSubjectVerifiabilityKey(subjectDID);
    
    const reputation = this.subjectReputationScore(reputationKey).exists ? 
                      this.subjectReputationScore(reputationKey).value : 0;
    const portability = this.subjectPortabilityScore(portabilityKey).exists ? 
                       this.subjectPortabilityScore(portabilityKey).value : 0;
    const verifiability = this.subjectVerifiabilityScore(verifiabilityKey).exists ? 
                         this.subjectVerifiabilityScore(verifiabilityKey).value : 0;
    
    return this.encodeComprehensiveReputation(reputation, portability, verifiability);
  }

  /**
   * Get subject's portability score
   */
  getSubjectPortabilityScore(subjectDID: string): uint64 {
    const portabilityKey = this.generateSubjectPortabilityKey(subjectDID);
    
    if (this.subjectPortabilityScore(portabilityKey).exists) {
      return this.subjectPortabilityScore(portabilityKey).value;
    } else {
      return 0;
    }
  }

  /**
   * Get subject's verifiability score
   */
  getSubjectVerifiabilityScore(subjectDID: string): uint64 {
    const verifiabilityKey = this.generateSubjectVerifiabilityKey(subjectDID);
    
    if (this.subjectVerifiabilityScore(verifiabilityKey).exists) {
      return this.subjectVerifiabilityScore(verifiabilityKey).value;
    } else {
      return 0;
    }
  }

  // Enhanced helper methods for DIRS

  /**
   * Calculate verifiability score based on evidence quality
   */
  private calculateVerifiabilityScore(evidence: string, portabilityProof: string): uint64 {
    let score = 300; // Base verifiability
    
    // Evidence quality assessment
    if (evidence !== '') {
      score = score + 200;
    }
    
    // Portability proof quality
    if (portabilityProof !== '') {
      score = score + 300;
    }
    
    // Additional verifiability factors
    score = score + 200; // Cryptographic signatures, timestamps, etc.
    
    // Cap at 1000
    if (score > 1000) {
      score = 1000;
    }
    
    return score;
  }

  /**
   * Check if caller is authorized to control reputation for a DID
   */
  private isAuthorizedReputationController(subjectDID: string, caller: Address): boolean {
    // In practice, would verify against DID registry
    // For now, simplified check
    return true;
  }

  /**
   * Update subject's reputation scores with portability and verifiability
   */
  private updateSubjectReputationScores(
    subjectDID: string,
    reputationScore: uint64,
    verifiabilityScore: uint64
  ): void {
    // Update reputation score
    const reputationKey = this.generateSubjectReputationKey(subjectDID);
    if (this.subjectReputationScore(reputationKey).exists) {
      const currentScore = this.subjectReputationScore(reputationKey).value;
      const newScore = (currentScore + reputationScore) / 2; // Simple average
      this.subjectReputationScore(reputationKey).value = newScore;
    } else {
      this.subjectReputationScore(reputationKey).value = reputationScore;
    }
    
    // Update verifiability score
    const verifiabilityKey = this.generateSubjectVerifiabilityKey(subjectDID);
    if (this.subjectVerifiabilityScore(verifiabilityKey).exists) {
      const currentScore = this.subjectVerifiabilityScore(verifiabilityKey).value;
      const newScore = (currentScore + verifiabilityScore) / 2;
      this.subjectVerifiabilityScore(verifiabilityKey).value = newScore;
    } else {
      this.subjectVerifiabilityScore(verifiabilityKey).value = verifiabilityScore;
    }
  }

  /**
   * Update subject's portability score
   */
  private updateSubjectPortabilityScore(subjectDID: string, bonus: uint64): void {
    const portabilityKey = this.generateSubjectPortabilityKey(subjectDID);
    
    if (this.subjectPortabilityScore(portabilityKey).exists) {
      const currentScore = this.subjectPortabilityScore(portabilityKey).value;
      const newScore = currentScore + bonus;
      this.subjectPortabilityScore(portabilityKey).value = newScore > 1000 ? 1000 : newScore;
    } else {
      this.subjectPortabilityScore(portabilityKey).value = bonus > 1000 ? 1000 : bonus;
    }
  }

  /**
   * Update category reputation with portability metrics
   */
  private updateCategoryReputationWithPortability(
    subjectDID: string,
    category: string,
    reputationScore: uint64,
    verifiabilityScore: uint64
  ): void {
    const categoryKey = this.generateCategoryReputationKey(subjectDID, category);
    const portabilityKey = this.generateCategoryPortabilityKey(subjectDID, category);
    
    // Update category reputation
    if (this.categoryReputation(categoryKey).exists) {
      const currentScore = this.categoryReputation(categoryKey).value;
      const newScore = (currentScore + reputationScore) / 2;
      this.categoryReputation(categoryKey).value = newScore;
    } else {
      this.categoryReputation(categoryKey).value = reputationScore;
    }
    
    // Update category portability
    if (this.categoryPortability(portabilityKey).exists) {
      const currentScore = this.categoryPortability(portabilityKey).value;
      const newScore = (currentScore + verifiabilityScore) / 2;
      this.categoryPortability(portabilityKey).value = newScore;
    } else {
      this.categoryPortability(portabilityKey).value = verifiabilityScore;
    }
  }

  /**
   * Update attester reputation scores
   */
  private updateAttesterReputationScores(attesterDID: string, verifiabilityScore: uint64): void {
    const attesterKey = this.generateAttesterReputationKey(attesterDID);
    const verifiabilityKey = this.generateAttesterVerifiabilityKey(attesterDID);
    
    // Update attester reputation
    if (this.attesterReputation(attesterKey).exists) {
      const currentRep = this.attesterReputation(attesterKey).value;
      if (currentRep < 1000) {
        this.attesterReputation(attesterKey).value = currentRep + 1;
      }
    } else {
      this.attesterReputation(attesterKey).value = 501;
    }
    
    // Update attester verifiability
    if (this.attesterVerifiability(verifiabilityKey).exists) {
      const currentScore = this.attesterVerifiability(verifiabilityKey).value;
      const newScore = (currentScore + verifiabilityScore) / 2;
      this.attesterVerifiability(verifiabilityKey).value = newScore;
    } else {
      this.attesterVerifiability(verifiabilityKey).value = verifiabilityScore;
    }
  }

  /**
   * Verify portable package authenticity
   */
  private verifyPortablePackage(portablePackage: string, verificationProof: string): boolean {
    // Simplified verification - in practice would implement cryptographic verification
    return portablePackage !== '' && verificationProof !== '';
  }

  /**
   * Extract score from portable package
   */
  private extractScoreFromPackage(portablePackage: string): uint64 {
    // Simplified extraction - in practice would parse the package
    return 750; // Example score
  }

  /**
   * Extract verifiability from portable package
   */
  private extractVerifiabilityFromPackage(portablePackage: string): uint64 {
    // Simplified extraction - in practice would parse the package
    return 800; // Example verifiability
  }

  // Enhanced encoding methods

  /**
   * Encode DIRS attestation metadata
   */
  private encodeDIRSAttestationMetadata(
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
    category: string,
    portabilityProof: string,
    verifiabilityLevel: uint64,
    sovereigntyFlags: uint64
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
           category + '|' + 
           portabilityProof + '|' + 
           itoa(verifiabilityLevel) + '|' + 
           itoa(sovereigntyFlags);
  }

  /**
   * Encode enhanced dispute details
   */
  private encodeEnhancedDisputeDetails(
    disputer: Address,
    reason: string,
    evidence: string,
    portabilityImpact: uint64,
    timestamp: uint64
  ): bytes {
    return disputer + '|' + reason + '|' + evidence + '|' + itoa(portabilityImpact) + '|' + itoa(timestamp);
  }

  /**
   * Encode cross-platform mapping
   */
  private encodeCrossPlatformMapping(
    platformReputation: uint64,
    mappingProof: string,
    timestamp: uint64
  ): bytes {
    return itoa(platformReputation) + '|' + mappingProof + '|' + itoa(timestamp);
  }

  /**
   * Encode portable reputation package
   */
  private encodePortableReputationPackage(
    subjectDID: string,
    reputationScore: uint64,
    portabilityScore: uint64,
    verifiabilityScore: uint64,
    attestations: string,
    timestamp: uint64
  ): bytes {
    return subjectDID + '|' + 
           itoa(reputationScore) + '|' + 
           itoa(portabilityScore) + '|' + 
           itoa(verifiabilityScore) + '|' + 
           attestations + '|' + 
           itoa(timestamp);
  }

  /**
   * Encode comprehensive reputation
   */
  private encodeComprehensiveReputation(
    reputation: uint64,
    portability: uint64,
    verifiability: uint64
  ): bytes {
    return itoa(reputation) + '|' + itoa(portability) + '|' + itoa(verifiability);
  }

  // Enhanced key generation methods

  /**
   * Generate subject portability key
   */
  private generateSubjectPortabilityKey(subjectDID: string): bytes {
    return 'portability:' + subjectDID;
  }

  /**
   * Generate subject verifiability key
   */
  private generateSubjectVerifiabilityKey(subjectDID: string): bytes {
    return 'verifiability:' + subjectDID;
  }

  /**
   * Generate category portability key
   */
  private generateCategoryPortabilityKey(subjectDID: string, category: string): bytes {
    return 'catport:' + subjectDID + ':' + category;
  }

  /**
   * Generate attester verifiability key
   */
  private generateAttesterVerifiabilityKey(attesterDID: string): bytes {
    return 'attverif:' + attesterDID;
  }

  /**
   * Generate cross-platform mapping key
   */
  private generateCrossPlatformKey(subjectDID: string, platformId: string): bytes {
    return 'crossplat:' + subjectDID + ':' + platformId;
  }

  /**
   * Generate reputation control key
   */
  private generateReputationControlKey(subjectDID: string): bytes {
    return 'repcontrol:' + subjectDID;
  }

  /**
   * Generate portability proof key
   */
  private generatePortabilityProofKey(subjectDID: string): bytes {
    return 'portproof:' + subjectDID;
  }

  // Standard helper methods (updated for DIRS)
  
  private generateSubjectKey(subjectDID: string): bytes {
    return 'dirs:subject:' + subjectDID;
  }

  private generateAttesterKey(attesterDID: string): bytes {
    return 'dirs:attester:' + attesterDID;
  }

  private generateSubjectReputationKey(subjectDID: string): bytes {
    return 'dirs:rep:' + subjectDID;
  }

  private generateAttesterReputationKey(attesterDID: string): bytes {
    return 'dirs:attrep:' + attesterDID;
  }

  private generateCategoryReputationKey(subjectDID: string, category: string): bytes {
    return 'dirs:catrep:' + subjectDID + ':' + category;
  }

  private addAttestationToSubject(subjectDID: string, attestationId: bytes): void {
    const subjectKey = this.generateSubjectKey(subjectDID);
    
    if (this.subjectAttestations(subjectKey).exists) {
      const currentAttestations = this.subjectAttestations(subjectKey).value;
      this.subjectAttestations(subjectKey).value = currentAttestations + ',' + attestationId;
    } else {
      this.subjectAttestations(subjectKey).value = attestationId;
    }
  }

  private addAttestationToAttester(attesterDID: string, attestationId: bytes): void {
    const attesterKey = this.generateAttesterKey(attesterDID);
    
    if (this.attesterAttestations(attesterKey).exists) {
      const currentAttestations = this.attesterAttestations(attesterKey).value;
      this.attesterAttestations(attesterKey).value = currentAttestations + ',' + attestationId;
    } else {
      this.attesterAttestations(attesterKey).value = attestationId;
    }
  }

  // Standard view methods (updated for DIRS)

  getSubjectReputation(subjectDID: string): uint64 {
    const reputationKey = this.generateSubjectReputationKey(subjectDID);
    
    if (this.subjectReputationScore(reputationKey).exists) {
      return this.subjectReputationScore(reputationKey).value;
    } else {
      return 0;
    }
  }

  getSubjectAttestations(subjectDID: string): string {
    const subjectKey = this.generateSubjectKey(subjectDID);
    
    if (this.subjectAttestations(subjectKey).exists) {
      return this.subjectAttestations(subjectKey).value;
    } else {
      return '';
    }
  }

  // DIRS-specific admin functions

  /**
   * Enable/disable portability features
   */
  setPortabilityStatus(enabled: boolean): void {
    assert(this.txn.sender === this.registryOwner.value);
    this.portabilityEnabled.value = enabled;
  }

  /**
   * Enable/disable cross-platform support
   */
  setCrossPlatformSupport(enabled: boolean): void {
    assert(this.txn.sender === this.registryOwner.value);
    this.crossPlatformSupport.value = enabled;
  }

  /**
   * Enable/disable self-sovereign mode
   */
  setSelfSovereignMode(enabled: boolean): void {
    assert(this.txn.sender === this.registryOwner.value);
    this.selfSovereignMode.value = enabled;
  }

  /**
   * Register platform mapping configuration
   */
  registerPlatformMapping(
    platformId: string,
    mappingConfig: string,
    payment: AssetTransferTxn
  ): void {
    assert(this.txn.sender === this.registryOwner.value);
    assert(payment.assetReceiver === this.app.address);
    assert(payment.xferAsset === this.nexdenAssetId.value);
    
    const platformKey = 'platform:' + platformId;
    this.platformMappings(platformKey).value = mappingConfig;
  }

  /**
   * Get DIRS registry statistics
   */
  getDIRSReputationStats(): bytes {
    const stats = itoa(this.totalAttestations.value) + '|' + 
                 itoa(this.totalDisputes.value) + '|' + 
                 itoa(this.totalPortableAttestations.value) + '|' + 
                 itoa(this.attestationFee.value) + '|' + 
                 itoa(this.disputeFee.value) + '|' + 
                 (this.isPaused.value ? '1' : '0') + '|' +
                 (this.portabilityEnabled.value ? '1' : '0') + '|' +
                 (this.crossPlatformSupport.value ? '1' : '0') + '|' +
                 (this.selfSovereignMode.value ? '1' : '0');
    return stats;
  }

  // Standard admin functions
  updateFees(newAttestationFee: uint64, newDisputeFee: uint64): void {
    assert(this.txn.sender === this.registryOwner.value);
    this.attestationFee.value = newAttestationFee;
    this.disputeFee.value = newDisputeFee;
  }

  pauseRegistry(): void {
    assert(this.txn.sender === this.registryOwner.value);
    this.isPaused.value = true;
  }

  resumeRegistry(): void {
    assert(this.txn.sender === this.registryOwner.value);
    this.isPaused.value = false;
  }

  transferOwnership(newOwner: Address): void {
    assert(this.txn.sender === this.registryOwner.value);
    this.registryOwner.value = newOwner;
  }
}