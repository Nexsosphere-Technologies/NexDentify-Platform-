import { Algodv2, Account, mnemonicToSecretKey } from 'algosdk';
import { StakingPoolClient, StakingPoolConfig } from './StakingPoolClient';
import { NexDenASA } from './NexDen';

/**
 * Example usage of the NexDentify Staking Pool
 */
export async function stakingPoolExample() {
  // Initialize Algod client
  const algodClient = new Algodv2(
    'your-api-token',
    'https://testnet-api.algonode.cloud',
    443
  );

  // Create or import accounts
  const adminAccount = Account.generate(); // In production, use mnemonicToSecretKey
  const userAccount = Account.generate();

  console.log('Admin Address:', adminAccount.addr);
  console.log('User Address:', userAccount.addr);

  try {
    // Step 1: Create NEXDEN ASA token (if not already created)
    console.log('\n=== Creating NEXDEN ASA ===');
    const nexDenASA = new NexDenASA(algodClient, adminAccount);
    const nexdenAssetId = await nexDenASA.createASA({
      total: 1000000000, // 1 billion tokens
      decimals: 6,
      assetName: 'NexDentify Token',
      unitName: 'NEXDEN',
    });

    // Step 2: Deploy Staking Pool Contract
    console.log('\n=== Deploying Staking Pool ===');
    const stakingPoolClient = new StakingPoolClient(algodClient);
    
    const poolConfig: StakingPoolConfig = {
      nexdenAssetId: nexdenAssetId,
      rewardRate: 1200, // 12% APY (1200 basis points)
      minStakeAmount: 1000000, // 1 NEXDEN (with 6 decimals)
      unbondingPeriod: 7 * 24 * 3600, // 7 days in seconds
    };

    const { appId, appAddress } = await stakingPoolClient.deploy(adminAccount, poolConfig);

    // Step 3: Fund the staking pool with rewards
    console.log('\n=== Funding Staking Pool ===');
    const rewardAmount = 100000000; // 100 NEXDEN for rewards
    await stakingPoolClient.fundPool(adminAccount, rewardAmount, nexdenAssetId);

    // Step 4: User opts into NEXDEN ASA and Staking Pool
    console.log('\n=== User Opt-ins ===');
    await nexDenASA.optIn(userAccount, nexdenAssetId);
    await stakingPoolClient.optIn(userAccount);

    // Step 5: Transfer some NEXDEN tokens to user
    console.log('\n=== Transferring NEXDEN to User ===');
    const userTokenAmount = 10000000; // 10 NEXDEN
    await nexDenASA.transfer(adminAccount, userAccount.addr, userTokenAmount, nexdenAssetId);

    // Step 6: User stakes tokens
    console.log('\n=== User Staking Tokens ===');
    const stakeAmount = 5000000; // 5 NEXDEN
    await stakingPoolClient.stake(userAccount, stakeAmount, nexdenAssetId);

    // Step 7: Check pool and user info
    console.log('\n=== Pool Information ===');
    const poolInfo = await stakingPoolClient.getPoolInfo();
    console.log('Pool Info:', poolInfo);

    const userInfo = await stakingPoolClient.getUserInfo(userAccount.addr);
    console.log('User Staking Info:', userInfo);

    // Step 8: Simulate time passing and check rewards
    console.log('\n=== Reward Calculation ===');
    const stakingDuration = 30 * 24 * 3600; // 30 days
    const estimatedRewards = stakingPoolClient.calculateEstimatedRewards(
      stakeAmount,
      poolConfig.rewardRate,
      stakingDuration
    );
    console.log(`Estimated rewards for 30 days: ${estimatedRewards} NEXDEN`);

    // Step 9: User initiates unstaking
    console.log('\n=== Initiating Unstake ===');
    const unstakeAmount = 2000000; // 2 NEXDEN
    await stakingPoolClient.initiateUnstake(userAccount, unstakeAmount);

    // Check updated user info
    const updatedUserInfo = await stakingPoolClient.getUserInfo(userAccount.addr);
    console.log('Updated User Info after unstake initiation:', updatedUserInfo);

    // Step 10: Demonstrate admin functions
    console.log('\n=== Admin Functions Demo ===');
    
    // Emergency pause
    await stakingPoolClient.emergencyPause(adminAccount);
    console.log('Pool emergency paused');

    // Resume pool
    await stakingPoolClient.resumePool(adminAccount);
    console.log('Pool resumed');

    console.log('\n=== Staking Pool Example Completed Successfully ===');

  } catch (error) {
    console.error('Error in staking pool example:', error);
    throw error;
  }
}

/**
 * Advanced staking scenarios
 */
export async function advancedStakingScenarios() {
  console.log('\n=== Advanced Staking Scenarios ===');

  // Scenario 1: Multiple users staking different amounts
  console.log('\n--- Scenario 1: Multiple Users ---');
  
  // Scenario 2: Reward distribution over time
  console.log('\n--- Scenario 2: Time-based Rewards ---');
  
  // Scenario 3: Emergency situations
  console.log('\n--- Scenario 3: Emergency Handling ---');
  
  // Scenario 4: Pool parameter updates
  console.log('\n--- Scenario 4: Parameter Updates ---');
}

// Export for use in other modules
export { StakingPoolClient, StakingPoolConfig };