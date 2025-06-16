import { Contract } from '@algorandfoundation/tealscript';

// DID Document Structure for DIRS
interface DIDDocument {
  id: string;
  controller: Address;
  verificationMethods: VerificationMethod[];
  services: Service[];
  created: uint64;
  updated: uint64;
  version: uint64;
  status: uint64; // 0: Active, 1: Deactivated, 2: Revoked
  portabilityScore: uint64; // Measure of cross-platform compatibility
}

interface VerificationMethod {
  id: string;
  type: string;
  controller: Address;
  publicKeyBase58: string;
  purposes: string[]; // authentication, assertionMethod, keyAgreement, etc.
}

interface Service {
  id: string;
  type: string;
  serviceEndpoint: string;
  priority: uint64; // For service ordering
}

// DIRS Registry State
interface DIRSRegistryState {
  totalDIDs: uint64;
  registrationFee: uint64;
  updateFee: uint64;
  registryOwner: Address;
  isPaused: boolean;
  nexdenAssetId: uint64;
  interoperabilityEnabled: boolean;
  crossChainSupport: boolean;
}

export class DIDRegistry extends Contract {
  // Global state variables
  totalDIDs = GlobalStateKey<uint64>();
  registrationFee = GlobalStateKey<uint64>();
  updateFee = GlobalStateKey<uint64>();
  registryOwner = GlobalStateKey<Address>();
  isPaused = GlobalStateKey<boolean>();
  nexdenAssetId = GlobalStateKey<uint64>();
  interoperabilityEnabled = GlobalStateKey<boolean>();
  crossChainSupport = GlobalStateKey<boolean>();
  
  // DID storage - using boxes for large data storage
  didDocuments = BoxKey<bytes>(); // DID identifier -> DID Document (JSON)
  didControllers = BoxKey<Address>(); // DID identifier -> Controller address
  didVersions = BoxKey<uint64>(); // DID identifier -> Current version
  didStatus = BoxKey<uint64>(); // DID identifier -> Status
  didCreated = BoxKey<uint64>(); // DID identifier -> Creation timestamp
  didUpdated = BoxKey<uint64>(); // DID identifier -> Last update timestamp
  didPortabilityScore = BoxKey<uint64>(); // DID identifier -> Portability score
  
  // Self-sovereign identity features
  controllerDIDs = BoxKey<bytes>(); // Controller address -> List of DIDs
  didDelegations = BoxKey<bytes>(); // DID identifier -> Delegation permissions
  didRecoveryMethods = BoxKey<bytes>(); // DID identifier -> Recovery mechanisms
  
  // Interoperability and portability
  crossChainMappings = BoxKey<bytes>(); // DID identifier -> Cross-chain mappings
  portabilityProofs = BoxKey<bytes>(); // DID identifier -> Portability proofs
  interopServices = BoxKey<bytes>(); // Service type -> Interop configuration
  
  // Verification method storage
  verificationMethods = BoxKey<bytes>(); // DID + method ID -> Verification method data
  
  // Service endpoint storage with enhanced metadata
  serviceEndpoints = BoxKey<bytes>(); // DID + service ID -> Service data
  serviceMetadata = BoxKey<bytes>(); // DID + service ID -> Service metadata

  /**
   * Initialize the DIRS DID Registry
   */
  createApplication(
    registrationFee: uint64,
    updateFee: uint64,
    nexdenAssetId: uint64
  ): void {
    this.registryOwner.value = this.txn.sender;
    this.registrationFee.value = registrationFee;
    this.updateFee.value = updateFee;
    this.nexdenAssetId.value = nexdenAssetId;
    this.totalDIDs.value = 0;
    this.isPaused.value = false;
    this.interoperabilityEnabled.value = true;
    this.crossChainSupport.value = true;
  }

