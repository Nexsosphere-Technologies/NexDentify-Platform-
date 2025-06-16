import { Contract } from '@algorandfoundation/tealscript';

// Staking Pool State Interface
interface StakingPoolState {
  // Pool configuration
  nexdenAssetId: uint64;
  rewardRate: uint64; // Annual percentage yield (APY) in basis points (e.g., 1000 = 10%)
  minStakeAmount: uint64;
  unbondingPeriod: uint64; // In seconds
  poolCreator: Address;
  
  // Pool statistics
  totalStaked: uint64;
  totalRewardsDistributed: uint64;
  lastRewardUpdate: uint64;
  
  // Pool status
  isActive: boolean;
  emergencyPause: boolean;
}

// Individual Staker State
interface StakerInfo {
  stakedAmount: uint64;
  stakeTimestamp: uint64;
  lastRewardClaim: uint64;
  pendingRewards: uint64;
  unbondingAmount: uint64;
  unbondingTimestamp: uint64;
}

export class StakingPool extends Contract {
  // Global state variables
  nexdenAssetId = GlobalStateKey<uint64>();
  rewardRate = GlobalStateKey<uint64>();
  minStakeAmount = GlobalStateKey<uint64>();
  unbondingPeriod = GlobalStateKey<uint64>();
  poolCreator = GlobalStateKey<Address>();
  totalStaked = GlobalStateKey<uint64>();
  totalRewardsDistributed = GlobalStateKey<uint64>();
  lastRewardUpdate = GlobalStateKey<uint64>();
  isActive = GlobalStateKey<boolean>();
  emergencyPause = GlobalStateKey<boolean>();
  
  // Local state for individual stakers
  stakedAmount = LocalStateKey<uint64>();
  stakeTimestamp = LocalStateKey<uint64>();
  lastRewardClaim = LocalStateKey<uint64>();
  pendingRewards = LocalStateKey<uint64>();
  unbondingAmount = LocalStateKey<uint64>();
  unbondingTimestamp = LocalStateKey<uint64>();

  /**
   * Initialize the staking pool
   */
  createApplication(
    nexdenAssetId: uint64,
    rewardRate: uint64,
    minStakeAmount: uint64,
    unbondingPeriod: uint64
  ): void {
    // Verify caller is the creator
    this.poolCreator.value = this.txn.sender;
    
    // Set pool parameters
    this.nexdenAssetId.value = nexdenAssetId;
    this.rewardRate.value = rewardRate;
    this.minStakeAmount.value = minStakeAmount;
    this.unbondingPeriod.value = unbondingPeriod;
    
    // Initialize pool state
    this.totalStaked.value = 0;
    this.totalRewardsDistributed.value = 0;
    this.lastRewardUpdate.value = globals.latestTimestamp;
    this.isActive.value = true;
    this.emergencyPause.value = false;
  }

  /**
   * Opt user into the staking pool
   */
  optIn(): void {
    // Initialize user's local state
    this.stakedAmount(this.txn.sender).value = 0;
    this.stakeTimestamp(this.txn.sender).value = 0;
    this.lastRewardClaim(this.txn.sender).value = globals.latestTimestamp;
    this.pendingRewards(this.txn.sender).value = 0;
    this.unbondingAmount(this.txn.sender).value = 0;
    this.unbondingTimestamp(this.txn.sender).value = 0;
  }

  /**
   * Stake NEXDEN tokens
   */
  stake(payment: AssetTransferTxn): void {
    // Verify pool is active and not paused
    assert(this.isActive.value);
    assert(!this.emergencyPause.value);
    
    // Verify payment transaction
    assert(payment.assetReceiver === this.app.address);
    assert(payment.xferAsset === this.nexdenAssetId.value);
    assert(payment.assetAmount >= this.minStakeAmount.value);
    assert(payment.sender === this.txn.sender);
    
    // Update user's pending rewards before changing stake
    this.updateUserRewards(this.txn.sender);
    
    // Update user's staked amount
    const currentStake = this.stakedAmount(this.txn.sender).value;
    const newStakeAmount = currentStake + payment.assetAmount;
    this.stakedAmount(this.txn.sender).value = newStakeAmount;
    
    // Set stake timestamp if this is user's first stake
    if (currentStake === 0) {
      this.stakeTimestamp(this.txn.sender).value = globals.latestTimestamp;
    }
    
    // Update total staked amount
    this.totalStaked.value = this.totalStaked.value + payment.assetAmount;
    
    // Update last reward update timestamp
    this.lastRewardUpdate.value = globals.latestTimestamp;
  }

  /**
   * Initiate unstaking process (start unbonding period)
   */
  initiateUnstake(amount: uint64): void {
    // Verify pool is active
    assert(this.isActive.value);
    
    // Verify user has sufficient staked amount
    const currentStake = this.stakedAmount(this.txn.sender).value;
    assert(currentStake >= amount);
    assert(amount > 0);
    
    // Update user's pending rewards
    this.updateUserRewards(this.txn.sender);
    
    // Move tokens from staked to unbonding
    this.stakedAmount(this.txn.sender).value = currentStake - amount;
    this.unbondingAmount(this.txn.sender).value = this.unbondingAmount(this.txn.sender).value + amount;
    this.unbondingTimestamp(this.txn.sender).value = globals.latestTimestamp;
    
    // Update total staked amount
    this.totalStaked.value = this.totalStaked.value - amount;
  }

