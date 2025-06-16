import { Contract } from '@algorandfoundation/tealscript';

// DIRS Verifiable Credential Registry State
interface DIRSVCRegistryState {
  // Registry configuration
  registrationFee: uint64;
  revocationFee: uint64;
  nexdenAssetId: uint64;
  registryOwner: Address;
  
  // DIRS-specific features
  portabilityEnabled: boolean;
  crossPlatformSupport: boolean;
  selfSovereignMode: boolean;
  interoperabilityLevel: uint64;
  
  // Registry statistics
  totalVCs: uint64;
  totalRevoked: uint64;
  totalPortableVCs: uint64;
  totalCrossPlatformVCs: uint64;
  isPaused: boolean;
}

// Enhanced VC Metadata for DIRS
interface DIRSVCMetadata {
  vcHash: bytes;
  issuerDID: string;
  subjectDID: string;
  credentialType: string;
  issuanceDate: uint64;
  expirationDate: uint64;
  status: uint64; // 0: Valid, 1: Revoked, 2: Suspended, 3: Expired
  revocationDate: uint64;
  issuerAddress: Address;
  schemaHash: bytes;
  portabilityProof: string; // Proof for cross-platform portability
  verifiabilityLevel: uint64; // 0-1000 verifiability score
  sovereigntyFlags: uint64; // Bit flags for self-sovereign features
  interopMetadata: string; // Interoperability metadata
}

export class VCRegistry extends Contract {
  // Global state variables
  registrationFee = GlobalStateKey<uint64>();
  revocationFee = GlobalStateKey<uint64>();
  nexdenAssetId = GlobalStateKey<uint64>();
  registryOwner = GlobalStateKey<Address>();
  totalVCs = GlobalStateKey<uint64>();
  totalRevoked = GlobalStateKey<uint64>();
  totalPortableVCs = GlobalStateKey<uint64>();
  totalCrossPlatformVCs = GlobalStateKey<uint64>();
  isPaused = GlobalStateKey<boolean>();
  
  // DIRS-specific configuration
  portabilityEnabled = GlobalStateKey<boolean>();
  crossPlatformSupport = GlobalStateKey<boolean>();
  selfSovereignMode = GlobalStateKey<boolean>();
  interoperabilityLevel = GlobalStateKey<uint64>();
  
  // Enhanced VC storage for DIRS
  vcMetadata = BoxKey<bytes>(); // VC hash -> Enhanced VC metadata
  vcStatus = BoxKey<uint64>(); // VC hash -> Status
  vcPortability = BoxKey<bytes>(); // VC hash -> Portability data
  vcVerifiability = BoxKey<uint64>(); // VC hash -> Verifiability score
  vcSovereignty = BoxKey<uint64>(); // VC hash -> Sovereignty flags
  vcInteropData = BoxKey<bytes>(); // VC hash -> Interoperability data
  
  // Self-sovereign credential features
  subjectVCControl = BoxKey<bytes>(); // Subject DID -> VC control preferences
  vcPortabilityProofs = BoxKey<bytes>(); // VC hash -> Portability proofs
  crossPlatformMappings = BoxKey<bytes>(); // VC hash -> Cross-platform mappings
  
  // Issuer mappings with enhanced features
  issuerVCs = BoxKey<bytes>(); // Issuer DID -> List of VC hashes
  subjectVCs = BoxKey<bytes>(); // Subject DID -> List of VC hashes
  issuerPortabilityScore = BoxKey<uint64>(); // Issuer DID -> Portability score
  subjectPortabilityScore = BoxKey<uint64>(); // Subject DID -> Portability score
  
  // Schema registry with interoperability
  schemaRegistry = BoxKey<bytes>(); // Schema hash -> Schema metadata
  schemaInteropMappings = BoxKey<bytes>(); // Schema hash -> Interop mappings
  
  // Cross-platform credential tracking
  platformMappings = BoxKey<bytes>(); // Platform ID -> Mapping configuration
  credentialBridges = BoxKey<bytes>(); // Bridge ID -> Bridge configuration
  
  // Revocation lists with portability impact
  revocationList = BoxKey<bytes>(); // Issuer DID -> List of revoked VC hashes
  revocationPortabilityImpact = BoxKey<uint64>(); // VC hash -> Portability impact

