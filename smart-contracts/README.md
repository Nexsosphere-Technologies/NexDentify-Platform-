# DIRS - Decentralized Identity and Reputation System Smart Contracts

This directory contains the smart contracts for the **Decentralized Identity and Reputation System (DIRS)**, built using TEALScript for the Algorand blockchain. DIRS provides users with self-sovereign identity and verifiable, portable reputation across platforms and ecosystems.

## System Overview

DIRS is designed to empower individuals and organizations with:
- **Self-Sovereign Identity**: Complete control over digital identity without reliance on centralized authorities
- **Portable Reputation**: Verifiable reputation that can be carried across platforms and ecosystems
- **Cross-Platform Interoperability**: Seamless identity and reputation portability between different systems
- **Verifiable Credentials**: Cryptographically secure credentials that can be independently verified
- **Decentralized Trust**: Trust networks built on cryptographic proofs rather than institutional authority

## Core Contracts

### 1. **DID Registry Contract** (`DIDRegistry.ts`)
**Purpose**: Self-sovereign decentralized identity anchoring and management

**Key Features**:
- **Custom DID Method**: `did:dirs` method for Algorand-based identities
- **Self-Sovereign Control**: Complete user control over identity lifecycle
- **Cross-Chain Portability**: Enable identity portability across blockchain networks
- **Delegation Support**: Temporary delegation of identity control permissions
- **Recovery Mechanisms**: Cryptographic recovery methods for lost access
- **Interoperability**: Standards-compliant DID documents for maximum compatibility
- **Portability Scoring**: Quantitative measure of identity portability across platforms

**Self-Sovereign Features**:
- **Controller Authority**: Only identity owners can modify their DIDs
- **Delegation Framework**: Temporary permission grants without losing control
- **Recovery Systems**: Multiple recovery methods (social, cryptographic, time-based)
- **Portability Proofs**: Cryptographic proofs enabling cross-platform identity verification
- **Interoperability Metadata**: Enhanced service endpoints for cross-platform integration

### 2. **Reputation Registry Contract** (`ReputationRegistry.ts`)
**Purpose**: Portable, verifiable reputation attestation system

**Key Features**:
- **Multi-dimensional Reputation**: Overall and category-specific reputation tracking
- **Portable Attestations**: Reputation that can be verified and transferred across platforms
- **Self-Sovereign Control**: Users control their reputation data and sharing preferences
- **Cross-Platform Mapping**: Link reputation across different platforms and ecosystems
- **Verifiability Scoring**: Quantitative measure of attestation quality and trustworthiness
- **Dispute Resolution**: Fair and transparent dispute handling for contested attestations
- **Sovereignty Flags**: Configurable privacy and control settings for reputation data

**Portable Reputation Features**:
- **Export/Import**: Package reputation for transfer to other platforms
- **Cross-Platform Bridges**: Technical infrastructure for reputation portability
- **Verifiability Metrics**: Quality scores based on evidence and cryptographic proofs
- **Control Preferences**: User-defined settings for reputation sharing and visibility
- **Platform Mappings**: Maintain reputation consistency across different systems

### 3. **VC Registry Contract** (`VCRegistry.ts`)
**Purpose**: Verifiable credential anchoring with enhanced portability

**Key Features**:
- **Credential Anchoring**: Secure on-chain anchoring of verifiable credential hashes
- **Portable Credentials**: Credentials designed for cross-platform verification
- **Self-Sovereign Issuance**: Decentralized credential issuance without central authority
- **Interoperability Standards**: Compliance with W3C VC standards and extensions
- **Cross-Platform Mapping**: Link credentials across different platforms
- **Schema Registry**: Interoperable credential schemas for consistent data structures
- **Revocation Management**: Sophisticated revocation with portability impact assessment

**Enhanced VC Features**:
- **Portability Proofs**: Cryptographic proofs enabling credential verification across platforms
- **Interoperability Metadata**: Enhanced metadata for cross-platform credential recognition
- **Sovereignty Controls**: User control over credential sharing and verification permissions
- **Platform Bridges**: Technical infrastructure for credential portability
- **Verifiability Scoring**: Quality assessment of credential evidence and proofs

