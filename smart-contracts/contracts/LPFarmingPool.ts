import { Contract } from '@algorandfoundation/tealscript';

// LP Farming Pool State Interface
interface LPFarmingPoolState {
  // Pool configuration
  lpTokenAssetId: uint64;
  rewardTokenAssetId: uint64; // NEXDEN token
  rewardRate: uint64; // Rewards per second per staked LP token
  startTime: uint64;
  endTime: uint64;
  poolCreator: Address;
  
  // Pool statistics
  totalLPStaked: uint64;
  totalRewardsDistributed: uint64;
  lastRewardUpdate: uint64;
  rewardPerTokenStored: uint64;
  
  // Pool status
  isActive: boolean;
  emergencyPause: boolean;
}

// Individual Farmer State
interface FarmerInfo {
  lpStaked: uint64;
  stakeTimestamp: uint64;
  rewardPerTokenPaid: uint64;
  pendingRewards: uint64;
  lastRewardClaim: uint64;
}

export class LPFarmingPool extends Contract {
  // Global state variables
  lpTokenAssetId = GlobalStateKey<uint64>();
  rewardTokenAssetId = GlobalStateKey<uint64>();
  rewardRate = GlobalStateKey<uint64>();
  startTime = GlobalStateKey<uint64>();
  endTime = GlobalStateKey<uint64>();
  poolCreator = GlobalStateKey<Address>();
  totalLPStaked = GlobalStateKey<uint64>();
  totalRewardsDistributed = GlobalStateKey<uint64>();
  lastRewardUpdate = GlobalStateKey<uint64>();
  rewardPerTokenStored = GlobalStateKey<uint64>();
  isActive = GlobalStateKey<boolean>();
  emergencyPause = GlobalStateKey<boolean>();
  
  // Local state for individual farmers
  lpStaked = LocalStateKey<uint64>();
  stakeTimestamp = LocalStateKey<uint64>();
  rewardPerTokenPaid = LocalStateKey<uint64>();
  pendingRewards = LocalStateKey<uint64>();
  lastRewardClaim = LocalStateKey<uint64>();

  /**
   * Initialize the LP farming pool
   */
  createApplication(
    lpTokenAssetId: uint64,
    rewardTokenAssetId: uint64,
    rewardRate: uint64,
    startTime: uint64,
    endTime: uint64
  ): void {
    // Verify caller is the creator
    this.poolCreator.value = this.txn.sender;
    
    // Set pool parameters
    this.lpTokenAssetId.value = lpTokenAssetId;
    this.rewardTokenAssetId.value = rewardTokenAssetId;
    this.rewardRate.value = rewardRate;
    this.startTime.value = startTime;
    this.endTime.value = endTime;
    
    // Initialize pool state
    this.totalLPStaked.value = 0;
    this.totalRewardsDistributed.value = 0;
    this.lastRewardUpdate.value = startTime;
    this.rewardPerTokenStored.value = 0;
    this.isActive.value = true;
    this.emergencyPause.value = false;
  }

  /**
   * Opt user into the farming pool
   */
  optIn(): void {
    // Initialize user's local state
    this.lpStaked(this.txn.sender).value = 0;
    this.stakeTimestamp(this.txn.sender).value = 0;
    this.rewardPerTokenPaid(this.txn.sender).value = 0;
    this.pendingRewards(this.txn.sender).value = 0;
    this.lastRewardClaim(this.txn.sender).value = globals.latestTimestamp;
  }

  /**
   * Stake LP tokens to start farming
   */
  stakeLPTokens(payment: AssetTransferTxn): void {
    // Verify pool is active and not paused
    assert(this.isActive.value);
    assert(!this.emergencyPause.value);
    assert(globals.latestTimestamp >= this.startTime.value);
    assert(globals.latestTimestamp <= this.endTime.value);
    
    // Verify payment transaction
    assert(payment.assetReceiver === this.app.address);
    assert(payment.xferAsset === this.lpTokenAssetId.value);
    assert(payment.assetAmount > 0);
    assert(payment.sender === this.txn.sender);
    
    // Update reward calculations
    this.updateRewardPerToken();
    this.updateUserRewards(this.txn.sender);
    
    // Update user's staked amount
    const currentStake = this.lpStaked(this.txn.sender).value;
    const newStakeAmount = currentStake + payment.assetAmount;
    this.lpStaked(this.txn.sender).value = newStakeAmount;
    
    // Set stake timestamp if this is user's first stake
    if (currentStake === 0) {
      this.stakeTimestamp(this.txn.sender).value = globals.latestTimestamp;
    }
    
    // Update total staked amount
    this.totalLPStaked.value = this.totalLPStaked.value + payment.assetAmount;
    
    // Update user's reward per token paid
    this.rewardPerTokenPaid(this.txn.sender).value = this.rewardPerTokenStored.value;
  }