  /**
   * Register a new self-sovereign DID
   */
  registerDID(
    didIdentifier: string,
    didDocument: string,
    recoveryMethods: string,
    portabilityProof: string,
    payment: AssetTransferTxn
  ): void {
    // Verify registry is not paused
    assert(!this.isPaused.value);
    
    // Verify payment for registration fee
    assert(payment.assetReceiver === this.app.address);
    assert(payment.xferAsset === this.nexdenAssetId.value);
    assert(payment.assetAmount >= this.registrationFee.value);
    assert(payment.sender === this.txn.sender);
    
    // Verify DID doesn't already exist
    const didKey = this.generateDIDKey(didIdentifier);
    assert(!this.didControllers(didKey).exists);
    
    // Generate full DID identifier with DIRS namespace
    const fullDID = this.generateFullDID(didIdentifier);
    
    // Store DID document and metadata
    this.didDocuments(didKey).value = didDocument;
    this.didControllers(didKey).value = this.txn.sender;
    this.didVersions(didKey).value = 1;
    this.didStatus(didKey).value = 0; // Active
    this.didCreated(didKey).value = globals.latestTimestamp;
    this.didUpdated(didKey).value = globals.latestTimestamp;
    
    // Store self-sovereign identity features
    this.didRecoveryMethods(didKey).value = recoveryMethods;
    this.portabilityProofs(didKey).value = portabilityProof;
    
    // Calculate and store portability score
    const portabilityScore = this.calculatePortabilityScore(didDocument, portabilityProof);
    this.didPortabilityScore(didKey).value = portabilityScore;
    
    // Update controller's DID list
    this.addDIDToController(this.txn.sender, fullDID);
    
    // Update total DIDs count
    this.totalDIDs.value = this.totalDIDs.value + 1;
  }

  /**
   * Update DID document with enhanced self-sovereign features
   */
  updateDID(
    didIdentifier: string,
    didDocument: string,
    updateType: string, // "document", "recovery", "delegation", "portability"
    updateData: string,
    payment: AssetTransferTxn
  ): void {
    // Verify registry is not paused
    assert(!this.isPaused.value);
    
    // Verify payment for update fee
    assert(payment.assetReceiver === this.app.address);
    assert(payment.xferAsset === this.nexdenAssetId.value);
    assert(payment.assetAmount >= this.updateFee.value);
    assert(payment.sender === this.txn.sender);
    
    const didKey = this.generateDIDKey(didIdentifier);
    
    // Verify DID exists and caller is authorized
    assert(this.didControllers(didKey).exists);
    assert(this.isAuthorizedToUpdate(didIdentifier, this.txn.sender));
    assert(this.didStatus(didKey).value === 0); // Must be active
    
    // Handle different update types
    if (updateType === 'document') {
      this.didDocuments(didKey).value = didDocument;
      // Recalculate portability score
      const portabilityProof = this.portabilityProofs(didKey).value;
      const newScore = this.calculatePortabilityScore(didDocument, portabilityProof);
      this.didPortabilityScore(didKey).value = newScore;
    } else if (updateType === 'recovery') {
      this.didRecoveryMethods(didKey).value = updateData;
    } else if (updateType === 'delegation') {
      this.didDelegations(didKey).value = updateData;
    } else if (updateType === 'portability') {
      this.portabilityProofs(didKey).value = updateData;
      // Recalculate portability score
      const document = this.didDocuments(didKey).value;
      const newScore = this.calculatePortabilityScore(document, updateData);
      this.didPortabilityScore(didKey).value = newScore;
    }
    
    // Update metadata
    this.didVersions(didKey).value = this.didVersions(didKey).value + 1;
    this.didUpdated(didKey).value = globals.latestTimestamp;
  }

  /**
   * Enable cross-chain DID mapping for portability
   */
  enableCrossChainMapping(
    didIdentifier: string,
    targetChain: string,
    targetDID: string,
    mappingProof: string,
    payment: AssetTransferTxn
  ): void {
    assert(this.crossChainSupport.value);
    
    // Verify payment and authorization
    assert(payment.assetReceiver === this.app.address);
    assert(payment.xferAsset === this.nexdenAssetId.value);
    assert(payment.assetAmount >= this.updateFee.value);
    assert(payment.sender === this.txn.sender);
    
    const didKey = this.generateDIDKey(didIdentifier);
    assert(this.didControllers(didKey).exists);
    assert(this.didControllers(didKey).value === this.txn.sender);
    
    // Store cross-chain mapping
    const mappingKey = this.generateCrossChainKey(didIdentifier, targetChain);
    const mappingData = this.encodeCrossChainMapping(targetDID, mappingProof, globals.latestTimestamp);
    this.crossChainMappings(mappingKey).value = mappingData;
    
    // Update portability score
    const currentScore = this.didPortabilityScore(didKey).value;
    this.didPortabilityScore(didKey).value = currentScore + 100; // Bonus for cross-chain support
  }

