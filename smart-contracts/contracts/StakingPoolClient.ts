import { Algodv2, Account, getApplicationAddress } from 'algosdk';
import { StakingPool } from './StakingPool';

export interface StakingPoolConfig {
  nexdenAssetId: number;
  rewardRate: number; // APY in basis points (e.g., 1000 = 10%)
  minStakeAmount: number;
  unbondingPeriod: number; // In seconds
}

export class StakingPoolClient {
  private algodClient: Algodv2;
  private contract: StakingPool;
  private appId?: number;
  private appAddress?: string;

  constructor(algodClient: Algodv2, appId?: number) {
    this.algodClient = algodClient;
    this.contract = new StakingPool();
    
    if (appId) {
      this.appId = appId;
      this.appAddress = getApplicationAddress(appId);
    }
  }

  /**
   * Deploy the staking pool contract
   */
  async deploy(
    creator: Account,
    config: StakingPoolConfig
  ): Promise<{ appId: number; appAddress: string }> {
    try {
      const result = await this.contract.create({
        sender: creator,
        args: [
          config.nexdenAssetId,
          config.rewardRate,
          config.minStakeAmount,
          config.unbondingPeriod,
        ],
      });

      this.appId = result.appId;
      this.appAddress = result.appAddress;

      console.log(`Staking Pool deployed with App ID: ${this.appId}`);
      console.log(`App Address: ${this.appAddress}`);

      return { appId: this.appId, appAddress: this.appAddress };
    } catch (error) {
      console.error('Error deploying staking pool:', error);
      throw error;
    }
  }

  /**
   * Opt user into the staking pool
   */
  async optIn(user: Account): Promise<string> {
    if (!this.appId) throw new Error('Contract not deployed');

    try {
      const result = await this.contract.optIn({
        sender: user,
        appId: this.appId,
      });

      console.log(`User ${user.addr} opted into staking pool`);
      return result.txId;
    } catch (error) {
      console.error('Error opting into staking pool:', error);
      throw error;
    }
  }

  /**
   * Stake NEXDEN tokens
   */
  async stake(
    user: Account,
    amount: number,
    nexdenAssetId: number
  ): Promise<string> {
    if (!this.appId || !this.appAddress) throw new Error('Contract not deployed');

    try {
      const suggestedParams = await this.algodClient.getTransactionParams().do();

      // Create asset transfer transaction
      const assetTransferTxn = {
        from: user.addr,
        to: this.appAddress,
        amount: amount,
        assetIndex: nexdenAssetId,
        suggestedParams,
      };

      const result = await this.contract.stake({
        sender: user,
        appId: this.appId,
        args: [assetTransferTxn],
      });

      console.log(`Staked ${amount} NEXDEN tokens`);
      return result.txId;
    } catch (error) {
      console.error('Error staking tokens:', error);
      throw error;
    }
  }

  /**
   * Initiate unstaking process
   */
  async initiateUnstake(user: Account, amount: number): Promise<string> {
    if (!this.appId) throw new Error('Contract not deployed');

    try {
      const result = await this.contract.initiateUnstake({
        sender: user,
        appId: this.appId,
        args: [amount],
      });

      console.log(`Initiated unstaking of ${amount} NEXDEN tokens`);
      return result.txId;
    } catch (error) {
      console.error('Error initiating unstake:', error);
      throw error;
    }
  }

  /**
   * Complete unstaking after unbonding period
   */
  async completeUnstake(user: Account): Promise<string> {
    if (!this.appId) throw new Error('Contract not deployed');

    try {
      const result = await this.contract.completeUnstake({
        sender: user,
        appId: this.appId,
      });

      console.log('Completed unstaking');
      return result.txId;
    } catch (error) {
      console.error('Error completing unstake:', error);
      throw error;
    }
  }

  /**
   * Claim staking rewards
   */
  async claimRewards(user: Account): Promise<string> {
    if (!this.appId) throw new Error('Contract not deployed');

    try {
      const result = await this.contract.claimRewards({
        sender: user,
        appId: this.appId,
      });

      console.log('Claimed staking rewards');
      return result.txId;
    } catch (error) {
      console.error('Error claiming rewards:', error);
      throw error;
    }
  }