  /**
   * Unstake LP tokens
   */
  unstakeLPTokens(amount: uint64): void {
    // Verify pool is active
    assert(this.isActive.value);
    
    // Verify user has sufficient staked amount
    const currentStake = this.lpStaked(this.txn.sender).value;
    assert(currentStake >= amount);
    assert(amount > 0);
    
    // Update reward calculations
    this.updateRewardPerToken();
    this.updateUserRewards(this.txn.sender);
    
    // Update user's staked amount
    this.lpStaked(this.txn.sender).value = currentStake - amount;
    
    // Update total staked amount
    this.totalLPStaked.value = this.totalLPStaked.value - amount;
    
    // Transfer LP tokens back to user
    sendAssetTransfer({
      assetReceiver: this.txn.sender,
      assetAmount: amount,
      xferAsset: this.lpTokenAssetId.value,
    });
    
    // Update user's reward per token paid
    this.rewardPerTokenPaid(this.txn.sender).value = this.rewardPerTokenStored.value;
  }

  /**
   * Claim accumulated farming rewards
   */
  claimRewards(): void {
    // Update reward calculations
    this.updateRewardPerToken();
    this.updateUserRewards(this.txn.sender);
    
    const rewards = this.pendingRewards(this.txn.sender).value;
    assert(rewards > 0);
    
    // Transfer rewards to user
    sendAssetTransfer({
      assetReceiver: this.txn.sender,
      assetAmount: rewards,
      xferAsset: this.rewardTokenAssetId.value,
    });
    
    // Update state
    this.pendingRewards(this.txn.sender).value = 0;
    this.lastRewardClaim(this.txn.sender).value = globals.latestTimestamp;
    this.totalRewardsDistributed.value = this.totalRewardsDistributed.value + rewards;
    
    // Update user's reward per token paid
    this.rewardPerTokenPaid(this.txn.sender).value = this.rewardPerTokenStored.value;
  }

  /**
   * Emergency withdraw LP tokens (forfeit rewards)
   */
  emergencyWithdraw(): void {
    const stakedAmount = this.lpStaked(this.txn.sender).value;
    assert(stakedAmount > 0);
    
    // Update total staked amount
    this.totalLPStaked.value = this.totalLPStaked.value - stakedAmount;
    
    // Clear user's state
    this.lpStaked(this.txn.sender).value = 0;
    this.pendingRewards(this.txn.sender).value = 0;
    this.rewardPerTokenPaid(this.txn.sender).value = 0;
    
    // Transfer LP tokens back to user
    sendAssetTransfer({
      assetReceiver: this.txn.sender,
      assetAmount: stakedAmount,
      xferAsset: this.lpTokenAssetId.value,
    });
  }

  /**
   * Update reward per token stored
   */
  private updateRewardPerToken(): void {
    if (this.totalLPStaked.value === 0) {
      this.lastRewardUpdate.value = this.getLastTimeRewardApplicable();
      return;
    }
    
    const lastTimeRewardApplicable = this.getLastTimeRewardApplicable();
    const timeDelta = lastTimeRewardApplicable - this.lastRewardUpdate.value;
    const rewardPerTokenIncrease = (timeDelta * this.rewardRate.value * 1000000) / this.totalLPStaked.value;
    
    this.rewardPerTokenStored.value = this.rewardPerTokenStored.value + rewardPerTokenIncrease;
    this.lastRewardUpdate.value = lastTimeRewardApplicable;
  }

  /**
   * Update user's pending rewards
   */
  private updateUserRewards(user: Address): void {
    const userStake = this.lpStaked(user).value;
    if (userStake > 0) {
      const rewardPerTokenDelta = this.rewardPerTokenStored.value - this.rewardPerTokenPaid(user).value;
      const userReward = (userStake * rewardPerTokenDelta) / 1000000;
      this.pendingRewards(user).value = this.pendingRewards(user).value + userReward;
    }
  }