  /**
   * Complete unstaking after unbonding period
   */
  completeUnstake(): void {
    const unbondingAmount = this.unbondingAmount(this.txn.sender).value;
    const unbondingTimestamp = this.unbondingTimestamp(this.txn.sender).value;
    
    // Verify user has tokens in unbonding
    assert(unbondingAmount > 0);
    
    // Verify unbonding period has passed
    assert(globals.latestTimestamp >= unbondingTimestamp + this.unbondingPeriod.value);
    
    // Transfer tokens back to user
    sendAssetTransfer({
      assetReceiver: this.txn.sender,
      assetAmount: unbondingAmount,
      xferAsset: this.nexdenAssetId.value,
    });
    
    // Clear unbonding state
    this.unbondingAmount(this.txn.sender).value = 0;
    this.unbondingTimestamp(this.txn.sender).value = 0;
  }

  /**
   * Claim accumulated staking rewards
   */
  claimRewards(): void {
    // Update user's pending rewards
    this.updateUserRewards(this.txn.sender);
    
    const rewards = this.pendingRewards(this.txn.sender).value;
    assert(rewards > 0);
    
    // Transfer rewards to user
    sendAssetTransfer({
      assetReceiver: this.txn.sender,
      assetAmount: rewards,
      xferAsset: this.nexdenAssetId.value,
    });
    
    // Update state
    this.pendingRewards(this.txn.sender).value = 0;
    this.lastRewardClaim(this.txn.sender).value = globals.latestTimestamp;
    this.totalRewardsDistributed.value = this.totalRewardsDistributed.value + rewards;
  }

  /**
   * Update user's pending rewards based on time and stake amount
   */
  private updateUserRewards(user: Address): void {
    const stakedAmount = this.stakedAmount(user).value;
    const lastClaim = this.lastRewardClaim(user).value;
    const currentTime = globals.latestTimestamp;
    
    if (stakedAmount > 0 && currentTime > lastClaim) {
      const stakingDuration = currentTime - lastClaim;
      const annualReward = (stakedAmount * this.rewardRate.value) / 10000; // Convert basis points
      const reward = (annualReward * stakingDuration) / (365 * 24 * 3600); // Pro-rata for time period
      
      this.pendingRewards(user).value = this.pendingRewards(user).value + reward;
      this.lastRewardClaim(user).value = currentTime;
    }
  }

  /**
   * Get user's staking information
   */
  getUserInfo(user: Address): StakerInfo {
    // Update rewards before returning info
    this.updateUserRewards(user);
    
    return {
      stakedAmount: this.stakedAmount(user).value,
      stakeTimestamp: this.stakeTimestamp(user).value,
      lastRewardClaim: this.lastRewardClaim(user).value,
      pendingRewards: this.pendingRewards(user).value,
      unbondingAmount: this.unbondingAmount(user).value,
      unbondingTimestamp: this.unbondingTimestamp(user).value,
    };
  }

  /**
   * Get pool information
   */
  getPoolInfo(): StakingPoolState {
    return {
      nexdenAssetId: this.nexdenAssetId.value,
      rewardRate: this.rewardRate.value,
      minStakeAmount: this.minStakeAmount.value,
      unbondingPeriod: this.unbondingPeriod.value,
      poolCreator: this.poolCreator.value,
      totalStaked: this.totalStaked.value,
      totalRewardsDistributed: this.totalRewardsDistributed.value,
      lastRewardUpdate: this.lastRewardUpdate.value,
      isActive: this.isActive.value,
      emergencyPause: this.emergencyPause.value,
    };
  }

  /**
   * Calculate estimated rewards for a user
   */
  calculateEstimatedRewards(user: Address, duration: uint64): uint64 {
    const stakedAmount = this.stakedAmount(user).value;
    if (stakedAmount === 0) return 0;
    
    const annualReward = (stakedAmount * this.rewardRate.value) / 10000;
    return (annualReward * duration) / (365 * 24 * 3600);
  }

  // Admin functions
  
  /**
   * Update pool parameters (admin only)
   */
  updatePoolParameters(
    newRewardRate: uint64,
    newMinStakeAmount: uint64,
    newUnbondingPeriod: uint64
  ): void {
    // Verify caller is pool creator
    assert(this.txn.sender === this.poolCreator.value);
    
    this.rewardRate.value = newRewardRate;
    this.minStakeAmount.value = newMinStakeAmount;
    this.unbondingPeriod.value = newUnbondingPeriod;
  }

  /**
   * Emergency pause (admin only)
   */
  emergencyPausePool(): void {
    assert(this.txn.sender === this.poolCreator.value);
    this.emergencyPause.value = true;
  }

  /**
   * Resume pool operations (admin only)
   */
  resumePool(): void {
    assert(this.txn.sender === this.poolCreator.value);
    this.emergencyPause.value = false;
  }

  /**
   * Deactivate pool permanently (admin only)
   */
  deactivatePool(): void {
    assert(this.txn.sender === this.poolCreator.value);
    this.isActive.value = false;
  }

  /**
   * Fund pool with rewards (admin only)
   */
  fundPool(payment: AssetTransferTxn): void {
    assert(this.txn.sender === this.poolCreator.value);
    assert(payment.assetReceiver === this.app.address);
    assert(payment.xferAsset === this.nexdenAssetId.value);
    assert(payment.sender === this.txn.sender);
  }

  /**
   * Withdraw excess funds (admin only)
   */
  withdrawExcess(amount: uint64): void {
    assert(this.txn.sender === this.poolCreator.value);
    
    sendAssetTransfer({
      assetReceiver: this.poolCreator.value,
      assetAmount: amount,
      xferAsset: this.nexdenAssetId.value,
    });
  }

  /**
   * Transfer pool ownership (admin only)
   */
  transferOwnership(newOwner: Address): void {
    assert(this.txn.sender === this.poolCreator.value);
    this.poolCreator.value = newOwner;
  }
}