  /**
   * Delegate DID control permissions
   */
  delegateControl(
    didIdentifier: string,
    delegatee: Address,
    permissions: string,
    expirationTime: uint64,
    payment: AssetTransferTxn
  ): void {
    // Verify payment and authorization
    assert(payment.assetReceiver === this.app.address);
    assert(payment.xferAsset === this.nexdenAssetId.value);
    assert(payment.assetAmount >= this.updateFee.value);
    assert(payment.sender === this.txn.sender);
    
    const didKey = this.generateDIDKey(didIdentifier);
    assert(this.didControllers(didKey).exists);
    assert(this.didControllers(didKey).value === this.txn.sender);
    assert(expirationTime > globals.latestTimestamp);
    
    // Store delegation
    const delegationData = this.encodeDelegation(delegatee, permissions, expirationTime);
    this.didDelegations(didKey).value = delegationData;
    
    this.didVersions(didKey).value = this.didVersions(didKey).value + 1;
    this.didUpdated(didKey).value = globals.latestTimestamp;
  }

  /**
   * Recover DID control using recovery methods
   */
  recoverDID(
    didIdentifier: string,
    recoveryProof: string,
    newController: Address
  ): void {
    const didKey = this.generateDIDKey(didIdentifier);
    assert(this.didControllers(didKey).exists);
    
    // Verify recovery proof against stored recovery methods
    const recoveryMethods = this.didRecoveryMethods(didKey).value;
    assert(this.verifyRecoveryProof(recoveryProof, recoveryMethods));
    
    const fullDID = this.generateFullDID(didIdentifier);
    
    // Remove DID from old controller's list
    const oldController = this.didControllers(didKey).value;
    this.removeDIDFromController(oldController, fullDID);
    
    // Add DID to new controller's list
    this.addDIDToController(newController, fullDID);
    
    // Update controller
    this.didControllers(didKey).value = newController;
    this.didUpdated(didKey).value = globals.latestTimestamp;
    this.didVersions(didKey).value = this.didVersions(didKey).value + 1;
    
    // Clear delegations on recovery
    this.didDelegations(didKey).delete();
  }

  /**
   * Add enhanced verification method with purposes
   */
  addVerificationMethodWithPurposes(
    didIdentifier: string,
    methodId: string,
    methodType: string,
    publicKey: string,
    purposes: string,
    payment: AssetTransferTxn
  ): void {
    // Verify payment and authorization
    assert(payment.assetReceiver === this.app.address);
    assert(payment.xferAsset === this.nexdenAssetId.value);
    assert(payment.assetAmount >= this.updateFee.value);
    assert(payment.sender === this.txn.sender);
    
    const didKey = this.generateDIDKey(didIdentifier);
    assert(this.didControllers(didKey).exists);
    assert(this.isAuthorizedToUpdate(didIdentifier, this.txn.sender));
    assert(this.didStatus(didKey).value === 0);
    
    // Store enhanced verification method
    const methodKey = this.generateMethodKey(didIdentifier, methodId);
    const methodData = this.encodeEnhancedVerificationMethod(methodType, publicKey, purposes);
    this.verificationMethods(methodKey).value = methodData;
    
    // Update DID metadata
    this.didUpdated(didKey).value = globals.latestTimestamp;
    this.didVersions(didKey).value = this.didVersions(didKey).value + 1;
  }

  /**
   * Add service endpoint with enhanced metadata for interoperability
   */
  addInteroperableServiceEndpoint(
    didIdentifier: string,
    serviceId: string,
    serviceType: string,
    endpoint: string,
    metadata: string,
    priority: uint64,
    payment: AssetTransferTxn
  ): void {
    // Verify payment and authorization
    assert(payment.assetReceiver === this.app.address);
    assert(payment.xferAsset === this.nexdenAssetId.value);
    assert(payment.assetAmount >= this.updateFee.value);
    assert(payment.sender === this.txn.sender);
    
    const didKey = this.generateDIDKey(didIdentifier);
    assert(this.didControllers(didKey).exists);
    assert(this.isAuthorizedToUpdate(didIdentifier, this.txn.sender));
    assert(this.didStatus(didKey).value === 0);
    
    // Store service endpoint with enhanced data
    const serviceKey = this.generateServiceKey(didIdentifier, serviceId);
    const serviceData = this.encodeEnhancedService(serviceType, endpoint, priority);
    this.serviceEndpoints(serviceKey).value = serviceData;
    
    // Store service metadata separately for interoperability
    const metadataKey = this.generateServiceMetadataKey(didIdentifier, serviceId);
    this.serviceMetadata(metadataKey).value = metadata;
    
    // Update DID metadata
    this.didUpdated(didKey).value = globals.latestTimestamp;
    this.didVersions(didKey).value = this.didVersions(didKey).value + 1;
  }

