import { Algodv2, Account, mnemonicToSecretKey } from 'algosdk';
import { ReputationRegistryClient, ReputationRegistryConfig, ReputationAttestation } from './ReputationRegistryClient';
import { DIDRegistryClient } from './DIDRegistryClient';
import { NexDenASA } from './NexDen';

/**
 * Comprehensive example of reputation attestation system on Algorand
 */
export async function reputationRegistryExample() {
  // Initialize Algod client
  const algodClient = new Algodv2(
    'your-api-token',
    'https://testnet-api.algonode.cloud',
    443
  );

  // Create or import accounts
  const adminAccount = Account.generate(); // Registry admin
  const clinic1Account = Account.generate(); // Dental clinic 1
  const clinic2Account = Account.generate(); // Dental clinic 2
  const patient1Account = Account.generate(); // Patient 1
  const patient2Account = Account.generate(); // Patient 2
  const dentist1Account = Account.generate(); // Dentist 1
  const dentist2Account = Account.generate(); // Dentist 2

  console.log('Admin Address:', adminAccount.addr);
  console.log('Clinic 1 Address:', clinic1Account.addr);
  console.log('Clinic 2 Address:', clinic2Account.addr);
  console.log('Patient 1 Address:', patient1Account.addr);
  console.log('Patient 2 Address:', patient2Account.addr);
  console.log('Dentist 1 Address:', dentist1Account.addr);
  console.log('Dentist 2 Address:', dentist2Account.addr);

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

    // Step 2: Deploy DID Registry (for participant DIDs)
    console.log('\n=== Deploying DID Registry ===');
    const didRegistry = new DIDRegistryClient(algodClient);
    const { appId: didAppId } = await didRegistry.deploy(adminAccount, {
      registrationFee: 1000000, // 1 NEXDEN
      updateFee: 500000, // 0.5 NEXDEN
      nexdenAssetId: nexdenAssetId,
    });

    // Step 3: Deploy Reputation Registry
    console.log('\n=== Deploying Reputation Registry ===');
    const reputationRegistry = new ReputationRegistryClient(algodClient);
    
    const registryConfig: ReputationRegistryConfig = {
      attestationFee: 1500000, // 1.5 NEXDEN for attestation
      disputeFee: 3000000, // 3 NEXDEN for dispute
      nexdenAssetId: nexdenAssetId,
    };

    const { appId, appAddress } = await reputationRegistry.deploy(adminAccount, registryConfig);

    // Step 4: Users opt into NEXDEN token
    console.log('\n=== User Opt-ins ===');
    const accounts = [clinic1Account, clinic2Account, patient1Account, patient2Account, dentist1Account, dentist2Account];
    for (const account of accounts) {
      await nexDenASA.optIn(account, nexdenAssetId);
    }

    // Step 5: Distribute NEXDEN tokens for fees
    console.log('\n=== Distributing NEXDEN Tokens ===');
    for (const account of accounts) {
      await nexDenASA.transfer(adminAccount, account.addr, 20000000, nexdenAssetId); // 20 NEXDEN each
    }

    // Step 6: Register DIDs for all participants
    console.log('\n=== Registering DIDs ===');
    
    const didIdentifiers = {
      clinic1: 'clinic-' + clinic1Account.addr.substring(0, 8),
      clinic2: 'clinic-' + clinic2Account.addr.substring(0, 8),
      patient1: 'patient-' + patient1Account.addr.substring(0, 8),
      patient2: 'patient-' + patient2Account.addr.substring(0, 8),
      dentist1: 'dentist-' + dentist1Account.addr.substring(0, 8),
      dentist2: 'dentist-' + dentist2Account.addr.substring(0, 8),
    };

    // Register clinic DIDs
    for (const [key, identifier] of Object.entries(didIdentifiers)) {
      if (key.startsWith('clinic')) {
        const account = key === 'clinic1' ? clinic1Account : clinic2Account;
        const didDocument = didRegistry.createDIDDocument(
          identifier,
          account.addr,
          [
            {
              id: 'key-1',
              type: 'Ed25519VerificationKey2020',
              controller: `did:algo:${identifier}`,
              publicKeyBase58: 'H3C2AVvLMv6gmMNam3uVAjZpfkcJCwDwnZn6z3wXmqPV',
            }
          ],
          [
            {
              id: 'dental-clinic',
              type: 'DentalClinicService',
              serviceEndpoint: `https://clinic-${key}.example.com/api`,
            }
          ]
        );

        await didRegistry.registerDID(account, identifier, didDocument, nexdenAssetId, 1000000);
      }
    }

    // Register patient and dentist DIDs (simplified)
    for (const [key, identifier] of Object.entries(didIdentifiers)) {
      if (key.startsWith('patient') || key.startsWith('dentist')) {
        const account = key === 'patient1' ? patient1Account : 
                       key === 'patient2' ? patient2Account :
                       key === 'dentist1' ? dentist1Account : dentist2Account;
        
        const didDocument = didRegistry.createDIDDocument(
          identifier,
          account.addr,
          [
            {
              id: 'key-1',
              type: 'Ed25519VerificationKey2020',
              controller: `did:algo:${identifier}`,
              publicKeyBase58: 'GKot5hBsd81kMupNCXHaqbhv3huEbxAFMLnpcX2hniwn',
            }
          ],
          []
        );

        await didRegistry.registerDID(account, identifier, didDocument, nexdenAssetId, 1000000);
      }
    }

    // Step 7: Record various types of reputation attestations
    console.log('\n=== Recording Reputation Attestations ===');
    
    // Patient satisfaction attestations
    const patientSatisfaction1 = reputationRegistry.createPatientSatisfactionAttestation(
      `did:algo:${didIdentifiers.patient1}`,
      `did:algo:${didIdentifiers.clinic1}`,
      92, // 92% satisfaction
      'Excellent service, very professional staff, clean facilities, minimal wait time'
    );

    await reputationRegistry.recordAttestation(
      patient1Account,
      patientSatisfaction1,
      nexdenAssetId,
      1500000
    );

    const patientSatisfaction2 = reputationRegistry.createPatientSatisfactionAttestation(
      `did:algo:${didIdentifiers.patient2}`,
      `did:algo:${didIdentifiers.clinic1}`,
      88, // 88% satisfaction
      'Good treatment, friendly staff, but appointment was delayed'
    );

    await reputationRegistry.recordAttestation(
      patient2Account,
      patientSatisfaction2,
      nexdenAssetId,
      1500000
    );

    // Professional competency attestations
    const professionalAttestation1 = reputationRegistry.createProfessionalAttestation(
      `did:algo:${didIdentifiers.clinic1}`,
      `did:algo:${didIdentifiers.dentist1}`,
      'orthodontics',
      95, // 95% competency
      'Exceptional orthodontic skills, 5 years experience, certified specialist'
    );

    await reputationRegistry.recordAttestation(
      clinic1Account,
      professionalAttestation1,
      nexdenAssetId,
      1500000
    );

    const professionalAttestation2 = reputationRegistry.createProfessionalAttestation(
      `did:algo:${didIdentifiers.clinic2}`,
      `did:algo:${didIdentifiers.dentist1}`,
      'general-dentistry',
      90, // 90% competency
      'Solid general dentistry skills, reliable and thorough'
    );

    await reputationRegistry.recordAttestation(
      clinic2Account,
      professionalAttestation2,
      nexdenAssetId,
      1500000
    );

    // Dental service quality attestations
    const serviceAttestation1 = reputationRegistry.createDentalServiceAttestation(
      `did:algo:${didIdentifiers.dentist1}`,
      `did:algo:${didIdentifiers.clinic1}`,
      'root-canal-treatment',
      93, // 93% quality
      'High-quality root canal treatment, modern equipment, excellent technique'
    );

    await reputationRegistry.recordAttestation(
      dentist1Account,
      serviceAttestation1,
      nexdenAssetId,
      1500000
    );

    const serviceAttestation2 = reputationRegistry.createDentalServiceAttestation(
      `did:algo:${didIdentifiers.patient1}`,
      `did:algo:${didIdentifiers.dentist2}`,
      'teeth-cleaning',
      85, // 85% quality
      'Thorough cleaning, gentle approach, good results'
    );

    await reputationRegistry.recordAttestation(
      patient1Account,
      serviceAttestation2,
      nexdenAssetId,
      1500000
    );

    // Step 8: Query reputation scores
    console.log('\n=== Querying Reputation Scores ===');
    
    // Get overall reputation scores
    const clinic1Reputation = await reputationRegistry.getSubjectReputation(`did:algo:${didIdentifiers.clinic1}`);
    console.log(`Clinic 1 Overall Reputation: ${clinic1Reputation.toFixed(1)}/100 (${reputationRegistry.getReputationGrade(clinic1Reputation)})`);

    const dentist1Reputation = await reputationRegistry.getSubjectReputation(`did:algo:${didIdentifiers.dentist1}`);
    console.log(`Dentist 1 Overall Reputation: ${dentist1Reputation.toFixed(1)}/100 (${reputationRegistry.getReputationGrade(dentist1Reputation)})`);

    // Get category-specific reputation scores
    const clinic1PatientExperience = await reputationRegistry.getCategoryReputation(
      `did:algo:${didIdentifiers.clinic1}`,
      'patient-experience'
    );
    console.log(`Clinic 1 Patient Experience: ${clinic1PatientExperience.toFixed(1)}/100`);

    const dentist1Orthodontics = await reputationRegistry.getCategoryReputation(
      `did:algo:${didIdentifiers.dentist1}`,
      'orthodontics'
    );
    console.log(`Dentist 1 Orthodontics Competency: ${dentist1Orthodontics.toFixed(1)}/100`);

    // Step 9: Get attestation lists
    console.log('\n=== Attestation Lists ===');
    
    const clinic1Attestations = await reputationRegistry.getSubjectAttestations(`did:algo:${didIdentifiers.clinic1}`);
    console.log(`Clinic 1 has ${clinic1Attestations.length} attestations:`, clinic1Attestations);

    const patient1Attestations = await reputationRegistry.getAttesterAttestations(patient1Account.addr);
    console.log(`Patient 1 has made ${patient1Attestations.length} attestations:`, patient1Attestations);

    // Step 10: Get detailed attestation metadata
    console.log('\n=== Attestation Details ===');
    
    if (clinic1Attestations.length > 0) {
      const firstAttestationId = clinic1Attestations[0];
      const attestationDetails = await reputationRegistry.getAttestationMetadata(firstAttestationId);
      console.log('First attestation details:', attestationDetails);
      console.log('Status:', reputationRegistry.getStatusString(attestationDetails.status));
    }

    // Step 11: Demonstrate dispute process
    console.log('\n=== Dispute Process ===');
    
    if (clinic1Attestations.length > 0) {
      const attestationToDispute = clinic1Attestations[0];
      
      // Patient 2 disputes the attestation
      await reputationRegistry.disputeAttestation(
        patient2Account,
        attestationToDispute,
        'Inaccurate rating - service was not as described',
        'I had a different experience at this clinic',
        nexdenAssetId,
        3000000
      );

      console.log('Attestation disputed');

      // Check status after dispute
      const disputedStatus = await reputationRegistry.getAttestationStatus(attestationToDispute);
      console.log('Status after dispute:', reputationRegistry.getStatusString(disputedStatus));

      // Admin resolves the dispute (upholding the original attestation)
      await reputationRegistry.resolveDispute(
        adminAccount,
        attestationToDispute,
        'After investigation, the original attestation is accurate and well-supported',
        true // Uphold the attestation
      );

      console.log('Dispute resolved - attestation upheld');

      // Check final status
      const finalStatus = await reputationRegistry.getAttestationStatus(attestationToDispute);
      console.log('Final status:', reputationRegistry.getStatusString(finalStatus));
    }

    // Step 12: Demonstrate attestation revocation
    console.log('\n=== Attestation Revocation ===');
    
    const patient1AttestationsList = await reputationRegistry.getAttesterAttestations(patient1Account.addr);
    if (patient1AttestationsList.length > 0) {
      const attestationToRevoke = patient1AttestationsList[0];
      
      // Patient 1 revokes their own attestation
      await reputationRegistry.revokeAttestation(patient1Account, attestationToRevoke);
      console.log('Attestation revoked by attester');

      // Check status after revocation
      const revokedStatus = await reputationRegistry.getAttestationStatus(attestationToRevoke);
      console.log('Status after revocation:', reputationRegistry.getStatusString(revokedStatus));
    }

    // Step 13: Batch verification
    console.log('\n=== Batch Verification ===');
    
    const allAttestations = [...clinic1Attestations, ...patient1AttestationsList];
    if (allAttestations.length > 0) {
      const batchStatuses = await reputationRegistry.batchVerifyAttestations(allAttestations.slice(0, 5));
      console.log('Batch verification results:', batchStatuses.map(s => reputationRegistry.getStatusString(s)));
    }

    // Step 14: Attester reputation scores
    console.log('\n=== Attester Reputation Scores ===');
    
    const patient1AttesterRep = await reputationRegistry.getAttesterReputation(patient1Account.addr);
    console.log(`Patient 1 Attester Reputation: ${patient1AttesterRep.toFixed(1)}/100`);

    const clinic1AttesterRep = await reputationRegistry.getAttesterReputation(clinic1Account.addr);
    console.log(`Clinic 1 Attester Reputation: ${clinic1AttesterRep.toFixed(1)}/100`);

    // Step 15: Registry statistics
    console.log('\n=== Registry Statistics ===');
    
    const registryStats = await reputationRegistry.getRegistryStats();
    console.log('Registry Stats:', registryStats);

    console.log('\n=== Reputation Registry Example Completed Successfully ===');

  } catch (error) {
    console.error('Error in reputation registry example:', error);
    throw error;
  }
}