### 4. **Staking Pool Contract** (`StakingPool.ts`)
**Purpose**: NEXDEN token staking for network security and governance

**Key Features**:
- **Network Security**: Stake NEXDEN tokens to secure the DIRS network
- **Governance Participation**: Staking enables participation in network governance
- **Reward Distribution**: Earn rewards for contributing to network security
- **Unbonding Period**: Security mechanism preventing rapid stake withdrawal
- **Self-Sovereign Staking**: Direct user control over staking decisions

### 5. **LP Farming Pool Contract** (`LPFarmingPool.ts`)
**Purpose**: Liquidity provision incentives for DIRS ecosystem growth

**Key Features**:
- **Liquidity Incentives**: Reward liquidity providers with NEXDEN tokens
- **Ecosystem Growth**: Support DIRS ecosystem expansion through liquidity
- **Flexible Farming**: Multiple farming periods and reward structures
- **Emergency Controls**: Safety mechanisms for pool management

## DIRS Architecture Principles

### **Self-Sovereignty**
- **User Control**: Users have complete control over their identity and reputation data
- **No Central Authority**: No single entity can control or censor user identities
- **Cryptographic Security**: All operations secured by cryptographic proofs
- **Recovery Mechanisms**: Multiple recovery options without relying on third parties

### **Portability**
- **Cross-Platform**: Identities and reputation work across different platforms
- **Standards Compliance**: Built on open standards for maximum interoperability
- **Export/Import**: Easy data portability between systems
- **Verifiable Transfers**: Cryptographic proofs ensure data integrity during transfers

### **Verifiability**
- **Cryptographic Proofs**: All claims backed by verifiable cryptographic evidence
- **Independent Verification**: Anyone can verify claims without trusted intermediaries
- **Tamper Evidence**: Immutable records with clear audit trails
- **Quality Metrics**: Quantitative measures of claim quality and trustworthiness

### **Interoperability**
- **Open Standards**: Built on W3C DID and VC standards
- **Cross-Chain Support**: Works across different blockchain networks
- **Platform Agnostic**: Compatible with various platforms and ecosystems
- **Bridge Infrastructure**: Technical bridges for seamless data transfer

## DID Method Specification: `did:dirs`

### **Method Syntax**
```
did:dirs:<identifier>
```

### **Identifier Format**
- **Length**: 3-64 characters
- **Characters**: Alphanumeric, hyphens, underscores
- **Uniqueness**: Globally unique within DIRS namespace

### **DID Document Structure**
```json
{
  "@context": [
    "https://www.w3.org/ns/did/v1",
    "https://w3id.org/security/suites/ed25519-2020/v1",
    "https://dirs.org/contexts/v1"
  ],
  "id": "did:dirs:user-12345678",
  "controller": "ALGORAND_ADDRESS",
  "verificationMethod": [
    {
      "id": "did:dirs:user-12345678#key-1",
      "type": "Ed25519VerificationKey2020",
      "controller": "did:dirs:user-12345678",
      "publicKeyBase58": "H3C2AVvLMv6gmMNam3uVAjZpfkcJCwDwnZn6z3wXmqPV",
      "purposes": ["authentication", "assertionMethod"]
    }
  ],
  "service": [
    {
      "id": "did:dirs:user-12345678#reputation",
      "type": "ReputationService",
      "serviceEndpoint": "https://dirs.org/reputation/user-12345678",
      "priority": 1
    }
  ],
  "created": "2025-01-27T10:00:00Z",
  "updated": "2025-01-27T10:00:00Z",
  "version": 1,
  "portabilityScore": 850,
  "crossChainMappings": {
    "ethereum": "did:ethr:0x1234...",
    "bitcoin": "did:btcr:..."
  }
}
```

### **Enhanced Features**
- **Portability Score**: Quantitative measure of cross-platform compatibility
- **Cross-Chain Mappings**: Links to identities on other blockchain networks
- **Enhanced Services**: Rich service metadata for interoperability
- **Delegation Support**: Temporary permission grants
- **Recovery Methods**: Multiple recovery mechanisms

## Reputation System Architecture