  /**
   * Get DID with portability information
   */
  resolveDIDWithPortability(didIdentifier: string): bytes {
    const didKey = this.generateDIDKey(didIdentifier);
    assert(this.didControllers(didKey).exists);
    
    const document = this.didDocuments(didKey).value;
    const portabilityScore = this.didPortabilityScore(didKey).value;
    const portabilityProof = this.portabilityProofs(didKey).value;
    
    // Encode enhanced resolution result
    return this.encodePortableResolution(document, portabilityScore, portabilityProof);
  }

  /**
   * Get cross-chain mappings for a DID
   */
  getCrossChainMappings(didIdentifier: string): bytes {
    const didKey = this.generateDIDKey(didIdentifier);
    assert(this.didControllers(didKey).exists);
    
    // Return all cross-chain mappings for this DID
    // In practice, would iterate through known chains
    const mappingKey = this.generateCrossChainKey(didIdentifier, 'ethereum');
    if (this.crossChainMappings(mappingKey).exists) {
      return this.crossChainMappings(mappingKey).value;
    }
    
    return '';
  }

  /**
   * Verify if an address is authorized to update a DID
   */
  private isAuthorizedToUpdate(didIdentifier: string, caller: Address): boolean {
    const didKey = this.generateDIDKey(didIdentifier);
    
    // Check if caller is the controller
    if (this.didControllers(didKey).value === caller) {
      return true;
    }
    
    // Check if caller has delegation permissions
    if (this.didDelegations(didKey).exists) {
      const delegationData = this.didDelegations(didKey).value;
      return this.checkDelegationPermissions(delegationData, caller);
    }
    
    return false;
  }

  /**
   * Calculate portability score based on DID features
   */
  private calculatePortabilityScore(didDocument: string, portabilityProof: string): uint64 {
    let score = 500; // Base score
    
    // Add points for various portability features
    // This is simplified - in practice would parse the document
    
    // Standard compliance
    score = score + 100;
    
    // Multiple verification methods
    score = score + 50;
    
    // Service endpoints
    score = score + 50;
    
    // Portability proof quality
    if (portabilityProof !== '') {
      score = score + 100;
    }
    
    // Interoperability features
    if (this.interoperabilityEnabled.value) {
      score = score + 100;
    }
    
    // Cap at 1000
    if (score > 1000) {
      score = 1000;
    }
    
    return score;
  }

  /**
   * Verify recovery proof against recovery methods
   */
  private verifyRecoveryProof(recoveryProof: string, recoveryMethods: string): boolean {
    // Simplified verification - in practice would implement proper cryptographic verification
    return recoveryProof !== '' && recoveryMethods !== '';
  }

  /**
   * Check delegation permissions
   */
  private checkDelegationPermissions(delegationData: string, caller: Address): boolean {
    // Parse delegation data and check permissions
    // Simplified implementation
    return true;
  }

  // Enhanced encoding methods

  /**
   * Encode enhanced verification method with purposes
   */
  private encodeEnhancedVerificationMethod(
    methodType: string,
    publicKey: string,
    purposes: string
  ): bytes {
    return methodType + '|' + publicKey + '|' + purposes;
  }

  /**
   * Encode enhanced service with priority and metadata
   */
  private encodeEnhancedService(
    serviceType: string,
    endpoint: string,
    priority: uint64
  ): bytes {
    return serviceType + '|' + endpoint + '|' + itoa(priority);
  }

  /**
   * Encode cross-chain mapping
   */
  private encodeCrossChainMapping(
    targetDID: string,
    mappingProof: string,
    timestamp: uint64
  ): bytes {
    return targetDID + '|' + mappingProof + '|' + itoa(timestamp);
  }

