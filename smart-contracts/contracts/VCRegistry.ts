import { Contract } from '@algorandfoundation/tealscript';

// Verifiable Credential Registry State
interface VCRegistryState {
  // Registry configuration
  registrationFee: uint64;
  revocationFee: uint64;
  nexdenAssetId: uint64;
  registryOwner: Address;
  
  // Registry statistics
  totalVCs: uint64;
  totalRevoked: uint64;
  isPaused: boolean;
}

// Verifiable Credential Metadata
interface VCMetadata {
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
}

export class VCRegistry extends Contract {
  // Global state variables
  registrationFee = GlobalStateKey<uint64>();
  revocationFee = GlobalStateKey<uint64>();
  nexdenAssetId = GlobalStateKey<uint64>();
  registryOwner = GlobalStateKey<Address>();
  totalVCs = GlobalStateKey<uint64>();
  totalRevoked = GlobalStateKey<uint64>();
  isPaused = GlobalStateKey<boolean>();
  
  // VC storage - using boxes for large data storage
  vcMetadata = BoxKey<bytes>(); // VC hash -> VC metadata (encoded)
  vcStatus = BoxKey<uint64>(); // VC hash -> Status (0: Valid, 1: Revoked, 2: Suspended, 3: Expired)
  vcIssuer = BoxKey<Address>(); // VC hash -> Issuer address
  vcIssuanceDate = BoxKey<uint64>(); // VC hash -> Issuance timestamp
  vcExpirationDate = BoxKey<uint64>(); // VC hash -> Expiration timestamp
  vcRevocationDate = BoxKey<uint64>(); // VC hash -> Revocation timestamp
  vcSchemaHash = BoxKey<bytes>(); // VC hash -> Schema hash
  
  // Issuer mappings
  issuerVCs = BoxKey<bytes>(); // Issuer address -> List of VC hashes (comma-separated)
  subjectVCs = BoxKey<bytes>(); // Subject DID -> List of VC hashes (comma-separated)
  
  // Schema registry
  schemaRegistry = BoxKey<bytes>(); // Schema hash -> Schema metadata
  
  // Revocation lists
  revocationList = BoxKey<bytes>(); // Issuer address -> List of revoked VC hashes

  /**
   * Initialize the VC Registry
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
    this.isPaused.value = false;
  }

  /**
   * Anchor a Verifiable Credential hash on-chain
   */
  anchorVC(
    vcHash: bytes,
    issuerDID: string,
    subjectDID: string,
    credentialType: string,
    expirationDate: uint64,
    schemaHash: bytes,
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
    
    // Store VC metadata
    const metadata = this.encodeVCMetadata(
      vcHash,
      issuerDID,
      subjectDID,
      credentialType,
      globals.latestTimestamp,
      expirationDate,
      0, // Valid status
      0, // No revocation date
      this.txn.sender,
      schemaHash
    );
    
    this.vcMetadata(vcHash).value = metadata;
    this.vcStatus(vcHash).value = 0; // Valid
    this.vcIssuer(vcHash).value = this.txn.sender;
    this.vcIssuanceDate(vcHash).value = globals.latestTimestamp;
    this.vcExpirationDate(vcHash).value = expirationDate;
    this.vcSchemaHash(vcHash).value = schemaHash;
    
    // Update issuer's VC list
    this.addVCToIssuer(this.txn.sender, vcHash);
    
    // Update subject's VC list
    this.addVCToSubject(subjectDID, vcHash);
    
    // Update total VCs count
    this.totalVCs.value = this.totalVCs.value + 1;
  }

  /**
   * Revoke a Verifiable Credential
   */
  revokeVC(
    vcHash: bytes,
    payment: AssetTransferTxn
  ): void {
    // Verify registry is not paused
    assert(!this.isPaused.value);
    
    // Verify payment for revocation fee
    assert(payment.assetReceiver === this.app.address);
    assert(payment.xferAsset === this.nexdenAssetId.value);
    assert(payment.assetAmount >= this.revocationFee.value);
    assert(payment.sender === this.txn.sender);
    
    // Verify VC exists and caller is the issuer
    assert(this.vcMetadata(vcHash).exists);
    assert(this.vcIssuer(vcHash).value === this.txn.sender);
    assert(this.vcStatus(vcHash).value === 0); // Must be valid
    
    // Revoke VC
    this.vcStatus(vcHash).value = 1; // Revoked
    this.vcRevocationDate(vcHash).value = globals.latestTimestamp;
    
    // Add to revocation list
    this.addVCToRevocationList(this.txn.sender, vcHash);
    
    // Update total revoked count
    this.totalRevoked.value = this.totalRevoked.value + 1;
  }

