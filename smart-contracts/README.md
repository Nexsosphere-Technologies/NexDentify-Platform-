# NexDentify Smart Contracts

This directory contains the smart contracts for the NexDentify platform, built using TEALScript for the Algorand blockchain.

## Contracts

### 1. NexDen ASA Token (`NexDen.ts`)
- **Purpose**: Algorand Standard Asset (ASA) implementation for the NEXDEN token
- **Features**:
  - Token creation and management
  - Transfer, freeze, and clawback functionality
  - Asset configuration updates
  - Balance queries and asset information

### 2. Staking Pool Contract (`StakingPool.ts`)
- **Purpose**: Decentralized staking pool for NEXDEN tokens
- **Features**:
  - Token staking with configurable parameters
  - Time-based reward distribution
  - Unbonding period for unstaking
  - Emergency controls and admin functions
  - Proportional reward calculation

### 3. LP Farming Pool Contract (`LPFarmingPool.ts`)
- **Purpose**: Liquidity Provider token farming for earning NEXDEN rewards
- **Features**:
  - LP token staking mechanism
  - Time-based reward distribution with configurable rates
  - Multiple farming periods support
  - Emergency withdrawal functionality
  - Real-time APR calculations

### 4. DID Registry Contract (`DIDRegistry.ts`)
- **Purpose**: Decentralized Identity anchoring and management on Algorand
- **Features**:
  - DID registration and resolution with custom `did:algo` method
  - DID document storage and versioning
  - Verification method management
  - Service endpoint registration
  - DID lifecycle management (activate/deactivate/transfer)
  - Fee-based operations using NEXDEN tokens

### 5. DID Resolver Contract (`DIDResolver.ts`)
- **Purpose**: High-performance DID resolution with caching
- **Features**:
  - Fast DID document resolution
  - DID URL parsing and fragment resolution
  - Batch resolution capabilities
  - Signature verification
  - Caching for improved performance
  - Cross-contract integration with DID Registry

## Key Features

### DID Anchoring and Resolution System

#### Core DID Operations
- **Register DID**: Create new decentralized identities with custom `did:algo` method
- **Update DID**: Modify DID documents with version control
- **Resolve DID**: Retrieve DID documents and metadata
- **Deactivate/Reactivate**: Manage DID lifecycle states
- **Transfer Control**: Change DID ownership between addresses

#### Advanced DID Features
- **Verification Methods**: Add/remove cryptographic keys for authentication
- **Service Endpoints**: Register service URLs for DID-based applications
- **DID URLs**: Support for fragment-based resolution (`did:algo:example#key-1`)
- **Batch Operations**: Resolve multiple DIDs efficiently
- **Signature Verification**: Verify signatures using DID verification methods

#### DID Document Structure
```json
{
  "@context": [
    "https://www.w3.org/ns/did/v1",
    "https://w3id.org/security/suites/ed25519-2020/v1"
  ],
  "id": "did:algo:user-12345678",
  "controller": "ALGORAND_ADDRESS",
  "verificationMethod": [
    {
      "id": "did:algo:user-12345678#key-1",
      "type": "Ed25519VerificationKey2020",
      "controller": "did:algo:user-12345678",
      "publicKeyBase58": "H3C2AVvLMv6gmMNam3uVAjZpfkcJCwDwnZn6z3wXmqPV"
    }
  ],
  "service": [
    {
      "id": "did:algo:user-12345678#dental-records",
      "type": "DentalRecordService",
      "serviceEndpoint": "https://nexdentify.com/records/ALGORAND_ADDRESS"
    }
  ],
  "created": "2025-01-27T10:00:00Z",
  "updated": "2025-01-27T10:00:00Z",
  "version": 1
}
```

#### Security and Access Control
- **Controller-based Access**: Only DID controllers can modify their DIDs
- **Fee-based Operations**: NEXDEN token fees prevent spam and abuse
- **Status Management**: Active, deactivated, and revoked states
- **Admin Controls**: Registry pause/resume and malicious DID revocation
- **Version Control**: Track all DID document changes

### LP Farming Pool Functionality

#### Core Operations
- **Stake LP Tokens**: Deposit LP tokens to earn NEXDEN rewards
- **Unstake LP Tokens**: Withdraw staked LP tokens
- **Claim Rewards**: Collect accumulated NEXDEN rewards
- **Emergency Withdraw**: Immediate withdrawal (forfeit rewards)

