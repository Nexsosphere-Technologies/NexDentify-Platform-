import { Contract } from '@algorandfoundation/tealscript';

// DID Document Structure
interface DIDDocument {
  id: string;
  controller: Address;
  verificationMethods: VerificationMethod[];
  services: Service[];
  created: uint64;
  updated: uint64;
  version: uint64;
  status: uint64; // 0: Active, 1: Deactivated, 2: Revoked
}

interface VerificationMethod {
  id: string;
  type: string;
  controller: Address;
  publicKeyBase58: string;
}

interface Service {
  id: string;
  type: string;
  serviceEndpoint: string;
}

// DID Registry State
interface DIDRegistryState {
  totalDIDs: uint64;
  registrationFee: uint64;
  updateFee: uint64;
  registryOwner: Address;
  isPaused: boolean;
  nexdenAssetId: uint64;
}

export class DIDRegistry extends Contract {
  // Global state variables
  totalDIDs = GlobalStateKey<uint64>();
  registrationFee = GlobalStateKey<uint64>();
  updateFee = GlobalStateKey<uint64>();
  registryOwner = GlobalStateKey<Address>();
  isPaused = GlobalStateKey<boolean>();
  nexdenAssetId = GlobalStateKey<uint64>();
  
  // DID storage - using boxes for large data storage
  didDocuments = BoxKey<bytes>(); // DID identifier -> DID Document (JSON)
  didControllers = BoxKey<Address>(); // DID identifier -> Controller address
  didVersions = BoxKey<uint64>(); // DID identifier -> Current version
  didStatus = BoxKey<uint64>(); // DID identifier -> Status (0: Active, 1: Deactivated, 2: Revoked)
  didCreated = BoxKey<uint64>(); // DID identifier -> Creation timestamp
  didUpdated = BoxKey<uint64>(); // DID identifier -> Last update timestamp
  
  // Controller mappings
  controllerDIDs = BoxKey<bytes>(); // Controller address -> List of DIDs (comma-separated)
  
  // Verification method storage
  verificationMethods = BoxKey<bytes>(); // DID + method ID -> Verification method data
  
  // Service endpoint storage
  serviceEndpoints = BoxKey<bytes>(); // DID + service ID -> Service data

  /**
   * Initialize the DID Registry
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
  }

  /**
   * Register a new DID
   */
  registerDID(
    didIdentifier: string,
    didDocument: string,
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
    
    // Generate full DID identifier
    const fullDID = this.generateFullDID(didIdentifier);
    
    // Store DID document and metadata
    this.didDocuments(didKey).value = didDocument;
    this.didControllers(didKey).value = this.txn.sender;
    this.didVersions(didKey).value = 1;
    this.didStatus(didKey).value = 0; // Active
    this.didCreated(didKey).value = globals.latestTimestamp;
    this.didUpdated(didKey).value = globals.latestTimestamp;
    
    // Update controller's DID list
    this.addDIDToController(this.txn.sender, fullDID);
    
    // Update total DIDs count
    this.totalDIDs.value = this.totalDIDs.value + 1;
  }

  /**
   * Update an existing DID document
   */
  updateDID(
    didIdentifier: string,
    didDocument: string,
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
    
    // Verify DID exists and caller is the controller
    assert(this.didControllers(didKey).exists);
    assert(this.didControllers(didKey).value === this.txn.sender);
    assert(this.didStatus(didKey).value === 0); // Must be active
    
    // Update DID document
    this.didDocuments(didKey).value = didDocument;
    this.didVersions(didKey).value = this.didVersions(didKey).value + 1;
    this.didUpdated(didKey).value = globals.latestTimestamp;
  }

  /**
   * Deactivate a DID
   */
  deactivateDID(didIdentifier: string): void {
    const didKey = this.generateDIDKey(didIdentifier);
    
    // Verify DID exists and caller is the controller
    assert(this.didControllers(didKey).exists);
    assert(this.didControllers(didKey).value === this.txn.sender);
    assert(this.didStatus(didKey).value === 0); // Must be active
    
    // Deactivate DID
    this.didStatus(didKey).value = 1; // Deactivated
    this.didUpdated(didKey).value = globals.latestTimestamp;
    this.didVersions(didKey).value = this.didVersions(didKey).value + 1;
  }

