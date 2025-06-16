import { Algodv2, Account, mnemonicToSecretKey } from 'algosdk';
import { VCRegistryClient, VCRegistryConfig, VerifiableCredential } from './VCRegistryClient';
import { DIDRegistryClient } from './DIDRegistryClient';
import { NexDenASA } from './NexDen';

/**
 * Comprehensive example of VC anchoring and verification on Algorand
 */
export async function vcRegistryExample() {
  // Initialize Algod client
  const algodClient = new Algodv2(
    'your-api-token',
    'https://testnet-api.algonode.cloud',
    443
  );

  // Create or import accounts
  const adminAccount = Account.generate(); // Registry admin
  const clinicAccount = Account.generate(); // Dental clinic (issuer)
  const patientAccount = Account.generate(); // Patient (subject)
  const verifierAccount = Account.generate(); // Third-party verifier

  console.log('Admin Address:', adminAccount.addr);
  console.log('Clinic Address:', clinicAccount.addr);
  console.log('Patient Address:', patientAccount.addr);
  console.log('Verifier Address:', verifierAccount.addr);

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

    // Step 2: Deploy DID Registry (for issuer and subject DIDs)
    console.log('\n=== Deploying DID Registry ===');
    const didRegistry = new DIDRegistryClient(algodClient);
    const { appId: didAppId } = await didRegistry.deploy(adminAccount, {
      registrationFee: 1000000, // 1 NEXDEN
      updateFee: 500000, // 0.5 NEXDEN
      nexdenAssetId: nexdenAssetId,
    });

    // Step 3: Deploy VC Registry
    console.log('\n=== Deploying VC Registry ===');
    const vcRegistry = new VCRegistryClient(algodClient);
    
    const registryConfig: VCRegistryConfig = {
      registrationFee: 2000000, // 2 NEXDEN for VC anchoring
      revocationFee: 1000000, // 1 NEXDEN for revocation
      nexdenAssetId: nexdenAssetId,
    };

    const { appId, appAddress } = await vcRegistry.deploy(adminAccount, registryConfig);

    // Step 4: Users opt into NEXDEN token
    console.log('\n=== User Opt-ins ===');
    await nexDenASA.optIn(clinicAccount, nexdenAssetId);
    await nexDenASA.optIn(patientAccount, nexdenAssetId);
    await nexDenASA.optIn(verifierAccount, nexdenAssetId);

    // Step 5: Distribute NEXDEN tokens for fees
    console.log('\n=== Distributing NEXDEN Tokens ===');
    await nexDenASA.transfer(adminAccount, clinicAccount.addr, 20000000, nexdenAssetId); // 20 NEXDEN
    await nexDenASA.transfer(adminAccount, patientAccount.addr, 10000000, nexdenAssetId); // 10 NEXDEN

    // Step 6: Register DIDs for clinic and patient
    console.log('\n=== Registering DIDs ===');
    
    // Clinic DID
    const clinicDIDIdentifier = 'clinic-' + clinicAccount.addr.substring(0, 8);
    const clinicDIDDocument = didRegistry.createDIDDocument(
      clinicDIDIdentifier,
      clinicAccount.addr,
      [
        {
          id: 'key-1',
          type: 'Ed25519VerificationKey2020',
          controller: `did:algo:${clinicDIDIdentifier}`,
          publicKeyBase58: 'H3C2AVvLMv6gmMNam3uVAjZpfkcJCwDwnZn6z3wXmqPV',
        }
      ],
      [
        {
          id: 'dental-clinic',
          type: 'DentalClinicService',
          serviceEndpoint: 'https://clinic.example.com/api',
        }
      ]
    );

    await didRegistry.registerDID(
      clinicAccount,
      clinicDIDIdentifier,
      clinicDIDDocument,
      nexdenAssetId,
      1000000
    );

    // Patient DID
    const patientDIDIdentifier = 'patient-' + patientAccount.addr.substring(0, 8);
    const patientDIDDocument = didRegistry.createDIDDocument(
      patientDIDIdentifier,
      patientAccount.addr,
      [
        {
          id: 'key-1',
          type: 'Ed25519VerificationKey2020',
          controller: `did:algo:${patientDIDIdentifier}`,
          publicKeyBase58: 'GKot5hBsd81kMupNCXHaqbhv3huEbxAFMLnpcX2hniwn',
        }
      ],
      [
        {
          id: 'patient-records',
          type: 'PatientRecordService',
          serviceEndpoint: 'https://nexdentify.com/patient/' + patientAccount.addr,
        }
      ]
    );

    await didRegistry.registerDID(
      patientAccount,
      patientDIDIdentifier,
      patientDIDDocument,
      nexdenAssetId,
      1000000
    );

    // Step 7: Create and anchor dental credentials
    console.log('\n=== Creating Dental Credentials ===');
    
    // Dental examination credential
    const dentalExamData = {
      examDate: '2025-01-27',
      examType: 'Routine Checkup',
      findings: [
        {
          tooth: '1.1',
          condition: 'Healthy',
          notes: 'No cavities detected'
        },
        {
          tooth: '1.2',
          condition: 'Small cavity',
          treatment: 'Filling recommended'
        }
      ],
      recommendations: [
        'Regular brushing and flossing',
        'Schedule filling for tooth 1.2',
        'Return in 6 months for checkup'
      ],
      examiner: {
        name: 'Dr. Smith',
        license: 'DDS-12345',
        clinic: `did:algo:${clinicDIDIdentifier}`
      }
    };

    const dentalExamVC = vcRegistry.createDentalCredential(
      `did:algo:${clinicDIDIdentifier}`,
      `did:algo:${patientDIDIdentifier}`,
      dentalExamData
    );

    // Anchor the dental examination credential
    await vcRegistry.anchorVC(
      clinicAccount,
      dentalExamVC,
      nexdenAssetId,
      2000000
    );

    // Treatment credential
    const treatmentData = {
      treatmentDate: '2025-02-03',
      treatmentType: 'Dental Filling',
      treatedTooth: '1.2',
      materials: ['Composite resin'],
      procedure: 'Cavity preparation and composite filling',
      followUp: 'Check in 2 weeks',
      provider: {
        name: 'Dr. Smith',
        license: 'DDS-12345',
        clinic: `did:algo:${clinicDIDIdentifier}`
      }
    };

    const treatmentVC = vcRegistry.createDentalCredential(
      `did:algo:${clinicDIDIdentifier}`,
      `did:algo:${patientDIDIdentifier}`,
      treatmentData
    );

    await vcRegistry.anchorVC(
      clinicAccount,
      treatmentVC,
      nexdenAssetId,
      2000000
    );

    // Step 8: Verify credentials
    console.log('\n=== Verifying Credentials ===');
    
    const examVCHash = vcRegistry.calculateVCHash(dentalExamVC);
    const treatmentVCHash = vcRegistry.calculateVCHash(treatmentVC);

    console.log('Exam VC Hash:', examVCHash);
    console.log('Treatment VC Hash:', treatmentVCHash);

    // Verify individual credentials
    const examStatus = await vcRegistry.verifyVC(examVCHash);
    const treatmentStatus = await vcRegistry.verifyVC(treatmentVCHash);

    console.log('Exam VC Status:', this.getStatusString(examStatus));
    console.log('Treatment VC Status:', this.getStatusString(treatmentStatus));

    // Batch verify credentials
    const batchStatuses = await vcRegistry.batchVerifyVCs([examVCHash, treatmentVCHash]);
    console.log('Batch verification results:', batchStatuses.map(s => this.getStatusString(s)));

    // Step 9: Get credential metadata
    console.log('\n=== Credential Metadata ===');
    
    const examMetadata = await vcRegistry.getVCMetadata(examVCHash);
    console.log('Exam VC Metadata:', examMetadata);

    const treatmentMetadata = await vcRegistry.getVCMetadata(treatmentVCHash);
    console.log('Treatment VC Metadata:', treatmentMetadata);

    // Step 10: Query credentials by issuer and subject
    console.log('\n=== Querying Credentials ===');
    
    const clinicVCs = await vcRegistry.getIssuerVCs(clinicAccount.addr);
    console.log('VCs issued by clinic:', clinicVCs);

    const patientVCs = await vcRegistry.getSubjectVCs(`did:algo:${patientDIDIdentifier}`);
    console.log('VCs for patient:', patientVCs);

    // Step 11: Demonstrate credential lifecycle
    console.log('\n=== Credential Lifecycle ===');
    
    // Suspend a credential
    await vcRegistry.suspendVC(clinicAccount, examVCHash);
    console.log('Exam credential suspended');

    const suspendedStatus = await vcRegistry.verifyVC(examVCHash);
    console.log('Suspended status:', this.getStatusString(suspendedStatus));

    // Reinstate the credential
    await vcRegistry.reinstateVC(clinicAccount, examVCHash);
    console.log('Exam credential reinstated');

    const reinstatedStatus = await vcRegistry.verifyVC(examVCHash);
    console.log('Reinstated status:', this.getStatusString(reinstatedStatus));

    // Revoke a credential
    await vcRegistry.revokeVC(clinicAccount, treatmentVCHash, nexdenAssetId, 1000000);
    console.log('Treatment credential revoked');

    const revokedStatus = await vcRegistry.verifyVC(treatmentVCHash);
    console.log('Revoked status:', this.getStatusString(revokedStatus));

    // Step 12: Check revocation list
    console.log('\n=== Revocation List ===');
    
    const revocationList = await vcRegistry.getRevocationList(clinicAccount.addr);
    console.log('Clinic revocation list:', revocationList);

    // Step 13: Registry statistics
    console.log('\n=== Registry Statistics ===');
    
    const registryStats = await vcRegistry.getRegistryStats();
    console.log('Registry Stats:', registryStats);

    console.log('\n=== VC Registry Example Completed Successfully ===');

  } catch (error) {
    console.error('Error in VC registry example:', error);
    throw error;
  }
}

