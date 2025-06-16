import { Algodv2, Account, mnemonicToSecretKey } from 'algosdk';
import { DIDRegistryClient, DIDRegistryConfig, DIDDocument, VerificationMethod, Service } from './DIDRegistryClient';
import { NexDenASA } from './NexDen';

/**
 * Comprehensive example of DID anchoring and resolution on Algorand
 */
export async function didRegistryExample() {
  // Initialize Algod client
  const algodClient = new Algodv2(
    'your-api-token',
    'https://testnet-api.algonode.cloud',
    443
  );

  // Create or import accounts
  const adminAccount = Account.generate(); // Registry admin
  const userAccount = Account.generate(); // DID owner
  const serviceAccount = Account.generate(); // Service provider

  console.log('Admin Address:', adminAccount.addr);
  console.log('User Address:', userAccount.addr);
  console.log('Service Address:', serviceAccount.addr);

  try {
    // Step 1: Create NEXDEN token for fees
    console.log('\n=== Creating NEXDEN Token ===');
    const nexDenASA = new NexDenASA(algodClient, adminAccount);
    const nexdenAssetId = await nexDenASA.createASA({
      total: 1000000000, // 1 billion tokens
      decimals: 6,
      assetName: 'NexDentify Token',
      unitName: 'NEXDEN',
    });

    // Step 2: Deploy DID Registry
    console.log('\n=== Deploying DID Registry ===');
    const didRegistry = new DIDRegistryClient(algodClient);
    
    const registryConfig: DIDRegistryConfig = {
      registrationFee: 1000000, // 1 NEXDEN
      updateFee: 500000, // 0.5 NEXDEN
      nexdenAssetId: nexdenAssetId,
    };

    const { appId, appAddress } = await didRegistry.deploy(adminAccount, registryConfig);

    // Step 3: Users opt into NEXDEN token
    console.log('\n=== User Opt-ins ===');
    await nexDenASA.optIn(userAccount, nexdenAssetId);
    await nexDenASA.optIn(serviceAccount, nexdenAssetId);

    // Step 4: Distribute NEXDEN tokens for fees
    console.log('\n=== Distributing NEXDEN Tokens ===');
    await nexDenASA.transfer(adminAccount, userAccount.addr, 10000000, nexdenAssetId); // 10 NEXDEN
    await nexDenASA.transfer(adminAccount, serviceAccount.addr, 10000000, nexdenAssetId); // 10 NEXDEN

    // Step 5: Create and register DIDs
    console.log('\n=== Registering DIDs ===');
    
    // User DID
    const userDIDIdentifier = 'user-' + userAccount.addr.substring(0, 8);
    const userVerificationMethods: VerificationMethod[] = [
      {
        id: 'key-1',
        type: 'Ed25519VerificationKey2020',
        controller: `did:algo:${userDIDIdentifier}`,
        publicKeyBase58: 'H3C2AVvLMv6gmMNam3uVAjZpfkcJCwDwnZn6z3wXmqPV', // Example key
      }
    ];

    const userServices: Service[] = [
      {
        id: 'dental-records',
        type: 'DentalRecordService',
        serviceEndpoint: 'https://nexdentify.com/records/' + userAccount.addr,
      }
    ];

    const userDIDDocument = didRegistry.createDIDDocument(
      userDIDIdentifier,
      userAccount.addr,
      userVerificationMethods,
      userServices
    );

    await didRegistry.registerDID(
      userAccount,
      userDIDIdentifier,
      userDIDDocument,
      nexdenAssetId,
      registryConfig.registrationFee
    );

    // Service Provider DID
    const serviceDIDIdentifier = 'service-' + serviceAccount.addr.substring(0, 8);
    const serviceVerificationMethods: VerificationMethod[] = [
      {
        id: 'key-1',
        type: 'Ed25519VerificationKey2020',
        controller: `did:algo:${serviceDIDIdentifier}`,
        publicKeyBase58: 'GKot5hBsd81kMupNCXHaqbhv3huEbxAFMLnpcX2hniwn', // Example key
      }
    ];

    const serviceServices: Service[] = [
      {
        id: 'dental-clinic',
        type: 'DentalClinicService',
        serviceEndpoint: 'https://clinic.example.com/api',
      },
      {
        id: 'appointment-booking',
        type: 'AppointmentService',
        serviceEndpoint: 'https://clinic.example.com/appointments',
      }
    ];

    const serviceDIDDocument = didRegistry.createDIDDocument(
      serviceDIDIdentifier,
      serviceAccount.addr,
      serviceVerificationMethods,
      serviceServices
    );

    await didRegistry.registerDID(
      serviceAccount,
      serviceDIDIdentifier,
      serviceDIDDocument,
      nexdenAssetId,
      registryConfig.registrationFee
    );

    // Step 6: Resolve DIDs
    console.log('\n=== Resolving DIDs ===');
    
    const resolvedUserDID = await didRegistry.resolveDID(userDIDIdentifier);
    console.log('Resolved User DID:', JSON.stringify(resolvedUserDID, null, 2));

    const resolvedServiceDID = await didRegistry.resolveDID(serviceDIDIdentifier);
    console.log('Resolved Service DID:', JSON.stringify(resolvedServiceDID, null, 2));

    // Step 7: Get DID metadata
    console.log('\n=== DID Metadata ===');
    
    const userMetadata = await didRegistry.getDIDMetadata(userDIDIdentifier);
    console.log('User DID Metadata:', userMetadata);

    const serviceMetadata = await didRegistry.getDIDMetadata(serviceDIDIdentifier);
    console.log('Service DID Metadata:', serviceMetadata);

    // Step 8: Update DID documents
    console.log('\n=== Updating DID Documents ===');
    
    // Add new verification method to user DID
    await didRegistry.addVerificationMethod(
      userAccount,
      userDIDIdentifier,
      'key-2',
      'Ed25519VerificationKey2020',
      'DhgvwvnV9g1WkiWUnBiYykJZbllSyVn7UbWuF9gEvHiN', // Example key
      nexdenAssetId,
      registryConfig.updateFee
    );

    // Add new service endpoint to service DID
    await didRegistry.addServiceEndpoint(
      serviceAccount,
      serviceDIDIdentifier,
      'emergency-contact',
      'EmergencyContactService',
      'https://clinic.example.com/emergency',
      nexdenAssetId,
      registryConfig.updateFee
    );

    // Step 9: Demonstrate DID lifecycle operations
    console.log('\n=== DID Lifecycle Operations ===');
    
    // Get controller DIDs
    const userControlledDIDs = await didRegistry.getControllerDIDs(userAccount.addr);
    console.log('DIDs controlled by user:', userControlledDIDs);

    const serviceControlledDIDs = await didRegistry.getControllerDIDs(serviceAccount.addr);
    console.log('DIDs controlled by service:', serviceControlledDIDs);

    // Deactivate and reactivate DID
    await didRegistry.deactivateDID(userAccount, userDIDIdentifier);
    console.log('User DID deactivated');

    await didRegistry.reactivateDID(
      userAccount,
      userDIDIdentifier,
      nexdenAssetId,
      registryConfig.updateFee
    );
    console.log('User DID reactivated');

    // Step 10: Registry statistics
    console.log('\n=== Registry Statistics ===');
    
    const registryStats = await didRegistry.getRegistryStats();
    console.log('Registry Stats:', registryStats);

    console.log('\n=== DID Registry Example Completed Successfully ===');

  } catch (error) {
    console.error('Error in DID registry example:', error);
    throw error;
  }
}