  /**
   * Initialize the DIRS VC Registry
   */
  createApplication(
    registrationFee: uint64,
    revocationFee: uint64,
    nexdenAssetId: uint64
  ): void {
    this.registryOwner.value = this.txn.sender;
    this.registrationFee.value = registrationFee;
    this.revocationFee.value = revocationFee;
    this.nexdenAssetId.value = nexdenAssetId;
    this.totalVCs.value = 0;
    this.totalRevoked.value = 0;
    this.totalPortableVCs.value = 0;
    this.totalCrossPlatformVCs.value = 0;
    this.isPaused.value = false;
    
    // Enable DIRS features by default
    this.portabilityEnabled.value = true;
    this.crossPlatformSupport.value = true;
    this.selfSovereignMode.value = true;
    this.interoperabilityLevel.value = 1000; // Maximum interoperability
  }

  /**
   * Anchor a portable, verifiable credential hash on-chain
   */
  anchorPortableVC(
    vcHash: bytes,
    issuerDID: string,
    subjectDID: string,
    credentialType: string,
    expirationDate: uint64,
    schemaHash: bytes,
    portabilityProof: string,
    sovereigntyFlags: uint64,
    interopMetadata: string,
    payment: AssetTransferTxn
  ): void {
    // Verify registry is not paused
    assert(!this.isPaused.value);
    
    // Verify payment for registration fee
    assert(payment.assetReceiver === this.app.address);
    assert(payment.xferAsset === this.nexdenAssetId.value);
    assert(payment.assetAmount >= this.registrationFee.value);
    assert(payment.sender === this.txn.sender);
    
    // Verify VC doesn't already exist
    assert(!this.vcMetadata(vcHash).exists);
    
    // Verify expiration date is in the future
    assert(expirationDate > globals.latestTimestamp);
    
    // Calculate verifiability score
    const verifiabilityScore = this.calculateVCVerifiabilityScore(
      portabilityProof,
      interopMetadata,
      sovereigntyFlags
    );
    
    // Store enhanced VC metadata
    const metadata = this.encodeDIRSVCMetadata(
      vcHash,
      issuerDID,
      subjectDID,
      credentialType,
      globals.latestTimestamp,
      expirationDate,
      0, // Valid status
      0, // No revocation date
      this.txn.sender,
      schemaHash,
      portabilityProof,
      verifiabilityScore,
      sovereigntyFlags,
      interopMetadata
    );
    
    this.vcMetadata(vcHash).value = metadata;
    this.vcStatus(vcHash).value = 0; // Valid
    this.vcPortability(vcHash).value = portabilityProof;
    this.vcVerifiability(vcHash).value = verifiabilityScore;
    this.vcSovereignty(vcHash).value = sovereigntyFlags;
    this.vcInteropData(vcHash).value = interopMetadata;
    
    // Update issuer's VC list and scores
    this.addVCToIssuer(issuerDID, vcHash);
    this.updateIssuerPortabilityScore(issuerDID, verifiabilityScore);
    
    // Update subject's VC list and scores
    this.addVCToSubject(subjectDID, vcHash);
    this.updateSubjectPortabilityScore(subjectDID, verifiabilityScore);
    
    // Update total VCs count
    this.totalVCs.value = this.totalVCs.value + 1;
    
    // Track portable VCs
    if (portabilityProof !== '') {
      this.totalPortableVCs.value = this.totalPortableVCs.value + 1;
    }
    
    // Track cross-platform VCs
    if (interopMetadata !== '') {
      this.totalCrossPlatformVCs.value = this.totalCrossPlatformVCs.value + 1;
    }
  }

  /**
   * Enable cross-platform VC mapping
   */
  enableCrossPlatformVCMapping(
    vcHash: bytes,
    targetPlatform: string,
    targetVCId: string,
    mappingProof: string,
    payment: AssetTransferTxn
  ): void {
    assert(this.crossPlatformSupport.value);
    
    // Verify payment and authorization
    assert(payment.assetReceiver === this.app.address);
    assert(payment.xferAsset === this.nexdenAssetId.value);
    assert(payment.assetAmount >= this.registrationFee.value);
    assert(payment.sender === this.txn.sender);
    
    // Verify VC exists and caller is authorized
    assert(this.vcMetadata(vcHash).exists);
    assert(this.isAuthorizedVCController(vcHash, this.txn.sender));
    
    // Store cross-platform mapping
    const mappingKey = this.generateCrossPlatformVCKey(vcHash, targetPlatform);
    const mappingData = this.encodeCrossPlatformVCMapping(
      targetVCId,
      mappingProof,
      globals.latestTimestamp
    );
    this.crossPlatformMappings(mappingKey).value = mappingData;
    
    // Update VC's portability score
    const currentScore = this.vcVerifiability(vcHash).value;
    this.vcVerifiability(vcHash).value = currentScore + 50; // Bonus for cross-platform mapping
  }

