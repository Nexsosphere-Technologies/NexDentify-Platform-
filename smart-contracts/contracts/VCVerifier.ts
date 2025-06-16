import { Contract } from '@algorandfoundation/tealscript';

// VC Verification Result
interface VCVerificationResult {
  isValid: boolean;
  status: uint64;
  issuerVerified: boolean;
  signatureValid: boolean;
  notExpired: boolean;
  notRevoked: boolean;
  schemaValid: boolean;
}

// Verification Policy
interface VerificationPolicy {
  requireValidSignature: boolean;
  requireNonExpired: boolean;
  requireNonRevoked: boolean;
  requireSchemaValidation: boolean;
  trustedIssuers: Address[];
  acceptedCredentialTypes: string[];
}

export class VCVerifier extends Contract {
  // Registry contract app IDs
  vcRegistryAppId = GlobalStateKey<uint64>();
  didRegistryAppId = GlobalStateKey<uint64>();
  
  // Verifier configuration
  verifierOwner = GlobalStateKey<Address>();
  isActive = GlobalStateKey<boolean>();
  
  // Verification policies
  defaultPolicy = GlobalStateKey<bytes>();
  
  // Trusted issuer registry
  trustedIssuers = BoxKey<boolean>(); // Issuer address -> trusted status
  
  // Verification statistics
  totalVerifications = GlobalStateKey<uint64>();
  successfulVerifications = GlobalStateKey<uint64>();

  /**
   * Initialize the VC Verifier
   */
  createApplication(
    vcRegistryAppId: uint64,
    didRegistryAppId: uint64
  ): void {
    this.verifierOwner.value = this.txn.sender;
    this.vcRegistryAppId.value = vcRegistryAppId;
    this.didRegistryAppId.value = didRegistryAppId;
    this.isActive.value = true;
    this.totalVerifications.value = 0;
    this.successfulVerifications.value = 0;
    
    // Set default verification policy
    const defaultPolicyData = this.encodeVerificationPolicy(
      true,  // requireValidSignature
      true,  // requireNonExpired
      true,  // requireNonRevoked
      false, // requireSchemaValidation
      '',    // trustedIssuers (empty)
      ''     // acceptedCredentialTypes (empty)
    );
    this.defaultPolicy.value = defaultPolicyData;
  }

  /**
   * Verify a Verifiable Credential comprehensively
   */
  verifyVC(
    vcHash: bytes,
    vcData: bytes,
    signature: bytes,
    verificationMethodId: string
  ): VCVerificationResult {
    assert(this.isActive.value);
    
    this.totalVerifications.value = this.totalVerifications.value + 1;
    
    // Step 1: Check VC status in registry
    const vcStatus = this.getVCStatusFromRegistry(vcHash);
    const isNotRevoked = (vcStatus === 0 || vcStatus === 2); // Valid or Suspended
    
    // Step 2: Get VC metadata from registry
    const vcMetadata = this.getVCMetadataFromRegistry(vcHash);
    const issuerAddress = this.extractIssuerFromMetadata(vcMetadata);
    const expirationDate = this.extractExpirationFromMetadata(vcMetadata);
    const issuerDID = this.extractIssuerDIDFromMetadata(vcMetadata);
    
    // Step 3: Check expiration
    const isNotExpired = globals.latestTimestamp <= expirationDate;
    
    // Step 4: Verify issuer is trusted (if policy requires)
    const issuerVerified = this.isIssuerTrusted(issuerAddress);
    
    // Step 5: Verify signature using DID
    const signatureValid = this.verifyVCSignature(
      issuerDID,
      vcData,
      signature,
      verificationMethodId
    );
    
    // Step 6: Determine overall validity
    const isValid = isNotRevoked && isNotExpired && signatureValid && issuerVerified;
    
    if (isValid) {
      this.successfulVerifications.value = this.successfulVerifications.value + 1;
    }
    
    return {
      isValid: isValid,
      status: vcStatus,
      issuerVerified: issuerVerified,
      signatureValid: signatureValid,
      notExpired: isNotExpired,
      notRevoked: isNotRevoked,
      schemaValid: true, // Simplified for now
    };
  }