#### Reward System
- **Rate-based**: Configurable rewards per second per staked LP token
- **Time-proportional**: Rewards calculated based on staking duration
- **Real-time calculation**: Continuous reward accumulation
- **Precision handling**: High-precision arithmetic for fair distribution

#### Security Features
- **Farming periods**: Defined start and end times for campaigns
- **Emergency controls**: Admin can pause/resume operations
- **Access controls**: Admin-only functions for pool management
- **Emergency withdrawal**: Users can exit immediately if needed

#### Pool Parameters
- **LP Token Asset ID**: The LP token to be staked
- **Reward Token Asset ID**: NEXDEN token for rewards
- **Reward Rate**: Rewards per second per staked LP token
- **Start/End Time**: Farming campaign duration
- **Total Staked**: Current amount of LP tokens staked

### Staking Pool Functionality

#### Core Operations
- **Stake**: Deposit NEXDEN tokens to earn rewards
- **Unstake**: Withdraw staked tokens (with unbonding period)
- **Claim Rewards**: Collect accumulated staking rewards
- **Opt-in**: Join the staking pool

#### Reward System
- **APY-based**: Configurable annual percentage yield
- **Time-proportional**: Rewards calculated based on staking duration
- **Automatic calculation**: Real-time reward updates

#### Security Features
- **Unbonding period**: Configurable delay for unstaking
- **Emergency pause**: Admin can halt operations if needed
- **Access controls**: Admin-only functions for pool management
- **Minimum stake**: Prevents dust attacks

#### Pool Parameters
- **Reward Rate**: Annual percentage yield in basis points
- **Minimum Stake**: Minimum amount required to stake
- **Unbonding Period**: Time delay for unstaking (in seconds)
- **Asset ID**: NEXDEN token asset ID

## Usage

### Prerequisites
```bash
npm install @algorandfoundation/tealscript algosdk
```

### DID Registry Example

```typescript
import { DIDRegistryClient, VerificationMethod, Service } from './contracts/DIDRegistryClient';
import { NexDenASA } from './contracts/NexDen';

// Initialize clients
const didRegistry = new DIDRegistryClient(algodClient);
const nexDenToken = new NexDenASA(algodClient, creatorAccount);

// Deploy contracts
const nexdenAssetId = await nexDenToken.createASA();
const { appId } = await didRegistry.deploy(admin, {
  registrationFee: 1000000, // 1 NEXDEN
  updateFee: 500000, // 0.5 NEXDEN
  nexdenAssetId: nexdenAssetId,
});

// Create DID document
const verificationMethods: VerificationMethod[] = [
  {
    id: 'key-1',
    type: 'Ed25519VerificationKey2020',
    controller: `did:algo:${didIdentifier}`,
    publicKeyBase58: 'H3C2AVvLMv6gmMNam3uVAjZpfkcJCwDwnZn6z3wXmqPV',
  }
];

const services: Service[] = [
  {
    id: 'dental-records',
    type: 'DentalRecordService',
    serviceEndpoint: 'https://nexdentify.com/records/' + userAccount.addr,
  }
];

const didDocument = didRegistry.createDIDDocument(
  didIdentifier,
  userAccount.addr,
  verificationMethods,
  services
);

// Register DID
await didRegistry.registerDID(
  userAccount,
  didIdentifier,
  didDocument,
  nexdenAssetId,
  1000000
);

// Resolve DID
const resolvedDID = await didRegistry.resolveDID(didIdentifier);
console.log('Resolved DID:', resolvedDID);
```

### DID Resolver Example

```typescript
import { DIDResolverClient } from './contracts/DIDResolverClient';

// Initialize resolver
const didResolver = new DIDResolverClient(algodClient);

// Deploy resolver (linked to registry)
const { appId } = await didResolver.deploy(admin, {
  registryAppId: registryAppId,
});

// Resolve DID with caching
const result = await didResolver.resolveDID('user-12345678');
console.log('DID Document:', result.didDocument);
console.log('Metadata:', result.didDocumentMetadata);
console.log('Resolution Info:', result.didResolutionMetadata);

// Resolve DID URL with fragment
const fragmentResult = await didResolver.resolveDIDURL('did:algo:user-12345678#key-1');

// Batch resolve multiple DIDs
const batchResults = await didResolver.batchResolveDIDs([
  'user-12345678',
  'service-87654321',
  'clinic-11111111'
]);

// Verify signature using DID
const isValid = await didResolver.verifyDIDSignature(
  'user-12345678',
  signature,
  message,
  'key-1'
);
```