  /**
   * Get the last time rewards are applicable
   */
  private getLastTimeRewardApplicable(): uint64 {
    const currentTime = globals.latestTimestamp;
    if (currentTime < this.endTime.value) {
      return currentTime;
    } else {
      return this.endTime.value;
    }
  }

  /**
   * Calculate current reward per token
   */
  rewardPerToken(): uint64 {
    if (this.totalLPStaked.value === 0) {
      return this.rewardPerTokenStored.value;
    }
    
    const lastTimeRewardApplicable = this.getLastTimeRewardApplicable();
    const timeDelta = lastTimeRewardApplicable - this.lastRewardUpdate.value;
    const rewardPerTokenIncrease = (timeDelta * this.rewardRate.value * 1000000) / this.totalLPStaked.value;
    
    return this.rewardPerTokenStored.value + rewardPerTokenIncrease;
  }

  /**
   * Calculate earned rewards for a user
   */
  earned(user: Address): uint64 {
    const userStake = this.lpStaked(user).value;
    const currentRewardPerToken = this.rewardPerToken();
    const rewardPerTokenDelta = currentRewardPerToken - this.rewardPerTokenPaid(user).value;
    const userReward = (userStake * rewardPerTokenDelta) / 1000000;
    
    return this.pendingRewards(user).value + userReward;
  }

  /**
   * Get user's farming information
   */
  getUserInfo(user: Address): FarmerInfo {
    return {
      lpStaked: this.lpStaked(user).value,
      stakeTimestamp: this.stakeTimestamp(user).value,
      rewardPerTokenPaid: this.rewardPerTokenPaid(user).value,
      pendingRewards: this.earned(user),
      lastRewardClaim: this.lastRewardClaim(user).value,
    };
  }

  /**
   * Get pool information
   */
  getPoolInfo(): LPFarmingPoolState {
    return {
      lpTokenAssetId: this.lpTokenAssetId.value,
      rewardTokenAssetId: this.rewardTokenAssetId.value,
      rewardRate: this.rewardRate.value,
      startTime: this.startTime.value,
      endTime: this.endTime.value,
      poolCreator: this.poolCreator.value,
      totalLPStaked: this.totalLPStaked.value,
      totalRewardsDistributed: this.totalRewardsDistributed.value,
      lastRewardUpdate: this.lastRewardUpdate.value,
      rewardPerTokenStored: this.rewardPerTokenStored.value,
      isActive: this.isActive.value,
      emergencyPause: this.emergencyPause.value,
    };
  }

  /**
   * Calculate APR based on current pool state
   */
  calculateAPR(): uint64 {
    if (this.totalLPStaked.value === 0) return 0;
    
    const annualRewards = this.rewardRate.value * 365 * 24 * 3600; // Rewards per year
    const apr = (annualRewards * 10000) / this.totalLPStaked.value; // APR in basis points
    
    return apr;
  }

  // Admin functions
  
  /**
   * Update pool parameters (admin only)
   */
  updatePoolParameters(
    newRewardRate: uint64,
    newEndTime: uint64
  ): void {
    // Verify caller is pool creator
    assert(this.txn.sender === this.poolCreator.value);
    
    // Update reward calculations before changing parameters
    this.updateRewardPerToken();
    
    this.rewardRate.value = newRewardRate;
    this.endTime.value = newEndTime;
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
   * Fund pool with reward tokens (admin only)
   */
  fundPool(payment: AssetTransferTxn): void {
    assert(this.txn.sender === this.poolCreator.value);
    assert(payment.assetReceiver === this.app.address);
    assert(payment.xferAsset === this.rewardTokenAssetId.value);
    assert(payment.sender === this.txn.sender);
  }

  /**
   * Withdraw excess reward tokens (admin only)
   */
  withdrawExcessRewards(amount: uint64): void {
    assert(this.txn.sender === this.poolCreator.value);
    
    sendAssetTransfer({
      assetReceiver: this.poolCreator.value,
      assetAmount: amount,
      xferAsset: this.rewardTokenAssetId.value,
    });
  }

  /**
   * Extend farming period (admin only)
   */
  extendFarmingPeriod(newEndTime: uint64): void {
    assert(this.txn.sender === this.poolCreator.value);
    assert(newEndTime > this.endTime.value);
    
    this.endTime.value = newEndTime;
  }

  /**
   * Transfer pool ownership (admin only)
   */
  transferOwnership(newOwner: Address): void {
    assert(this.txn.sender === this.poolCreator.value);
    this.poolCreator.value = newOwner;
  }
}