  /**
   * Batch verify multiple VCs
   */
  batchVerifyVCs(
    vcHashes: bytes[],
    vcDataList: bytes[],
    signatures: bytes[],
    verificationMethodIds: string[]
  ): bytes {
    assert(this.isActive.value);
    assert(vcHashes.length === vcDataList.length);
    assert(vcHashes.length === signatures.length);
    assert(vcHashes.length === verificationMethodIds.length);
    
    let results = '';
    
    // Limit to 5 VCs for gas efficiency
    for (let i = 0; i < 5 && i < vcHashes.length; i++) {
      const result = this.verifyVC(
        vcHashes[i],
        vcDataList[i],
        signatures[i],
        verificationMethodIds[i]
      );
      
      const resultCode = result.isValid ? '1' : '0';
      results = results + resultCode + ',';
    }
    
    return results;
  }

  /**
   * Verify VC against specific policy
   */
  verifyVCWithPolicy(
    vcHash: bytes,
    vcData: bytes,
    signature: bytes,
    verificationMethodId: string,
    policyData: bytes
  ): boolean {
    assert(this.isActive.value);
    
    const policy = this.decodeVerificationPolicy(policyData);
    
    // Get basic verification result
    const result = this.verifyVC(vcHash, vcData, signature, verificationMethodId);
    
    // Apply policy-specific checks
    if (policy.requireValidSignature && !result.signatureValid) {
      return false;
    }
    
    if (policy.requireNonExpired && !result.notExpired) {
      return false;
    }
    
    if (policy.requireNonRevoked && !result.notRevoked) {
      return false;
    }
    
    // Additional policy checks would go here
    
    return result.isValid;
  }

  /**
   * Quick status check for a VC
   */
  quickVerifyVC(vcHash: bytes): uint64 {
    assert(this.isActive.value);
    
    // Just check status in registry without full verification
    return this.getVCStatusFromRegistry(vcHash);
  }

  /**
   * Verify presentation of multiple VCs
   */
  verifyPresentation(
    vcHashes: bytes[],
    presentationSignature: bytes,
    holderDID: string,
    verificationMethodId: string
  ): boolean {
    assert(this.isActive.value);
    
    // Verify all VCs in the presentation are valid
    for (let i = 0; i < vcHashes.length && i < 10; i++) {
      const status = this.quickVerifyVC(vcHashes[i]);
      if (status !== 0) { // Not valid
        return false;
      }
    }
    
    // Verify presentation signature
    const presentationData = this.encodePresentationData(vcHashes);
    return this.verifyPresentationSignature(
      holderDID,
      presentationData,
      presentationSignature,
      verificationMethodId
    );
  }

  // Private helper methods

  /**
   * Get VC status from registry contract
   */
  private getVCStatusFromRegistry(vcHash: bytes): uint64 {
    const result = sendAppCall({
      appID: this.vcRegistryAppId.value,
      appArgs: ['verifyVC', vcHash],
    });
    
    return result;
  }

  /**
   * Get VC metadata from registry contract
   */
  private getVCMetadataFromRegistry(vcHash: bytes): bytes {
    const result = sendAppCall({
      appID: this.vcRegistryAppId.value,
      appArgs: ['getVCMetadata', vcHash],
    });
    
    return result;
  }

  /**
   * Verify VC signature using DID
   */
  private verifyVCSignature(
    issuerDID: string,
    vcData: bytes,
    signature: bytes,
    verificationMethodId: string
  ): boolean {
    // Call DID registry to verify signature
    const result = sendAppCall({
      appID: this.didRegistryAppId.value,
      appArgs: ['verifyDIDSignature', issuerDID, signature, vcData, verificationMethodId],
    });
    
    return result === 1;
  }

  /**
   * Verify presentation signature
   */
  private verifyPresentationSignature(
    holderDID: string,
    presentationData: bytes,
    signature: bytes,
    verificationMethodId: string
  ): boolean {
    const result = sendAppCall({
      appID: this.didRegistryAppId.value,
      appArgs: ['verifyDIDSignature', holderDID, signature, presentationData, verificationMethodId],
    });
    
    return result === 1;
  }

  /**
   * Check if issuer is trusted
   */
  private isIssuerTrusted(issuer: Address): boolean {
    const trustedKey = this.generateTrustedIssuerKey(issuer);
    
    if (this.trustedIssuers(trustedKey).exists) {
      return this.trustedIssuers(trustedKey).value;
    }
    
    // If no explicit trust setting, default to true
    return true;
  }