  /**
   * Reactivate a deactivated DID
   */
  reactivateDID(
    didIdentifier: string,
    payment: AssetTransferTxn
  ): void {
    // Verify payment for update fee
    assert(payment.assetReceiver === this.app.address);
    assert(payment.xferAsset === this.nexdenAssetId.value);
    assert(payment.assetAmount >= this.updateFee.value);
    assert(payment.sender === this.txn.sender);
    
    const didKey = this.generateDIDKey(didIdentifier);
    
    // Verify DID exists and caller is the controller
    assert(this.didControllers(didKey).exists);
    assert(this.didControllers(didKey).value === this.txn.sender);
    assert(this.didStatus(didKey).value === 1); // Must be deactivated
    
    // Reactivate DID
    this.didStatus(didKey).value = 0; // Active
    this.didUpdated(didKey).value = globals.latestTimestamp;
    this.didVersions(didKey).value = this.didVersions(didKey).value + 1;
  }

  /**
   * Transfer DID control to another address
   */
  transferDIDControl(
    didIdentifier: string,
    newController: Address,
    payment: AssetTransferTxn
  ): void {
    // Verify payment for update fee
    assert(payment.assetReceiver === this.app.address);
    assert(payment.xferAsset === this.nexdenAssetId.value);
    assert(payment.assetAmount >= this.updateFee.value);
    assert(payment.sender === this.txn.sender);
    
    const didKey = this.generateDIDKey(didIdentifier);
    
    // Verify DID exists and caller is the controller
    assert(this.didControllers(didKey).exists);
    assert(this.didControllers(didKey).value === this.txn.sender);
    assert(this.didStatus(didKey).value === 0); // Must be active
    
    const fullDID = this.generateFullDID(didIdentifier);
    
    // Remove DID from old controller's list
    this.removeDIDFromController(this.txn.sender, fullDID);
    
    // Add DID to new controller's list
    this.addDIDToController(newController, fullDID);
    
    // Update controller
    this.didControllers(didKey).value = newController;
    this.didUpdated(didKey).value = globals.latestTimestamp;
    this.didVersions(didKey).value = this.didVersions(didKey).value + 1;
  }

  /**
   * Add verification method to DID
   */
  addVerificationMethod(
    didIdentifier: string,
    methodId: string,
    methodType: string,
    publicKey: string,
    payment: AssetTransferTxn
  ): void {
    // Verify payment for update fee
    assert(payment.assetReceiver === this.app.address);
    assert(payment.xferAsset === this.nexdenAssetId.value);
    assert(payment.assetAmount >= this.updateFee.value);
    assert(payment.sender === this.txn.sender);
    
    const didKey = this.generateDIDKey(didIdentifier);
    
    // Verify DID exists and caller is the controller
    assert(this.didControllers(didKey).exists);
    assert(this.didControllers(didKey).value === this.txn.sender);
    assert(this.didStatus(didKey).value === 0); // Must be active
    
    // Store verification method
    const methodKey = this.generateMethodKey(didIdentifier, methodId);
    const methodData = this.encodeVerificationMethod(methodType, publicKey);
    this.verificationMethods(methodKey).value = methodData;
    
    // Update DID metadata
    this.didUpdated(didKey).value = globals.latestTimestamp;
    this.didVersions(didKey).value = this.didVersions(didKey).value + 1;
  }

  /**
   * Remove verification method from DID
   */
  removeVerificationMethod(
    didIdentifier: string,
    methodId: string,
    payment: AssetTransferTxn
  ): void {
    // Verify payment for update fee
    assert(payment.assetReceiver === this.app.address);
    assert(payment.xferAsset === this.nexdenAssetId.value);
    assert(payment.assetAmount >= this.updateFee.value);
    assert(payment.sender === this.txn.sender);
    
    const didKey = this.generateDIDKey(didIdentifier);
    
    // Verify DID exists and caller is the controller
    assert(this.didControllers(didKey).exists);
    assert(this.didControllers(didKey).value === this.txn.sender);
    assert(this.didStatus(didKey).value === 0); // Must be active
    
    // Remove verification method
    const methodKey = this.generateMethodKey(didIdentifier, methodId);
    this.verificationMethods(methodKey).delete();
    
    // Update DID metadata
    this.didUpdated(didKey).value = globals.latestTimestamp;
    this.didVersions(didKey).value = this.didVersions(didKey).value + 1;
  }