  /**
   * Encode delegation information
   */
  private encodeDelegation(
    delegatee: Address,
    permissions: string,
    expirationTime: uint64
  ): bytes {
    return delegatee + '|' + permissions + '|' + itoa(expirationTime);
  }

  /**
   * Encode portable resolution result
   */
  private encodePortableResolution(
    document: string,
    portabilityScore: uint64,
    portabilityProof: string
  ): bytes {
    return document + '|PORTABILITY|' + itoa(portabilityScore) + '|' + portabilityProof;
  }

  // Enhanced key generation methods

  /**
   * Generate cross-chain mapping key
   */
  private generateCrossChainKey(didIdentifier: string, targetChain: string): bytes {
    return 'crosschain:' + didIdentifier + ':' + targetChain;
  }

  /**
   * Generate service metadata key
   */
  private generateServiceMetadataKey(didIdentifier: string, serviceId: string): bytes {
    return 'servicemeta:' + didIdentifier + ':' + serviceId;
  }

  // Existing helper methods (updated for DIRS)
  
  private generateDIDKey(didIdentifier: string): bytes {
    return 'dirs:did:' + didIdentifier;
  }

  private generateFullDID(didIdentifier: string): string {
    return 'did:dirs:' + didIdentifier;
  }

  private generateMethodKey(didIdentifier: string, methodId: string): bytes {
    return 'method:' + didIdentifier + ':' + methodId;
  }

  private generateServiceKey(didIdentifier: string, serviceId: string): bytes {
    return 'service:' + didIdentifier + ':' + serviceId;
  }

  private generateControllerKey(controller: Address): bytes {
    return 'controller:' + controller;
  }

  private addDIDToController(controller: Address, did: string): void {
    const controllerKey = this.generateControllerKey(controller);
    
    if (this.controllerDIDs(controllerKey).exists) {
      const currentDIDs = this.controllerDIDs(controllerKey).value;
      this.controllerDIDs(controllerKey).value = currentDIDs + ',' + did;
    } else {
      this.controllerDIDs(controllerKey).value = did;
    }
  }

  private removeDIDFromController(controller: Address, did: string): void {
    const controllerKey = this.generateControllerKey(controller);
    
    if (this.controllerDIDs(controllerKey).exists) {
      const currentDIDs = this.controllerDIDs(controllerKey).value;
      // Simple removal - in production, implement proper string manipulation
      this.controllerDIDs(controllerKey).value = currentDIDs;
    }
  }

  // Admin functions for DIRS

  /**
   * Enable/disable interoperability features
   */
  setInteroperabilityStatus(enabled: boolean): void {
    assert(this.txn.sender === this.registryOwner.value);
    this.interoperabilityEnabled.value = enabled;
  }

  /**
   * Enable/disable cross-chain support
   */
  setCrossChainSupport(enabled: boolean): void {
    assert(this.txn.sender === this.registryOwner.value);
    this.crossChainSupport.value = enabled;
  }

  /**
   * Register interoperability service configuration
   */
  registerInteropService(
    serviceType: string,
    configuration: string,
    payment: AssetTransferTxn
  ): void {
    assert(this.txn.sender === this.registryOwner.value);
    assert(payment.assetReceiver === this.app.address);
    assert(payment.xferAsset === this.nexdenAssetId.value);
    
    const serviceKey = 'interop:' + serviceType;
    this.interopServices(serviceKey).value = configuration;
  }

  /**
   * Get DIRS registry statistics
   */
  getDIRSStats(): bytes {
    const stats = itoa(this.totalDIDs.value) + '|' + 
                 itoa(this.registrationFee.value) + '|' + 
                 itoa(this.updateFee.value) + '|' + 
                 (this.isPaused.value ? '1' : '0') + '|' +
                 (this.interoperabilityEnabled.value ? '1' : '0') + '|' +
                 (this.crossChainSupport.value ? '1' : '0');
    return stats;
  }

  // Standard admin functions
  updateFees(newRegistrationFee: uint64, newUpdateFee: uint64): void {
    assert(this.txn.sender === this.registryOwner.value);
    this.registrationFee.value = newRegistrationFee;
    this.updateFee.value = newUpdateFee;
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