  /**
   * Extract issuer address from metadata
   */
  private extractIssuerFromMetadata(metadata: bytes): Address {
    // Parse metadata format: issuerDID|subjectDID|type|issued|expires|status|revoked|issuer|schema
    // Return the issuer address (8th field)
    return this.verifierOwner.value; // Simplified - should parse metadata
  }

  /**
   * Extract expiration date from metadata
   */
  private extractExpirationFromMetadata(metadata: bytes): uint64 {
    // Parse metadata and extract expiration date (5th field)
    return globals.latestTimestamp + 3600; // Simplified - should parse metadata
  }

  /**
   * Extract issuer DID from metadata
   */
  private extractIssuerDIDFromMetadata(metadata: bytes): string {
    // Parse metadata and extract issuer DID (1st field)
    return 'did:algo:example'; // Simplified - should parse metadata
  }

  /**
   * Encode verification policy
   */
  private encodeVerificationPolicy(
    requireValidSignature: boolean,
    requireNonExpired: boolean,
    requireNonRevoked: boolean,
    requireSchemaValidation: boolean,
    trustedIssuers: string,
    acceptedCredentialTypes: string
  ): bytes {
    return (requireValidSignature ? '1' : '0') + '|' +
           (requireNonExpired ? '1' : '0') + '|' +
           (requireNonRevoked ? '1' : '0') + '|' +
           (requireSchemaValidation ? '1' : '0') + '|' +
           trustedIssuers + '|' +
           acceptedCredentialTypes;
  }

  /**
   * Decode verification policy
   */
  private decodeVerificationPolicy(policyData: bytes): VerificationPolicy {
    // Simplified decoding - in practice, parse the policy data
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
   * Encode presentation data
   */
  private encodePresentationData(vcHashes: bytes[]): bytes {
    let data = '';
    for (let i = 0; i < vcHashes.length; i++) {
      data = data + vcHashes[i] + ',';
    }
    return data;
  }

  /**
   * Generate trusted issuer key
   */
  private generateTrustedIssuerKey(issuer: Address): bytes {
    return 'trusted:' + issuer;
  }

  // Admin functions

  /**
   * Add trusted issuer
   */
  addTrustedIssuer(issuer: Address): void {
    assert(this.txn.sender === this.verifierOwner.value);
    
    const trustedKey = this.generateTrustedIssuerKey(issuer);
    this.trustedIssuers(trustedKey).value = true;
  }

  /**
   * Remove trusted issuer
   */
  removeTrustedIssuer(issuer: Address): void {
    assert(this.txn.sender === this.verifierOwner.value);
    
    const trustedKey = this.generateTrustedIssuerKey(issuer);
    this.trustedIssuers(trustedKey).value = false;
  }

  /**
   * Update verification policy
   */
  updateVerificationPolicy(policyData: bytes): void {
    assert(this.txn.sender === this.verifierOwner.value);
    this.defaultPolicy.value = policyData;
  }

  /**
   * Update registry app IDs
   */
  updateRegistryAppIds(vcRegistryAppId: uint64, didRegistryAppId: uint64): void {
    assert(this.txn.sender === this.verifierOwner.value);
    this.vcRegistryAppId.value = vcRegistryAppId;
    this.didRegistryAppId.value = didRegistryAppId;
  }

  /**
   * Activate/deactivate verifier
   */
  setVerifierStatus(active: boolean): void {
    assert(this.txn.sender === this.verifierOwner.value);
    this.isActive.value = active;
  }

  /**
   * Transfer verifier ownership
   */
  transferOwnership(newOwner: Address): void {
    assert(this.txn.sender === this.verifierOwner.value);
    this.verifierOwner.value = newOwner;
  }

  /**
   * Get verifier statistics
   */
  getVerifierStats(): bytes {
    const stats = itoa(this.totalVerifications.value) + '|' +
                 itoa(this.successfulVerifications.value) + '|' +
                 (this.isActive.value ? '1' : '0');
    return stats;
  }

  /**
   * Get verifier configuration
   */
  getVerifierConfig(): bytes {
    const config = itoa(this.vcRegistryAppId.value) + '|' +
                  itoa(this.didRegistryAppId.value) + '|' +
                  (this.isActive.value ? '1' : '0');
    return config;
  }
}