### **Multi-Dimensional Scoring**
```typescript
interface ReputationProfile {
  overall: number;           // 0-1000 overall reputation
  portability: number;       // 0-1000 portability score
  verifiability: number;     // 0-1000 verifiability score
  categories: {
    [category: string]: {
      score: number;         // Category-specific score
      portability: number;   // Category portability
      attestations: number;  // Number of attestations
    }
  };
  crossPlatform: {
    [platform: string]: {
      score: number;         // Score on external platform
      verified: boolean;     // Verification status
      lastSync: number;      // Last synchronization
    }
  };
}
```

### **Attestation Structure**
```typescript
interface PortableAttestation {
  id: string;
  attester: string;          // Attester DID
  subject: string;           // Subject DID
  type: string;              // Attestation type
  score: number;             // 0-100 score
  evidence: string;          // Supporting evidence
  category: string;          // Reputation category
  portabilityProof: string;  // Cross-platform proof
  verifiabilityLevel: number; // Quality score
  sovereigntyFlags: number;   // Privacy/control flags
  expirationDate: number;     // Expiration timestamp
}
```

## Verifiable Credentials Enhancement

### **Portable VC Structure**
```typescript
interface PortableVC {
  "@context": string[];
  id: string;
  type: string[];
  issuer: string;            // Issuer DID
  issuanceDate: string;
  expirationDate?: string;
  credentialSubject: any;
  proof: any;
  // DIRS Extensions
  portabilityProof: string;  // Cross-platform proof
  verifiabilityLevel: number; // Quality score
  sovereigntyFlags: number;   // Privacy/control flags
  interopMetadata: {
    platforms: string[];      // Supported platforms
    schemas: string[];        // Compatible schemas
    bridges: string[];        // Available bridges
  };
}
```

## Usage Examples

### **Self-Sovereign Identity Creation**
```typescript
import { DIDRegistryClient } from './contracts/DIDRegistryClient';

// Create self-sovereign identity
const didRegistry = new DIDRegistryClient(algodClient);

// Deploy registry with DIRS features
const { appId } = await didRegistry.deploy(admin, {
  registrationFee: 1000000,
  updateFee: 500000,
  nexdenAssetId: nexdenAssetId,
});

// Register DID with portability features
await didRegistry.registerDID(
  userAccount,
  didIdentifier,
  didDocument,
  recoveryMethods,      // Multiple recovery options
  portabilityProof,     // Cross-platform proof
  nexdenAssetId,
  1000000
);

// Enable cross-chain mapping
await didRegistry.enableCrossChainMapping(
  userAccount,
  didIdentifier,
  'ethereum',           // Target chain
  'did:ethr:0x1234...', // Target DID
  mappingProof,         // Cryptographic proof
  nexdenAssetId,
  500000
);
```

### **Portable Reputation Management**
```typescript
import { ReputationRegistryClient } from './contracts/ReputationRegistryClient';

// Create portable reputation attestation
const reputationRegistry = new ReputationRegistryClient(algodClient);

// Record portable attestation
const attestation = {
  attester: 'did:dirs:clinic-87654321',
  subject: 'did:dirs:patient-12345678',
  type: 'service-quality',
  score: 92,
  evidence: 'Excellent service delivery with documented outcomes',
  category: 'healthcare',
  portabilityProof: 'cryptographic_proof_for_cross_platform_verification',
  sovereigntyFlags: 0b1011, // Privacy and control settings
};

await reputationRegistry.recordPortableAttestation(
  clinicAccount,
  attestation,
  nexdenAssetId,
  1500000
);

// Export portable reputation package
const portablePackage = await reputationRegistry.exportPortableReputation(
  'did:dirs:patient-12345678'
);

// Import to another platform
await reputationRegistry.importPortableReputation(
  'did:dirs:patient-12345678',
  portablePackage,
  verificationProof,
  nexdenAssetId,
  1500000
);
```