/**
 * Advanced reputation scenarios
 */
export async function advancedReputationScenarios() {
  console.log('\n=== Advanced Reputation Scenarios ===');

  // Scenario 1: Multi-dimensional reputation tracking
  console.log('\n--- Scenario 1: Multi-dimensional Reputation ---');
  
  // Scenario 2: Reputation decay over time
  console.log('\n--- Scenario 2: Time-based Reputation Decay ---');
  
  // Scenario 3: Weighted attestations based on attester reputation
  console.log('\n--- Scenario 3: Weighted Attestations ---');
  
  // Scenario 4: Reputation-based access control
  console.log('\n--- Scenario 4: Reputation-based Access ---');
}

/**
 * Dental-specific reputation use cases
 */
export async function dentalReputationUseCases() {
  console.log('\n=== Dental Reputation Use Cases ===');
  
  // Use case 1: Clinic quality ratings
  console.log('\n--- Use Case 1: Clinic Quality Ratings ---');
  
  // Use case 2: Dentist specialization competency
  console.log('\n--- Use Case 2: Specialization Competency ---');
  
  // Use case 3: Treatment outcome tracking
  console.log('\n--- Use Case 3: Treatment Outcomes ---');
  
  // Use case 4: Patient compliance ratings
  console.log('\n--- Use Case 4: Patient Compliance ---');
}

/**
 * Reputation analytics and insights
 */
export async function reputationAnalytics() {
  console.log('\n=== Reputation Analytics ===');
  
  // Analytics 1: Reputation trends over time
  console.log('\n--- Analytics 1: Reputation Trends ---');
  
  // Analytics 2: Category performance analysis
  console.log('\n--- Analytics 2: Category Performance ---');
  
  // Analytics 3: Attester reliability metrics
  console.log('\n--- Analytics 3: Attester Reliability ---');
  
  // Analytics 4: Network reputation effects
  console.log('\n--- Analytics 4: Network Effects ---');
}

// Export for use in other modules
export { ReputationRegistryClient, ReputationRegistryConfig };