  /**
   * Set VC control preferences (self-sovereign)
   */
  setVCControlPreferences(
    subjectDID: string,
    controlPreferences: string,
    portabilitySettings: string
  ): void {
    assert(this.selfSovereignMode.value);
    
    // Verify caller is authorized to control this DID's VCs
    assert(this.isAuthorizedDIDController(subjectDID, this.txn.sender));
    
    // Store control preferences
    const controlKey = this.generateVCControlKey(subjectDID);
    this.subjectVCControl(controlKey).value = controlPreferences;
    
    // Store portability settings
    const portabilityKey = this.generateVCPortabilityProofKey(subjectDID);
    this.vcPortabilityProofs(portabilityKey).value = portabilitySettings;
  }

  /**
   * Export portable VC package
   */
  exportPortableVCPackage(vcHash: bytes): bytes {
    assert(this.portabilityEnabled.value);
    
    // Verify VC exists and caller is authorized
    assert(this.vcMetadata(vcHash).exists);
    assert(this.isAuthorizedVCController(vcHash, this.txn.sender));
    
    // Gather all VC data
    const metadata = this.vcMetadata(vcHash).value;
    const portabilityData = this.vcPortability(vcHash).value;
    const verifiabilityScore = this.vcVerifiability(vcHash).value;
    const interopData = this.vcInteropData(vcHash).value;
    
    // Create portable package
    return this.encodePortableVCPackage(
      vcHash,
      metadata,
      portabilityData,
      verifiabilityScore,
      interopData,
      globals.latestTimestamp
    );
  }

  /**
   * Import portable VC from another platform
   */
  importPortableVC(
    vcHash: bytes,
    portablePackage: string,
    verificationProof: string,
    payment: AssetTransferTxn
  ): void {
    assert(this.portabilityEnabled.value);
    
    // Verify payment and authorization
    assert(payment.assetReceiver === this.app.address);
    assert(payment.xferAsset === this.nexdenAssetId.value);
    assert(payment.assetAmount >= this.registrationFee.value);
    assert(payment.sender === this.txn.sender);
    
    // Verify the portable package authenticity
    assert(this.verifyPortableVCPackage(portablePackage, verificationProof));
    
    // Verify VC doesn't already exist
    assert(!this.vcMetadata(vcHash).exists);
    
    // Extract VC data from package and store
    const extractedMetadata = this.extractMetadataFromPackage(portablePackage);
    const extractedPortability = this.extractPortabilityFromPackage(portablePackage);
    const extractedVerifiability = this.extractVerifiabilityFromPackage(portablePackage);
    
    this.vcMetadata(vcHash).value = extractedMetadata;
    this.vcPortability(vcHash).value = extractedPortability;
    this.vcVerifiability(vcHash).value = extractedVerifiability;
    this.vcStatus(vcHash).value = 0; // Valid
    
    // Update counts
    this.totalVCs.value = this.totalVCs.value + 1;
    this.totalPortableVCs.value = this.totalPortableVCs.value + 1;
  }

  /**
   * Revoke VC with portability impact assessment
   */
  revokeVCWithPortabilityImpact(
    vcHash: bytes,
    portabilityImpact: uint64,
    payment: AssetTransferTxn
  ): void {
    // Standard revocation verification
    assert(!this.isPaused.value);
    assert(payment.assetReceiver === this.app.address);
    assert(payment.xferAsset === this.nexdenAssetId.value);
    assert(payment.assetAmount >= this.revocationFee.value);
    assert(payment.sender === this.txn.sender);
    
    assert(this.vcMetadata(vcHash).exists);
    assert(this.isAuthorizedVCController(vcHash, this.txn.sender));
    assert(this.vcStatus(vcHash).value === 0);
    
    // Revoke VC
    this.vcStatus(vcHash).value = 1; // Revoked
    
    // Store portability impact
    this.revocationPortabilityImpact(vcHash).value = portabilityImpact;
    
    // Add to revocation list
    const issuerDID = this.extractIssuerDIDFromMetadata(this.vcMetadata(vcHash).value);
    this.addVCToRevocationList(issuerDID, vcHash);
    
    // Update total revoked count
    this.totalRevoked.value = this.totalRevoked.value + 1;
  }