### LP Farming Pool Example

```typescript
import { LPFarmingPoolClient } from './contracts/LPFarmingPoolClient';
import { NexDenASA } from './contracts/NexDen';

// Initialize clients
const farmingPool = new LPFarmingPoolClient(algodClient);
const nexDenToken = new NexDenASA(algodClient, creatorAccount);

// Deploy contracts
const rewardTokenId = await nexDenToken.createASA();
const lpTokenId = await createLPToken(); // Your LP token creation logic

const { appId } = await farmingPool.deploy(admin, {
  lpTokenAssetId: lpTokenId,
  rewardTokenAssetId: rewardTokenId,
  rewardRate: 100, // 100 NEXDEN per second per LP token
  startTime: Math.floor(Date.now() / 1000),
  endTime: Math.floor(Date.now() / 1000) + (90 * 24 * 3600), // 90 days
});

// User operations
await farmingPool.optIn(userAccount);
await farmingPool.stakeLPTokens(userAccount, 5000000, lpTokenId); // Stake 5 LP tokens
await farmingPool.claimRewards(userAccount);
```

### Basic Staking Pool Example

```typescript
import { StakingPoolClient } from './contracts/StakingPoolClient';
import { NexDenASA } from './contracts/NexDen';

// Initialize clients
const stakingPool = new StakingPoolClient(algodClient);
const nexDenToken = new NexDenASA(algodClient, creatorAccount);

// Deploy contracts
const assetId = await nexDenToken.createASA();
const { appId } = await stakingPool.deploy(admin, {
  nexdenAssetId: assetId,
  rewardRate: 1200, // 12% APY
  minStakeAmount: 1000000, // 1 NEXDEN
  unbondingPeriod: 604800, // 7 days
});

// User operations
await stakingPool.optIn(userAccount);
await stakingPool.stake(userAccount, 5000000, assetId); // Stake 5 NEXDEN
await stakingPool.claimRewards(userAccount);
```

### Advanced Usage

See `DIDExample.ts`, `LPFarmingPoolExample.ts` and `StakingPoolExample.ts` for comprehensive examples including:
- Multi-user scenarios
- DID lifecycle management
- Reward calculations
- Emergency handling
- Admin operations
- Pool analytics

## Contract Architecture

### State Management
- **Global State**: Pool-wide parameters and statistics
- **Local State**: Individual user farming/staking information
- **Box Storage**: Large data storage for DID documents (DID Registry)

### Transaction Types
- **Application Calls**: Contract method invocations
- **Asset Transfers**: Token movements (stake/unstake/rewards/fees)
- **Opt-ins**: User registration for pool participation

### Security Considerations
- **Reentrancy Protection**: State updates before external calls
- **Access Control**: Admin-only functions properly protected
- **Input Validation**: All parameters validated before processing
- **Emergency Controls**: Pause functionality for critical situations
- **Precision Arithmetic**: High-precision calculations for fair reward distribution
- **Fee-based Operations**: NEXDEN token fees prevent spam and abuse

## DID Method Specification

### Method Name
`did:algo`

### Method-Specific Identifier
The method-specific identifier is a unique string that identifies the DID within the Algorand ecosystem.

Format: `did:algo:<identifier>`

Where `<identifier>` is:
- 3-64 characters long
- Contains only alphanumeric characters, hyphens, and underscores
- Must be unique within the registry

### DID Document Properties
- **@context**: Standard DID context plus Ed25519 signature suite
- **id**: Full DID identifier (`did:algo:<identifier>`)
- **controller**: Algorand address that controls the DID
- **verificationMethod**: Array of cryptographic keys
- **service**: Array of service endpoints
- **created**: ISO 8601 timestamp of creation
- **updated**: ISO 8601 timestamp of last update
- **version**: Incremental version number