  /**
   * Add service endpoint to DID
   */
  addServiceEndpoint(
    didIdentifier: string,
    serviceId: string,
    serviceType: string,
    endpoint: string,
    payment: AssetTransferTxn
  ): void {
    // Verify payment for update fee
    assert(payment.assetReceiver === this.app.address);
    assert(payment.xferAsset === this.nexdenAssetId.value);
    assert(payment.assetAmount >= this.updateFee.value);
    assert(payment.sender === this.txn.sender);
    
    const didKey = this.generateDIDKey(didIdentifier);
    
    // Verify DID exists and caller is the controller
    assert(this.didControllers(didKey).exists);
    assert(this.didControllers(didKey).value === this.txn.sender);
    assert(this.didStatus(didKey).value === 0); // Must be active
    
    // Store service endpoint
    const serviceKey = this.generateServiceKey(didIdentifier, serviceId);
    const serviceData = this.encodeService(serviceType, endpoint);
    this.serviceEndpoints(serviceKey).value = serviceData;
    
    // Update DID metadata
    this.didUpdated(didKey).value = globals.latestTimestamp;
    this.didVersions(didKey).value = this.didVersions(didKey).value + 1;
  }

  /**
   * Remove service endpoint from DID
   */
  removeServiceEndpoint(
    didIdentifier: string,
    serviceId: string,
    payment: AssetTransferTxn
  ): void {
    // Verify payment for update fee
    assert(payment.assetReceiver === this.app.address);
    assert(payment.xferAsset === this.nexdenAssetId.value);
    assert(payment.assetAmount >= this.updateFee.value);
    assert(payment.sender === this.txn.sender);
    
    const didKey = this.generateDIDKey(didIdentifier);
    
    // Verify DID exists and caller is the controller
    assert(this.didControllers(didKey).exists);
    assert(this.didControllers(didKey).value === this.txn.sender);
    assert(this.didStatus(didKey).value === 0); // Must be active
    
    // Remove service endpoint
    const serviceKey = this.generateServiceKey(didIdentifier, serviceId);
    this.serviceEndpoints(serviceKey).delete();
    
    // Update DID metadata
    this.didUpdated(didKey).value = globals.latestTimestamp;
    this.didVersions(didKey).value = this.didVersions(didKey).value + 1;
  }

  /**
   * Resolve DID document
   */
  resolveDID(didIdentifier: string): bytes {
    const didKey = this.generateDIDKey(didIdentifier);
    
    // Verify DID exists
    assert(this.didControllers(didKey).exists);
    
    return this.didDocuments(didKey).value;
  }

  /**
   * Get DID metadata
   */
  getDIDMetadata(didIdentifier: string): bytes {
    const didKey = this.generateDIDKey(didIdentifier);
    
    // Verify DID exists
    assert(this.didControllers(didKey).exists);
    
    // Encode metadata as JSON-like string
    const metadata = this.encodeDIDMetadata(
      this.didControllers(didKey).value,
      this.didVersions(didKey).value,
      this.didStatus(didKey).value,
      this.didCreated(didKey).value,
      this.didUpdated(didKey).value
    );
    
    return metadata;
  }

  /**
   * Get verification method
   */
  getVerificationMethod(didIdentifier: string, methodId: string): bytes {
    const methodKey = this.generateMethodKey(didIdentifier, methodId);
    
    // Verify method exists
    assert(this.verificationMethods(methodKey).exists);
    
    return this.verificationMethods(methodKey).value;
  }