  /**
   * Suspend a Verifiable Credential (temporary revocation)
   */
  suspendVC(vcHash: bytes): void {
    // Verify VC exists and caller is the issuer
    assert(this.vcMetadata(vcHash).exists);
    assert(this.vcIssuer(vcHash).value === this.txn.sender);
    assert(this.vcStatus(vcHash).value === 0); // Must be valid
    
    // Suspend VC
    this.vcStatus(vcHash).value = 2; // Suspended
  }

  /**
   * Reinstate a suspended Verifiable Credential
   */
  reinstateVC(vcHash: bytes): void {
    // Verify VC exists and caller is the issuer
    assert(this.vcMetadata(vcHash).exists);
    assert(this.vcIssuer(vcHash).value === this.txn.sender);
    assert(this.vcStatus(vcHash).value === 2); // Must be suspended
    
    // Reinstate VC
    this.vcStatus(vcHash).value = 0; // Valid
  }

  /**
   * Verify a Verifiable Credential's status
   */
  verifyVC(vcHash: bytes): uint64 {
    // Verify VC exists
    assert(this.vcMetadata(vcHash).exists);
    
    const currentStatus = this.vcStatus(vcHash).value;
    const expirationDate = this.vcExpirationDate(vcHash).value;
    
    // Check if VC has expired
    if (globals.latestTimestamp > expirationDate && currentStatus === 0) {
      // Mark as expired
      this.vcStatus(vcHash).value = 3;
      return 3; // Expired
    }
    
    return currentStatus;
  }

  /**
   * Get VC metadata
   */
  getVCMetadata(vcHash: bytes): bytes {
    // Verify VC exists
    assert(this.vcMetadata(vcHash).exists);
    
    return this.vcMetadata(vcHash).value;
  }

  /**
   * Get VC status
   */
  getVCStatus(vcHash: bytes): uint64 {
    return this.verifyVC(vcHash);
  }

  /**
   * Get VCs issued by an address
   */
  getIssuerVCs(issuer: Address): bytes {
    const issuerKey = this.generateIssuerKey(issuer);
    
    if (this.issuerVCs(issuerKey).exists) {
      return this.issuerVCs(issuerKey).value;
    } else {
      return '';
    }
  }

  /**
   * Get VCs for a subject DID
   */
  getSubjectVCs(subjectDID: string): bytes {
    const subjectKey = this.generateSubjectKey(subjectDID);
    
    if (this.subjectVCs(subjectKey).exists) {
      return this.subjectVCs(subjectKey).value;
    } else {
      return '';
    }
  }

  /**
   * Get revoked VCs by an issuer
   */
  getRevocationList(issuer: Address): bytes {
    const revocationKey = this.generateRevocationKey(issuer);
    
    if (this.revocationList(revocationKey).exists) {
      return this.revocationList(revocationKey).value;
    } else {
      return '';
    }
  }

  /**
   * Register a credential schema
   */
  registerSchema(
    schemaHash: bytes,
    schemaMetadata: string,
    payment: AssetTransferTxn
  ): void {
    // Verify payment for registration fee
    assert(payment.assetReceiver === this.app.address);
    assert(payment.xferAsset === this.nexdenAssetId.value);
    assert(payment.assetAmount >= this.registrationFee.value);
    assert(payment.sender === this.txn.sender);
    
    // Verify schema doesn't already exist
    assert(!this.schemaRegistry(schemaHash).exists);
    
    // Store schema metadata
    this.schemaRegistry(schemaHash).value = schemaMetadata;
  }

  /**
   * Get schema metadata
   */
  getSchemaMetadata(schemaHash: bytes): bytes {
    assert(this.schemaRegistry(schemaHash).exists);
    return this.schemaRegistry(schemaHash).value;
  }

