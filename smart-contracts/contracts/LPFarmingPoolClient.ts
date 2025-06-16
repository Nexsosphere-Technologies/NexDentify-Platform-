import { Algodv2, Account, getApplicationAddress } from 'algosdk';
import { LPFarmingPool } from './LPFarmingPool';

export interface LPFarmingPoolConfig {
  lpTokenAssetId: number;
  rewardTokenAssetId: number; // NEXDEN token
  rewardRate: number; // Rewards per second per staked LP token
  startTime: number;
  endTime: number;
}

export class LPFarmingPoolClient {
  private algodClient: Algodv2;
  private contract: LPFarmingPool;
  private appId?: number;
  private appAddress?: string;

  constructor(algodClient: Algodv2, appId?: number) {
    this.algodClient = algodClient;
    this.contract = new LPFarmingPool();
    
    if (appId) {
      this.appId = appId;
      this.appAddress = getApplicationAddress(appId);
    }
  }

  /**
   * Deploy the LP farming pool contract
   */
  async deploy(
    creator: Account,
    config: LPFarmingPoolConfig
  ): Promise<{ appId: number; appAddress: string }> {
    try {
      const result = await this.contract.create({
        sender: creator,
        args: [
          config.lpTokenAssetId,
          config.rewardTokenAssetId,
          config.rewardRate,
          config.startTime,
          config.endTime,
        ],
      });

      this.appId = result.appId;
      this.appAddress = result.appAddress;

      console.log(`LP Farming Pool deployed with App ID: ${this.appId}`);
      console.log(`App Address: ${this.appAddress}`);

      return { appId: this.appId, appAddress: this.appAddress };
    } catch (error) {
      console.error('Error deploying LP farming pool:', error);
      throw error;
    }
  }

  /**
   * Opt user into the farming pool
   */
  async optIn(user: Account): Promise<string> {
    if (!this.appId) throw new Error('Contract not deployed');

    try {
      const result = await this.contract.optIn({
        sender: user,
        appId: this.appId,
      });

      console.log(`User ${user.addr} opted into LP farming pool`);
      return result.txId;
    } catch (error) {
      console.error('Error opting into LP farming pool:', error);
      throw error;
    }
  }

  /**
   * Stake LP tokens to start farming
   */
  async stakeLPTokens(
    user: Account,
    amount: number,
    lpTokenAssetId: number
  ): Promise<string> {
    if (!this.appId || !this.appAddress) throw new Error('Contract not deployed');

    try {
      const suggestedParams = await this.algodClient.getTransactionParams().do();

      // Create asset transfer transaction
      const assetTransferTxn = {
        from: user.addr,
        to: this.appAddress,
        amount: amount,
        assetIndex: lpTokenAssetId,
        suggestedParams,
      };

      const result = await this.contract.stakeLPTokens({
        sender: user,
        appId: this.appId,
        args: [assetTransferTxn],
      });

      console.log(`Staked ${amount} LP tokens for farming`);
      return result.txId;
    } catch (error) {
      console.error('Error staking LP tokens:', error);
      throw error;
    }
  }

  /**
   * Unstake LP tokens
   */
  async unstakeLPTokens(user: Account, amount: number): Promise<string> {
    if (!this.appId) throw new Error('Contract not deployed');

    try {
      const result = await this.contract.unstakeLPTokens({
        sender: user,
        appId: this.appId,
        args: [amount],
      });

      console.log(`Unstaked ${amount} LP tokens`);
      return result.txId;
    } catch (error) {
      console.error('Error unstaking LP tokens:', error);
      throw error;
    }
  }

  /**
   * Claim farming rewards
   */
  async claimRewards(user: Account): Promise<string> {
    if (!this.appId) throw new Error('Contract not deployed');

    try {
      const result = await this.contract.claimRewards({
        sender: user,
        appId: this.appId,
      });

      console.log('Claimed farming rewards');
      return result.txId;
    } catch (error) {
      console.error('Error claiming rewards:', error);
      throw error;
    }
  }