/**
 * Advanced VC scenarios
 */
export async function advancedVCScenarios() {
  console.log('\n=== Advanced VC Scenarios ===');

  // Scenario 1: Multi-clinic credential sharing
  console.log('\n--- Scenario 1: Multi-clinic Sharing ---');
  
  // Scenario 2: Credential schema registry
  console.log('\n--- Scenario 2: Schema Registry ---');
  
  // Scenario 3: Selective disclosure
  console.log('\n--- Scenario 3: Selective Disclosure ---');
  
  // Scenario 4: Credential presentation
  console.log('\n--- Scenario 4: Credential Presentation ---');
}

/**
 * Dental-specific VC use cases
 */
export async function dentalVCUseCases() {
  console.log('\n=== Dental VC Use Cases ===');
  
  // Use case 1: Patient onboarding
  console.log('\n--- Use Case 1: Patient Onboarding ---');
  
  // Use case 2: Treatment history
  console.log('\n--- Use Case 2: Treatment History ---');
  
  // Use case 3: Insurance claims
  console.log('\n--- Use Case 3: Insurance Claims ---');
  
  // Use case 4: Referrals and consultations
  console.log('\n--- Use Case 4: Referrals ---');
}

/**
 * VC verification workflows
 */
export async function vcVerificationWorkflows() {
  console.log('\n=== VC Verification Workflows ===');
  
  // Workflow 1: Real-time verification
  console.log('\n--- Workflow 1: Real-time Verification ---');
  
  // Workflow 2: Offline verification
  console.log('\n--- Workflow 2: Offline Verification ---');
  
  // Workflow 3: Third-party verification
  console.log('\n--- Workflow 3: Third-party Verification ---');
}

/**
 * Helper function to convert status code to string
 */
function getStatusString(status: number): string {
  switch (status) {
    case 0: return 'Valid';
    case 1: return 'Revoked';
    case 2: return 'Suspended';
    case 3: return 'Expired';
    default: return 'Unknown';
  }
}

// Export for use in other modules
export { VCRegistryClient, VCRegistryConfig };