### Operations
1. **Create**: Register a new DID with initial document
2. **Read**: Resolve DID to retrieve current document
3. **Update**: Modify DID document (increment version)
4. **Deactivate**: Mark DID as inactive (reversible)
5. **Delete**: Not supported (DIDs are permanent)

### Resolution
DIDs can be resolved through:
- Direct registry contract calls
- DID Resolver contract (with caching)
- Standard DID resolution libraries

### Security Model
- **Controller Authority**: Only the controller can modify the DID
- **Immutable History**: All changes are versioned and auditable
- **Cryptographic Integrity**: All operations require valid signatures
- **Economic Security**: Fees prevent spam and abuse

## Testing

```bash
npm test
```

## Deployment

### Testnet
```bash
npm run deploy -- --network testnet
```

### Mainnet
```bash
npm run deploy -- --network mainnet
```

## Configuration

### DID Registry Parameters
- **Registration Fee**: NEXDEN tokens required to register a new DID
- **Update Fee**: NEXDEN tokens required to update a DID
- **NEXDEN Asset ID**: The asset ID of the NEXDEN token

### DID Resolver Parameters
- **Registry App ID**: Application ID of the DID Registry contract
- **Cache Enabled**: Whether to enable caching for performance
- **Cache Timeout**: How long to cache resolved DIDs (seconds)

### LP Farming Pool Parameters
- **Reward Rate**: Rewards per second per staked LP token
- **Farming Period**: Start and end timestamps
- **LP Token**: Asset ID of the LP token to be staked
- **Reward Token**: NEXDEN token asset ID

### Staking Pool Parameters
- **Reward Rate**: Set in basis points (1000 = 10%)
- **Minimum Stake**: Minimum tokens required to stake
- **Unbonding Period**: Time delay for unstaking (seconds)

### Example Configurations

#### DID Registry
```typescript
const didRegistryConfig = {
  registrationFee: 1000000, // 1 NEXDEN
  updateFee: 500000, // 0.5 NEXDEN
  nexdenAssetId: 123456789,
};
```

#### DID Resolver
```typescript
const resolverConfig = {
  registryAppId: 987654321,
};
```

#### LP Farming Pool
```typescript
const farmingConfig = {
  lpTokenAssetId: 123456789,
  rewardTokenAssetId: 987654321,
  rewardRate: 100, // 100 NEXDEN per second per LP token
  startTime: Math.floor(Date.now() / 1000),
  endTime: Math.floor(Date.now() / 1000) + (90 * 24 * 3600), // 90 days
};
```

#### Staking Pool
```typescript
const stakingConfig = {
  nexdenAssetId: 123456789,
  rewardRate: 1500, // 15% APY
  minStakeAmount: 1000000, // 1 NEXDEN (6 decimals)
  unbondingPeriod: 1209600, // 14 days
};
```

## API Reference

### DIDRegistry Contract Methods

#### User Methods
- `registerDID(identifier, document, payment)`: Register new DID
- `updateDID(identifier, document, payment)`: Update DID document
- `deactivateDID(identifier)`: Deactivate DID
- `reactivateDID(identifier, payment)`: Reactivate DID
- `transferDIDControl(identifier, newController, payment)`: Transfer ownership
- `addVerificationMethod(identifier, methodId, type, key, payment)`: Add key
- `removeVerificationMethod(identifier, methodId, payment)`: Remove key
- `addServiceEndpoint(identifier, serviceId, type, endpoint, payment)`: Add service
- `removeServiceEndpoint(identifier, serviceId, payment)`: Remove service

#### View Methods
- `resolveDID(identifier)`: Get DID document
- `getDIDMetadata(identifier)`: Get DID metadata
- `getVerificationMethod(identifier, methodId)`: Get specific key
- `getServiceEndpoint(identifier, serviceId)`: Get specific service
- `getControllerDIDs(controller)`: Get DIDs owned by address

#### Admin Methods
- `updateFees(registrationFee, updateFee)`: Update fee structure
- `pauseRegistry()`: Pause all operations
- `resumeRegistry()`: Resume operations
- `revokeDID(identifier)`: Revoke malicious DID
- `withdrawFees(amount)`: Withdraw collected fees
- `transferOwnership(newOwner)`: Change registry owner

### DIDResolver Contract Methods