  /**
   * Batch verify multiple VCs
   */
  batchVerifyVCs(vcHashes: bytes[]): bytes {
    let results = '';
    
    // Limit to 10 VCs for gas efficiency
    for (let i = 0; i < 10 && i < vcHashes.length; i++) {
      const status = this.verifyVC(vcHashes[i]);
      results = results + itoa(status) + ',';
    }
    
    return results;
  }

  // Helper methods

  /**
   * Encode VC metadata
   */
  private encodeVCMetadata(
    vcHash: bytes,
    issuerDID: string,
    subjectDID: string,
    credentialType: string,
    issuanceDate: uint64,
    expirationDate: uint64,
    status: uint64,
    revocationDate: uint64,
    issuerAddress: Address,
    schemaHash: bytes
  ): bytes {
    return issuerDID + '|' + 
           subjectDID + '|' + 
           credentialType + '|' + 
           itoa(issuanceDate) + '|' + 
           itoa(expirationDate) + '|' + 
           itoa(status) + '|' + 
           itoa(revocationDate) + '|' + 
           issuerAddress + '|' + 
           schemaHash;
  }

  /**
   * Generate issuer key
   */
  private generateIssuerKey(issuer: Address): bytes {
    return 'issuer:' + issuer;
  }

  /**
   * Generate subject key
   */
  private generateSubjectKey(subjectDID: string): bytes {
    return 'subject:' + subjectDID;
  }

  /**
   * Generate revocation key
   */
  private generateRevocationKey(issuer: Address): bytes {
    return 'revoked:' + issuer;
  }

  /**
   * Add VC to issuer's list
   */
  private addVCToIssuer(issuer: Address, vcHash: bytes): void {
    const issuerKey = this.generateIssuerKey(issuer);
    
    if (this.issuerVCs(issuerKey).exists) {
      const currentVCs = this.issuerVCs(issuerKey).value;
      this.issuerVCs(issuerKey).value = currentVCs + ',' + vcHash;
    } else {
      this.issuerVCs(issuerKey).value = vcHash;
    }
  }

  /**
   * Add VC to subject's list
   */
  private addVCToSubject(subjectDID: string, vcHash: bytes): void {
    const subjectKey = this.generateSubjectKey(subjectDID);
    
    if (this.subjectVCs(subjectKey).exists) {
      const currentVCs = this.subjectVCs(subjectKey).value;
      this.subjectVCs(subjectKey).value = currentVCs + ',' + vcHash;
    } else {
      this.subjectVCs(subjectKey).value = vcHash;
    }
  }

  /**
   * Add VC to revocation list
   */
  private addVCToRevocationList(issuer: Address, vcHash: bytes): void {
    const revocationKey = this.generateRevocationKey(issuer);
    
    if (this.revocationList(revocationKey).exists) {
      const currentRevoked = this.revocationList(revocationKey).value;
      this.revocationList(revocationKey).value = currentRevoked + ',' + vcHash;
    } else {
      this.revocationList(revocationKey).value = vcHash;
    }
  }

  // Admin functions

  /**
   * Update registry fees (admin only)
   */
  updateFees(newRegistrationFee: uint64, newRevocationFee: uint64): void {
    assert(this.txn.sender === this.registryOwner.value);
    
    this.registrationFee.value = newRegistrationFee;
    this.revocationFee.value = newRevocationFee;
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
   * Emergency revoke VC (admin only - for malicious VCs)
   */
  emergencyRevokeVC(vcHash: bytes): void {
    assert(this.txn.sender === this.registryOwner.value);
    
    assert(this.vcMetadata(vcHash).exists);
    
    this.vcStatus(vcHash).value = 1; // Revoked
    this.vcRevocationDate(vcHash).value = globals.latestTimestamp;
    this.totalRevoked.value = this.totalRevoked.value + 1;
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
    const stats = itoa(this.totalVCs.value) + '|' + 
                 itoa(this.totalRevoked.value) + '|' + 
                 itoa(this.registrationFee.value) + '|' + 
                 itoa(this.revocationFee.value) + '|' + 
                 (this.isPaused.value ? '1' : '0');
    return stats;
  }
}