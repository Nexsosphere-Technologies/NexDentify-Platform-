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

## Key Features

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

### Basic Example

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

See `StakingPoolExample.ts` for comprehensive examples including:
- Multi-user scenarios
- Reward calculations
- Emergency handling
- Admin operations

## Contract Architecture

### State Management
- **Global State**: Pool-wide parameters and statistics
- **Local State**: Individual user staking information

### Transaction Types
- **Application Calls**: Contract method invocations
- **Asset Transfers**: Token movements (stake/unstake/rewards)
- **Opt-ins**: User registration for pool participation

### Security Considerations
- **Reentrancy Protection**: State updates before external calls
- **Access Control**: Admin-only functions properly protected
- **Input Validation**: All parameters validated before processing
- **Emergency Controls**: Pause functionality for critical situations

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

### Pool Parameters
- **Reward Rate**: Set in basis points (1000 = 10%)
- **Minimum Stake**: Minimum tokens required to stake
- **Unbonding Period**: Time delay for unstaking (seconds)

### Example Configuration
```typescript
const config = {
  nexdenAssetId: 123456789,
  rewardRate: 1500, // 15% APY
  minStakeAmount: 1000000, // 1 NEXDEN (6 decimals)
  unbondingPeriod: 1209600, // 14 days
};
```

## API Reference

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

## License

MIT License - see LICENSE file for details.