  /**
   * Get VC with comprehensive DIRS metadata
   */
  getVCWithDIRSMetadata(vcHash: bytes): bytes {
    assert(this.vcMetadata(vcHash).exists);
    
    const metadata = this.vcMetadata(vcHash).value;
    const portabilityData = this.vcPortability(vcHash).value;
    const verifiabilityScore = this.vcVerifiability(vcHash).value;
    const sovereigntyFlags = this.vcSovereignty(vcHash).value;
    const interopData = this.vcInteropData(vcHash).value;
    
    return this.encodeComprehensiveVCData(
      metadata,
      portabilityData,
      verifiabilityScore,
      sovereigntyFlags,
      interopData
    );
  }

  /**
   * Get cross-platform mappings for a VC
   */
  getVCCrossPlatformMappings(vcHash: bytes): bytes {
    assert(this.vcMetadata(vcHash).exists);
    
    // Return all cross-platform mappings for this VC
    // In practice, would iterate through known platforms
    const mappingKey = this.generateCrossPlatformVCKey(vcHash, 'ethereum');
    if (this.crossPlatformMappings(mappingKey).exists) {
      return this.crossPlatformMappings(mappingKey).value;
    }
    
    return '';
  }

  /**
   * Register interoperable schema with cross-platform mappings
   */
  registerInteroperableSchema(
    schemaHash: bytes,
    schemaMetadata: string,
    interopMappings: string,
    payment: AssetTransferTxn
  ): void {
    // Verify payment for registration fee
    assert(payment.assetReceiver === this.app.address);
    assert(payment.xferAsset === this.nexdenAssetId.value);
    assert(payment.assetAmount >= this.registrationFee.value);
    assert(payment.sender === this.txn.sender);
    
    // Verify schema doesn't already exist
    assert(!this.schemaRegistry(schemaHash).exists);
    
    // Store schema metadata and interop mappings
    this.schemaRegistry(schemaHash).value = schemaMetadata;
    this.schemaInteropMappings(schemaHash).value = interopMappings;
  }

  // Enhanced helper methods for DIRS

  /**
   * Calculate VC verifiability score
   */
  private calculateVCVerifiabilityScore(
    portabilityProof: string,
    interopMetadata: string,
    sovereigntyFlags: uint64
  ): uint64 {
    let score = 400; // Base verifiability
    
    // Portability proof quality
    if (portabilityProof !== '') {
      score = score + 200;
    }
    
    // Interoperability metadata
    if (interopMetadata !== '') {
      score = score + 200;
    }
    
    // Sovereignty features
    if (sovereigntyFlags > 0) {
      score = score + 100;
    }
    
    // Additional verifiability factors
    score = score + 100; // Cryptographic signatures, timestamps, etc.
    
    // Cap at 1000
    if (score > 1000) {
      score = 1000;
    }
    
    return score;
  }

  /**
   * Check if caller is authorized to control a VC
   */
  private isAuthorizedVCController(vcHash: bytes, caller: Address): boolean {
    // Extract issuer from metadata and verify
    const metadata = this.vcMetadata(vcHash).value;
    const issuerAddress = this.extractIssuerAddressFromMetadata(metadata);
    return issuerAddress === caller;
  }

  /**
   * Check if caller is authorized to control a DID
   */
  private isAuthorizedDIDController(subjectDID: string, caller: Address): boolean {
    // In practice, would verify against DID registry
    // For now, simplified check
    return true;
  }

