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

## Key Features

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

See `LPFarmingPoolExample.ts` and `StakingPoolExample.ts` for comprehensive examples including:
- Multi-user scenarios
- Reward calculations
- Emergency handling
- Admin operations
- Pool analytics

## Contract Architecture

### State Management
- **Global State**: Pool-wide parameters and statistics
- **Local State**: Individual user farming/staking information

### Transaction Types
- **Application Calls**: Contract method invocations
- **Asset Transfers**: Token movements (stake/unstake/rewards)
- **Opt-ins**: User registration for pool participation

### Security Considerations
- **Reentrancy Protection**: State updates before external calls
- **Access Control**: Admin-only functions properly protected
- **Input Validation**: All parameters validated before processing
- **Emergency Controls**: Pause functionality for critical situations
- **Precision Arithmetic**: High-precision calculations for fair reward distribution

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

## License

MIT License - see LICENSE file for details.