  /**
   * Get service endpoint
   */
  getServiceEndpoint(didIdentifier: string, serviceId: string): bytes {
    const serviceKey = this.generateServiceKey(didIdentifier, serviceId);
    
    // Verify service exists
    assert(this.serviceEndpoints(serviceKey).exists);
    
    return this.serviceEndpoints(serviceKey).value;
  }

  /**
   * Get DIDs controlled by an address
   */
  getControllerDIDs(controller: Address): bytes {
    const controllerKey = this.generateControllerKey(controller);
    
    if (this.controllerDIDs(controllerKey).exists) {
      return this.controllerDIDs(controllerKey).value;
    } else {
      return '';
    }
  }

  // Helper methods

  /**
   * Generate DID key for storage
   */
  private generateDIDKey(didIdentifier: string): bytes {
    return 'did:' + didIdentifier;
  }

  /**
   * Generate full DID identifier
   */
  private generateFullDID(didIdentifier: string): string {
    return 'did:algo:' + didIdentifier;
  }

  /**
   * Generate verification method key
   */
  private generateMethodKey(didIdentifier: string, methodId: string): bytes {
    return 'method:' + didIdentifier + ':' + methodId;
  }

  /**
   * Generate service key
   */
  private generateServiceKey(didIdentifier: string, serviceId: string): bytes {
    return 'service:' + didIdentifier + ':' + serviceId;
  }

  /**
   * Generate controller key
   */
  private generateControllerKey(controller: Address): bytes {
    return 'controller:' + controller;
  }

  /**
   * Add DID to controller's list
   */
  private addDIDToController(controller: Address, did: string): void {
    const controllerKey = this.generateControllerKey(controller);
    
    if (this.controllerDIDs(controllerKey).exists) {
      const currentDIDs = this.controllerDIDs(controllerKey).value;
      this.controllerDIDs(controllerKey).value = currentDIDs + ',' + did;
    } else {
      this.controllerDIDs(controllerKey).value = did;
    }
  }

  /**
   * Remove DID from controller's list
   */
  private removeDIDFromController(controller: Address, did: string): void {
    const controllerKey = this.generateControllerKey(controller);
    
    if (this.controllerDIDs(controllerKey).exists) {
      const currentDIDs = this.controllerDIDs(controllerKey).value;
      // Simple removal - in production, implement proper string manipulation
      // This is a simplified version for demonstration
      this.controllerDIDs(controllerKey).value = currentDIDs; // TODO: Implement proper removal
    }
  }

  /**
   * Encode verification method data
   */
  private encodeVerificationMethod(methodType: string, publicKey: string): bytes {
    return methodType + '|' + publicKey;
  }

  /**
   * Encode service data
   */
  private encodeService(serviceType: string, endpoint: string): bytes {
    return serviceType + '|' + endpoint;
  }

  /**
   * Encode DID metadata
   */
  private encodeDIDMetadata(
    controller: Address,
    version: uint64,
    status: uint64,
    created: uint64,
    updated: uint64
  ): bytes {
    return controller + '|' + itoa(version) + '|' + itoa(status) + '|' + itoa(created) + '|' + itoa(updated);
  }

  // Admin functions

  /**
   * Update registry fees (admin only)
   */
  updateFees(newRegistrationFee: uint64, newUpdateFee: uint64): void {
    assert(this.txn.sender === this.registryOwner.value);
    
    this.registrationFee.value = newRegistrationFee;
    this.updateFee.value = newUpdateFee;
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
   * Revoke DID (admin only - for malicious DIDs)
   */
  revokeDID(didIdentifier: string): void {
    assert(this.txn.sender === this.registryOwner.value);
    
    const didKey = this.generateDIDKey(didIdentifier);
    assert(this.didControllers(didKey).exists);
    
    this.didStatus(didKey).value = 2; // Revoked
    this.didUpdated(didKey).value = globals.latestTimestamp;
    this.didVersions(didKey).value = this.didVersions(didKey).value + 1;
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
    const stats = itoa(this.totalDIDs.value) + '|' + 
                 itoa(this.registrationFee.value) + '|' + 
                 itoa(this.updateFee.value) + '|' + 
                 (this.isPaused.value ? '1' : '0');
    return stats;
  }
}