  /**
   * Update issuer's portability score
   */
  private updateIssuerPortabilityScore(issuerDID: string, bonus: uint64): void {
    const portabilityKey = this.generateIssuerPortabilityKey(issuerDID);
    
    if (this.issuerPortabilityScore(portabilityKey).exists) {
      const currentScore = this.issuerPortabilityScore(portabilityKey).value;
      const newScore = currentScore + bonus;
      this.issuerPortabilityScore(portabilityKey).value = newScore > 1000 ? 1000 : newScore;
    } else {
      this.issuerPortabilityScore(portabilityKey).value = bonus > 1000 ? 1000 : bonus;
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
   * Verify portable VC package authenticity
   */
  private verifyPortableVCPackage(portablePackage: string, verificationProof: string): boolean {
    // Simplified verification - in practice would implement cryptographic verification
    return portablePackage !== '' && verificationProof !== '';
  }

  /**
   * Extract metadata from portable package
   */
  private extractMetadataFromPackage(portablePackage: string): string {
    // Simplified extraction - in practice would parse the package
    return 'extracted_metadata';
  }

  /**
   * Extract portability from portable package
   */
  private extractPortabilityFromPackage(portablePackage: string): string {
    // Simplified extraction - in practice would parse the package
    return 'extracted_portability';
  }

  /**
   * Extract verifiability from portable package
   */
  private extractVerifiabilityFromPackage(portablePackage: string): uint64 {
    // Simplified extraction - in practice would parse the package
    return 850; // Example verifiability
  }

  /**
   * Extract issuer DID from metadata
   */
  private extractIssuerDIDFromMetadata(metadata: string): string {
    // Parse metadata and extract issuer DID (1st field)
    return 'did:dirs:example'; // Simplified
  }

  /**
   * Extract issuer address from metadata
   */
  private extractIssuerAddressFromMetadata(metadata: string): Address {
    // Parse metadata and extract issuer address (9th field)
    return this.registryOwner.value; // Simplified
  }

  // Enhanced encoding methods

  /**
   * Encode DIRS VC metadata
   */
  private encodeDIRSVCMetadata(
    vcHash: bytes,
    issuerDID: string,
    subjectDID: string,
    credentialType: string,
    issuanceDate: uint64,
    expirationDate: uint64,
    status: uint64,
    revocationDate: uint64,
    issuerAddress: Address,
    schemaHash: bytes,
    portabilityProof: string,
    verifiabilityLevel: uint64,
    sovereigntyFlags: uint64,
    interopMetadata: string
  ): bytes {
    return issuerDID + '|' + 
           subjectDID + '|' + 
           credentialType + '|' + 
           itoa(issuanceDate) + '|' + 
           itoa(expirationDate) + '|' + 
           itoa(status) + '|' + 
           itoa(revocationDate) + '|' + 
           issuerAddress + '|' + 
           schemaHash + '|' + 
           portabilityProof + '|' + 
           itoa(verifiabilityLevel) + '|' + 
           itoa(sovereigntyFlags) + '|' + 
           interopMetadata;
  }

  /**
   * Encode cross-platform VC mapping
   */
  private encodeCrossPlatformVCMapping(
    targetVCId: string,
    mappingProof: string,
    timestamp: uint64
  ): bytes {
    return targetVCId + '|' + mappingProof + '|' + itoa(timestamp);
  }

  /**
   * Encode portable VC package
   */
  private encodePortableVCPackage(
    vcHash: bytes,
    metadata: string,
    portabilityData: string,
    verifiabilityScore: uint64,
    interopData: string,
    timestamp: uint64
  ): bytes {
    return vcHash + '|' + 
           metadata + '|' + 
           portabilityData + '|' + 
           itoa(verifiabilityScore) + '|' + 
           interopData + '|' + 
           itoa(timestamp);
  }

  /**
   * Encode comprehensive VC data
   */
  private encodeComprehensiveVCData(
    metadata: string,
    portabilityData: string,
    verifiabilityScore: uint64,
    sovereigntyFlags: uint64,
    interopData: string
  ): bytes {
    return metadata + '|DIRS|' + 
           portabilityData + '|' + 
           itoa(verifiabilityScore) + '|' + 
           itoa(sovereigntyFlags) + '|' + 
           interopData;
  }

  // Enhanced key generation methods

  /**
   * Generate cross-platform VC mapping key
   */
  private generateCrossPlatformVCKey(vcHash: bytes, targetPlatform: string): bytes {
    return 'crossplatvc:' + vcHash + ':' + targetPlatform;
  }

  /**
   * Generate VC control key
   */
  private generateVCControlKey(subjectDID: string): bytes {
    return 'vccontrol:' + subjectDID;
  }

  /**
   * Generate VC portability proof key
   */
  private generateVCPortabilityProofKey(subjectDID: string): bytes {
    return 'vcportproof:' + subjectDID;
  }

  /**
   * Generate issuer portability key
   */
  private generateIssuerPortabilityKey(issuerDID: string): bytes {
    return 'issuerport:' + issuerDID;
  }

  /**
   * Generate subject portability key
   */
  private generateSubjectPortabilityKey(subjectDID: string): bytes {
    return 'subjectport:' + subjectDID;
  }

  // Standard helper methods (updated for DIRS)
  
  private generateIssuerKey(issuerDID: string): bytes {
    return 'dirs:issuer:' + issuerDID;
  }

  private generateSubjectKey(subjectDID: string): bytes {
    return 'dirs:subject:' + subjectDID;
  }

  private generateRevocationKey(issuerDID: string): bytes {
    return 'dirs:revoked:' + issuerDID;
  }

  private addVCToIssuer(issuerDID: string, vcHash: bytes): void {
    const issuerKey = this.generateIssuerKey(issuerDID);
    
    if (this.issuerVCs(issuerKey).exists) {
      const currentVCs = this.issuerVCs(issuerKey).value;
      this.issuerVCs(issuerKey).value = currentVCs + ',' + vcHash;
    } else {
      this.issuerVCs(issuerKey).value = vcHash;
    }
  }

  private addVCToSubject(subjectDID: string, vcHash: bytes): void {
    const subjectKey = this.generateSubjectKey(subjectDID);
    
    if (this.subjectVCs(subjectKey).exists) {
      const currentVCs = this.subjectVCs(subjectKey).value;
      this.subjectVCs(subjectKey).value = currentVCs + ',' + vcHash;
    } else {
      this.subjectVCs(subjectKey).value = vcHash;
    }
  }

  private addVCToRevocationList(issuerDID: string, vcHash: bytes): void {
    const revocationKey = this.generateRevocationKey(issuerDID);
    
    if (this.revocationList(revocationKey).exists) {
      const currentRevoked = this.revocationList(revocationKey).value;
      this.revocationList(revocationKey).value = currentRevoked + ',' + vcHash;
    } else {
      this.revocationList(revocationKey).value = vcHash;
    }
  }

  // Standard view methods (updated for DIRS)

  verifyVC(vcHash: bytes): uint64 {
    assert(this.vcMetadata(vcHash).exists);
    
    const currentStatus = this.vcStatus(vcHash).value;
    // Additional expiration check would go here
    
    return currentStatus;
  }

  getVCMetadata(vcHash: bytes): bytes {
    assert(this.vcMetadata(vcHash).exists);
    return this.vcMetadata(vcHash).value;
  }

  getIssuerVCs(issuerDID: string): bytes {
    const issuerKey = this.generateIssuerKey(issuerDID);
    
    if (this.issuerVCs(issuerKey).exists) {
      return this.issuerVCs(issuerKey).value;
    } else {
      return '';
    }
  }

  getSubjectVCs(subjectDID: string): bytes {
    const subjectKey = this.generateSubjectKey(subjectDID);
    
    if (this.subjectVCs(subjectKey).exists) {
      return this.subjectVCs(subjectKey).value;
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
   * Set interoperability level
   */
  setInteroperabilityLevel(level: uint64): void {
    assert(this.txn.sender === this.registryOwner.value);
    assert(level <= 1000);
    this.interoperabilityLevel.value = level;
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
   * Get DIRS VC registry statistics
   */
  getDIRSVCStats(): bytes {
    const stats = itoa(this.totalVCs.value) + '|' + 
                 itoa(this.totalRevoked.value) + '|' + 
                 itoa(this.totalPortableVCs.value) + '|' + 
                 itoa(this.totalCrossPlatformVCs.value) + '|' + 
                 itoa(this.registrationFee.value) + '|' + 
                 itoa(this.revocationFee.value) + '|' + 
                 (this.isPaused.value ? '1' : '0') + '|' +
                 (this.portabilityEnabled.value ? '1' : '0') + '|' +
                 (this.crossPlatformSupport.value ? '1' : '0') + '|' +
                 (this.selfSovereignMode.value ? '1' : '0') + '|' +
                 itoa(this.interoperabilityLevel.value);
    return stats;
  }

  // Standard admin functions
  updateFees(newRegistrationFee: uint64, newRevocationFee: uint64): void {
    assert(this.txn.sender === this.registryOwner.value);
    this.registrationFee.value = newRegistrationFee;
    this.revocationFee.value = newRevocationFee;
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