  /**
   * Emergency withdraw LP tokens (forfeit rewards)
   */
  async emergencyWithdraw(user: Account): Promise<string> {
    if (!this.appId) throw new Error('Contract not deployed');

    try {
      const result = await this.contract.emergencyWithdraw({
        sender: user,
        appId: this.appId,
      });

      console.log('Emergency withdrawal completed');
      return result.txId;
    } catch (error) {
      console.error('Error in emergency withdrawal:', error);
      throw error;
    }
  }

  /**
   * Get user's farming information
   */
  async getUserInfo(userAddress: string): Promise<any> {
    if (!this.appId) throw new Error('Contract not deployed');

    try {
      const accountInfo = await this.algodClient.accountApplicationInformation(userAddress, this.appId).do();
      const localState = accountInfo['app-local-state']['key-value'];

      // Parse local state values
      const farmerInfo = {
        lpStaked: this.parseStateValue(localState, 'lpStaked') || 0,
        stakeTimestamp: this.parseStateValue(localState, 'stakeTimestamp') || 0,
        rewardPerTokenPaid: this.parseStateValue(localState, 'rewardPerTokenPaid') || 0,
        pendingRewards: this.parseStateValue(localState, 'pendingRewards') || 0,
        lastRewardClaim: this.parseStateValue(localState, 'lastRewardClaim') || 0,
      };

      return farmerInfo;
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
        lpTokenAssetId: this.parseStateValue(globalState, 'lpTokenAssetId'),
        rewardTokenAssetId: this.parseStateValue(globalState, 'rewardTokenAssetId'),
        rewardRate: this.parseStateValue(globalState, 'rewardRate'),
        startTime: this.parseStateValue(globalState, 'startTime'),
        endTime: this.parseStateValue(globalState, 'endTime'),
        totalLPStaked: this.parseStateValue(globalState, 'totalLPStaked'),
        totalRewardsDistributed: this.parseStateValue(globalState, 'totalRewardsDistributed'),
        lastRewardUpdate: this.parseStateValue(globalState, 'lastRewardUpdate'),
        rewardPerTokenStored: this.parseStateValue(globalState, 'rewardPerTokenStored'),
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
   * Calculate current APR
   */
  async calculateAPR(): Promise<number> {
    const poolInfo = await this.getPoolInfo();
    
    if (poolInfo.totalLPStaked === 0) return 0;
    
    const annualRewards = poolInfo.rewardRate * 365 * 24 * 3600;
    const apr = (annualRewards * 10000) / poolInfo.totalLPStaked;
    
    return apr / 100; // Convert basis points to percentage
  }

  /**
   * Calculate estimated rewards for a duration
   */
  calculateEstimatedRewards(
    lpStaked: number,
    rewardRate: number,
    durationInSeconds: number
  ): number {
    return lpStaked * rewardRate * durationInSeconds;
  }

  /**
   * Fund the pool with reward tokens (admin only)
   */
  async fundPool(
    admin: Account,
    amount: number,
    rewardTokenAssetId: number
  ): Promise<string> {
    if (!this.appId || !this.appAddress) throw new Error('Contract not deployed');

    try {
      const suggestedParams = await this.algodClient.getTransactionParams().do();

      const assetTransferTxn = {
        from: admin.addr,
        to: this.appAddress,
        amount: amount,
        assetIndex: rewardTokenAssetId,
        suggestedParams,
      };

      const result = await this.contract.fundPool({
        sender: admin,
        appId: this.appId,
        args: [assetTransferTxn],
      });

      console.log(`Funded pool with ${amount} reward tokens`);
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
   * Extend farming period (admin only)
   */
  async extendFarmingPeriod(admin: Account, newEndTime: number): Promise<string> {
    if (!this.appId) throw new Error('Contract not deployed');

    try {
      const result = await this.contract.extendFarmingPeriod({
        sender: admin,
        appId: this.appId,
        args: [newEndTime],
      });

      console.log(`Extended farming period to ${new Date(newEndTime * 1000)}`);
      return result.txId;
    } catch (error) {
      console.error('Error extending farming period:', error);
      throw error;
    }
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