  /**
   * Get user's staking information
   */
  async getUserInfo(userAddress: string): Promise<any> {
    if (!this.appId) throw new Error('Contract not deployed');

    try {
      const accountInfo = await this.algodClient.accountApplicationInformation(userAddress, this.appId).do();
      const localState = accountInfo['app-local-state']['key-value'];

      // Parse local state values
      const stakerInfo = {
        stakedAmount: this.parseStateValue(localState, 'stakedAmount') || 0,
        stakeTimestamp: this.parseStateValue(localState, 'stakeTimestamp') || 0,
        lastRewardClaim: this.parseStateValue(localState, 'lastRewardClaim') || 0,
        pendingRewards: this.parseStateValue(localState, 'pendingRewards') || 0,
        unbondingAmount: this.parseStateValue(localState, 'unbondingAmount') || 0,
        unbondingTimestamp: this.parseStateValue(localState, 'unbondingTimestamp') || 0,
      };

      return stakerInfo;
    } catch (error) {
      console.error('Error getting user info:', error);
      throw error;
    }
  }

  /**
   * Get pool information
   */
  async getPoolInfo(): Promise<any> {
    if (!this.appId) throw new Error('Contract not deployed');

    try {
      const appInfo = await this.algodClient.getApplicationByID(this.appId).do();
      const globalState = appInfo.params['global-state'];

      const poolInfo = {
        nexdenAssetId: this.parseStateValue(globalState, 'nexdenAssetId'),
        rewardRate: this.parseStateValue(globalState, 'rewardRate'),
        minStakeAmount: this.parseStateValue(globalState, 'minStakeAmount'),
        unbondingPeriod: this.parseStateValue(globalState, 'unbondingPeriod'),
        totalStaked: this.parseStateValue(globalState, 'totalStaked'),
        totalRewardsDistributed: this.parseStateValue(globalState, 'totalRewardsDistributed'),
        isActive: this.parseStateValue(globalState, 'isActive'),
        emergencyPause: this.parseStateValue(globalState, 'emergencyPause'),
      };

      return poolInfo;
    } catch (error) {
      console.error('Error getting pool info:', error);
      throw error;
    }
  }

  /**
   * Fund the pool with rewards (admin only)
   */
  async fundPool(
    admin: Account,
    amount: number,
    nexdenAssetId: number
  ): Promise<string> {
    if (!this.appId || !this.appAddress) throw new Error('Contract not deployed');

    try {
      const suggestedParams = await this.algodClient.getTransactionParams().do();

      const assetTransferTxn = {
        from: admin.addr,
        to: this.appAddress,
        amount: amount,
        assetIndex: nexdenAssetId,
        suggestedParams,
      };

      const result = await this.contract.fundPool({
        sender: admin,
        appId: this.appId,
        args: [assetTransferTxn],
      });

      console.log(`Funded pool with ${amount} NEXDEN tokens`);
      return result.txId;
    } catch (error) {
      console.error('Error funding pool:', error);
      throw error;
    }
  }

  /**
   * Emergency pause the pool (admin only)
   */
  async emergencyPause(admin: Account): Promise<string> {
    if (!this.appId) throw new Error('Contract not deployed');

    try {
      const result = await this.contract.emergencyPausePool({
        sender: admin,
        appId: this.appId,
      });

      console.log('Pool emergency paused');
      return result.txId;
    } catch (error) {
      console.error('Error pausing pool:', error);
      throw error;
    }
  }

  /**
   * Resume pool operations (admin only)
   */
  async resumePool(admin: Account): Promise<string> {
    if (!this.appId) throw new Error('Contract not deployed');

    try {
      const result = await this.contract.resumePool({
        sender: admin,
        appId: this.appId,
      });

      console.log('Pool resumed');
      return result.txId;
    } catch (error) {
      console.error('Error resuming pool:', error);
      throw error;
    }
  }

  /**
   * Calculate estimated rewards for a duration
   */
  calculateEstimatedRewards(
    stakedAmount: number,
    rewardRate: number,
    durationInSeconds: number
  ): number {
    const annualReward = (stakedAmount * rewardRate) / 10000;
    return (annualReward * durationInSeconds) / (365 * 24 * 3600);
  }

  /**
   * Helper method to parse state values
   */
  private parseStateValue(state: any[], key: string): any {
    const item = state.find((s) => Buffer.from(s.key, 'base64').toString() === key);
    if (!item) return null;

    if (item.value.type === 1) {
      // Bytes
      return Buffer.from(item.value.bytes, 'base64').toString();
    } else if (item.value.type === 2) {
      // Uint
      return item.value.uint;
    }
    return null;
  }

  // Getters
  get applicationId(): number | undefined {
    return this.appId;
  }

  get applicationAddress(): string | undefined {
    return this.appAddress;
  }
}