#### Resolution Methods
- `resolveDID(identifier)`: Resolve DID with caching
- `resolveDIDURL(didUrl)`: Resolve DID URL with fragments
- `batchResolveDIDs(identifiers)`: Resolve multiple DIDs
- `getDIDMetadata(identifier)`: Get metadata only
- `verifyDIDSignature(identifier, signature, message, methodId)`: Verify signature
- `isDIDActive(identifier)`: Check if DID is active
- `getDIDController(identifier)`: Get DID controller

#### Cache Management
- `clearDIDCache(identifier)`: Clear specific DID cache
- `clearAllCache()`: Clear all cached data
- `updateCacheSettings(enabled, timeout)`: Configure caching

#### Admin Methods
- `updateRegistryAppId(appId)`: Change linked registry
- `setResolverStatus(active)`: Enable/disable resolver
- `transferOwnership(newOwner)`: Change resolver owner

### LPFarmingPool Contract Methods

#### User Methods
- `optIn()`: Register for farming pool
- `stakeLPTokens(amount)`: Deposit LP tokens for farming
- `unstakeLPTokens(amount)`: Withdraw LP tokens
- `claimRewards()`: Collect accumulated NEXDEN rewards
- `emergencyWithdraw()`: Immediate withdrawal (forfeit rewards)

#### Admin Methods
- `updatePoolParameters()`: Modify pool settings
- `emergencyPausePool()`: Halt all operations
- `resumePool()`: Resume normal operations
- `fundPool()`: Add reward tokens to pool
- `extendFarmingPeriod()`: Extend farming campaign
- `transferOwnership()`: Change pool admin

#### View Methods
- `getUserInfo()`: Get user farming details
- `getPoolInfo()`: Get pool statistics
- `calculateAPR()`: Get current APR
- `earned()`: Calculate user's earned rewards

### StakingPool Contract Methods

#### User Methods
- `optIn()`: Register for staking pool
- `stake(amount)`: Deposit tokens for staking
- `initiateUnstake(amount)`: Begin unstaking process
- `completeUnstake()`: Finalize unstaking after unbonding
- `claimRewards()`: Collect accumulated rewards

#### Admin Methods
- `updatePoolParameters()`: Modify pool settings
- `emergencyPausePool()`: Halt all operations
- `resumePool()`: Resume normal operations
- `fundPool()`: Add rewards to pool
- `transferOwnership()`: Change pool admin

#### View Methods
- `getUserInfo()`: Get user staking details
- `getPoolInfo()`: Get pool statistics
- `calculateEstimatedRewards()`: Estimate future rewards

## Integration Examples

### NexDentify Platform Integration

#### Patient Identity Management
```typescript
// Patient registers their DID
const patientDID = await didRegistry.registerDID(
  patientAccount,
  'patient-' + patientAccount.addr.substring(0, 8),
  patientDIDDocument,
  nexdenAssetId,
  registrationFee
);

// Patient's DID includes dental record service endpoint
const services = [
  {
    id: 'dental-records',
    type: 'DentalRecordService',
    serviceEndpoint: 'https://nexdentify.com/records/' + patientAccount.addr,
  }
];
```

#### Clinic Verification
```typescript
// Clinic verifies patient's DID
const patientDIDDoc = await didResolver.resolveDID(patientDIDIdentifier);
const isActive = await didResolver.isDIDActive(patientDIDIdentifier);

if (isActive) {
  // Access patient's dental records through DID service endpoint
  const dentalRecordService = patientDIDDoc.service.find(s => s.type === 'DentalRecordService');
  // Fetch records from service endpoint
}
```

#### Cross-Clinic Referrals
```typescript
// Referring clinic creates referral with DID signatures
const referralData = {
  patientDID: 'did:algo:patient-12345678',
  referringClinicDID: 'did:algo:clinic-87654321',
  receivingClinicDID: 'did:algo:clinic-11111111',
  referralReason: 'Orthodontic consultation',
  timestamp: Date.now(),
};

// Sign referral with clinic's DID verification method
const signature = await signWithDID(referralData, clinicAccount, 'key-1');

// Receiving clinic verifies referral authenticity
const isValidReferral = await didResolver.verifyDIDSignature(
  'clinic-87654321',
  signature,
  JSON.stringify(referralData),
  'key-1'
);
```

## License

MIT License - see LICENSE file for details.