### **Cross-Platform Credential Verification**
```typescript
import { VCRegistryClient } from './contracts/VCRegistryClient';

// Anchor portable credential
const vcRegistry = new VCRegistryClient(algodClient);

await vcRegistry.anchorPortableVC(
  issuerAccount,
  vcHash,
  'did:dirs:clinic-87654321',    // Issuer DID
  'did:dirs:patient-12345678',   // Subject DID
  'HealthCredential',            // Credential type
  expirationDate,
  schemaHash,
  portabilityProof,              // Cross-platform proof
  sovereigntyFlags,              // Privacy settings
  interopMetadata,               // Interoperability data
  nexdenAssetId,
  2000000
);

// Enable cross-platform mapping
await vcRegistry.enableCrossPlatformVCMapping(
  vcHash,
  'ethereum',                    // Target platform
  'vc_id_on_ethereum',          // Target VC ID
  mappingProof,                 // Cryptographic proof
  nexdenAssetId,
  1000000
);

// Export portable VC package
const portableVCPackage = await vcRegistry.exportPortableVCPackage(vcHash);
```

## Security and Privacy

### **Self-Sovereign Security**
- **User-Controlled Keys**: Users control all cryptographic keys
- **Multi-Factor Recovery**: Multiple recovery mechanisms without central authority
- **Delegation Controls**: Temporary permissions without key sharing
- **Revocation Authority**: Users can revoke delegations and credentials

### **Privacy by Design**
- **Selective Disclosure**: Share only necessary information
- **Sovereignty Flags**: User-controlled privacy settings
- **Zero-Knowledge Proofs**: Prove claims without revealing underlying data
- **Consent Management**: Explicit consent for all data sharing

### **Cross-Platform Security**
- **Cryptographic Bridges**: Secure cross-platform data transfer
- **Verification Proofs**: Independent verification of cross-platform claims
- **Tamper Detection**: Immutable audit trails across platforms
- **Trust Minimization**: Reduce reliance on trusted intermediaries

## Governance and Economics

### **Decentralized Governance**
- **Stake-Based Voting**: NEXDEN stakers participate in governance
- **Proposal System**: Community-driven protocol improvements
- **Parameter Updates**: Decentralized fee and parameter management
- **Emergency Procedures**: Community-controlled emergency responses

### **Economic Incentives**
- **Quality Rewards**: Higher rewards for high-quality attestations
- **Portability Bonuses**: Incentives for cross-platform participation
- **Verification Rewards**: Rewards for independent verification activities
- **Network Effects**: Growing value with increased participation

## Integration Guidelines

### **Platform Integration**
1. **DID Resolution**: Implement `did:dirs` resolution
2. **Reputation Import**: Support portable reputation import
3. **Credential Verification**: Verify DIRS credentials
4. **Bridge Implementation**: Build technical bridges for data transfer

### **Developer Resources**
- **SDK Libraries**: JavaScript/TypeScript SDKs for easy integration
- **API Documentation**: Comprehensive API reference
- **Example Applications**: Reference implementations
- **Testing Tools**: Tools for testing DIRS integration

## Future Roadmap

### **Phase 1: Core Infrastructure** ✅
- Basic DID registry with self-sovereign features
- Portable reputation system
- Enhanced verifiable credentials
- Cross-platform mapping foundations

### **Phase 2: Advanced Portability** 🚧
- Cross-chain bridges implementation
- Advanced interoperability protocols
- Enhanced privacy features
- Governance system activation

### **Phase 3: Ecosystem Expansion** 📋
- Multi-platform integrations
- Advanced analytics and insights
- AI-powered reputation analysis
- Global adoption initiatives

### **Phase 4: Full Decentralization** 📋
- Complete governance decentralization
- Advanced privacy technologies
- Quantum-resistant cryptography
- Universal identity standards

## Contributing

DIRS is an open-source project welcoming contributions from the global community. Areas for contribution include:

- **Protocol Development**: Core protocol improvements
- **Bridge Implementation**: Cross-platform bridges
- **Privacy Enhancements**: Advanced privacy features
- **Integration Tools**: Developer tools and SDKs
- **Documentation**: Technical and user documentation
- **Testing**: Comprehensive testing and security audits

## License

MIT License - see LICENSE file for details.

---

**DIRS empowers individuals and organizations with true digital sovereignty, enabling self-controlled identity and portable reputation in a decentralized world.**