/**
 * Advanced DID scenarios
 */
export async function advancedDIDScenarios() {
  console.log('\n=== Advanced DID Scenarios ===');

  // Scenario 1: Multi-signature DID control
  console.log('\n--- Scenario 1: Multi-signature DIDs ---');
  
  // Scenario 2: DID delegation and authorization
  console.log('\n--- Scenario 2: DID Delegation ---');
  
  // Scenario 3: Cross-chain DID resolution
  console.log('\n--- Scenario 3: Cross-chain Resolution ---');
  
  // Scenario 4: DID-based authentication
  console.log('\n--- Scenario 4: DID Authentication ---');
}

/**
 * DID-based authentication example
 */
export async function didAuthenticationExample() {
  console.log('\n=== DID Authentication Example ===');
  
  // Example of using DIDs for authentication in NexDentify platform
  // 1. Patient presents DID
  // 2. Clinic verifies DID authenticity
  // 3. Patient proves control of DID through signature
  // 4. Access granted to dental records
}

/**
 * Dental record anchoring with DIDs
 */
export async function dentalRecordDIDExample() {
  console.log('\n=== Dental Record DID Integration ===');
  
  // Example of anchoring dental records to DIDs
  // 1. Patient DID contains reference to dental record service
  // 2. Dental records are cryptographically linked to patient DID
  // 3. Access control based on DID verification methods
  // 4. Audit trail of record access using DID signatures
}

/**
 * Clinic network DID management
 */
export async function clinicNetworkDIDExample() {
  console.log('\n=== Clinic Network DID Management ===');
  
  // Example of managing clinic network with DIDs
  // 1. Each clinic has a DID with service endpoints
  // 2. Practitioners have DIDs linked to clinic DIDs
  // 3. Patients can discover and verify clinic credentials
  // 4. Inter-clinic referrals using DID-based trust
}

// Export for use in other modules
export { DIDRegistryClient, DIDRegistryConfig };