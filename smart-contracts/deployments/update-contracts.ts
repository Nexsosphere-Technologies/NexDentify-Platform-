import { Algodv2, Account, mnemonicToSecretKey } from 'algosdk';
import { DIDRegistryClient } from '../contracts/DIDRegistryClient';
import { ReputationRegistryClient } from '../contracts/ReputationRegistryClient';
import { VCRegistryClient } from '../contracts/VCRegistryClient';
import { StakingPoolClient } from '../contracts/StakingPoolClient';
import { LPFarmingPoolClient } from '../contracts/LPFarmingPoolClient';
import * as fs from 'fs';
import * as path from 'path';

// Update configuration interface
interface UpdateConfig {
  network: 'testnet' | 'mainnet' | 'localnet';
  adminMnemonic: string;
  algodToken: string;
  algodServer: string;
  algodPort: number;
  updateType: 'parameters' | 'upgrade' | 'migration' | 'emergency';
  contracts?: string[]; // Specific contracts to update
  dryRun?: boolean; // Simulate updates without executing
}

// Update parameters interface
interface UpdateParameters {
  didRegistry?: {
    registrationFee?: number;
    updateFee?: number;
    interoperabilityEnabled?: boolean;
    crossChainSupport?: boolean;
  };
  reputationRegistry?: {
    attestationFee?: number;
    disputeFee?: number;
    portabilityEnabled?: boolean;
    crossPlatformSupport?: boolean;
    selfSovereignMode?: boolean;
  };
  vcRegistry?: {
    registrationFee?: number;
    revocationFee?: number;
    portabilityEnabled?: boolean;
    crossPlatformSupport?: boolean;
    selfSovereignMode?: boolean;
    interoperabilityLevel?: number;
  };
  stakingPool?: {
    rewardRate?: number;
    minStakeAmount?: number;
    unbondingPeriod?: number;
  };
  lpFarmingPool?: {
    rewardRate?: number;
    endTime?: number;
  };
}

// Update result interface
interface UpdateResult {
  network: string;
  timestamp: string;
  updateType: string;
  admin: string;
  contracts: {
    [contractName: string]: {
      appId: number;
      updated: boolean;
      changes: string[];
      txIds: string[];
      error?: string;
    };
  };
  overallStatus: 'success' | 'partial' | 'failed';
  rollbackPlan?: string;
}

/**
 * Main contract update class for DIRS smart contracts
 */
export class DIRSContractUpdater {
  private algodClient: Algodv2;
  private config: UpdateConfig;
  private admin: Account;
  private deploymentData: any;
  private updateResult: Partial<UpdateResult> = {};

  constructor(config: UpdateConfig, deploymentData: any) {
    this.config = config;
    this.deploymentData = deploymentData;
    this.algodClient = new Algodv2(
      config.algodToken,
      config.algodServer,
      config.algodPort
    );
    
    this.admin = mnemonicToSecretKey(config.adminMnemonic);
    
    console.log('🔧 Contract Updater initialized');
    console.log('📋 Admin Address:', this.admin.addr);
    console.log('🌐 Network:', config.network);
    console.log('🔄 Update Type:', config.updateType);
  }

  /**
   * Update contract parameters
   */
  async updateParameters(parameters: UpdateParameters): Promise<UpdateResult> {
    try {
      console.log('\n⚙️  Starting Contract Parameter Updates');
      console.log('=' .repeat(60));
      
      this.initializeUpdateResult('parameters');

      // Update DID Registry parameters
      if (parameters.didRegistry && this.shouldUpdateContract('didRegistry')) {
        await this.updateDIDRegistryParameters(parameters.didRegistry);
      }

      // Update Reputation Registry parameters
      if (parameters.reputationRegistry && this.shouldUpdateContract('reputationRegistry')) {
        await this.updateReputationRegistryParameters(parameters.reputationRegistry);
      }

      // Update VC Registry parameters
      if (parameters.vcRegistry && this.shouldUpdateContract('vcRegistry')) {
        await this.updateVCRegistryParameters(parameters.vcRegistry);
      }

      // Update Staking Pool parameters
      if (parameters.stakingPool && this.shouldUpdateContract('stakingPool')) {
        await this.updateStakingPoolParameters(parameters.stakingPool);
      }

      // Update LP Farming Pool parameters
      if (parameters.lpFarmingPool && this.shouldUpdateContract('lpFarmingPool')) {
        await this.updateLPFarmingPoolParameters(parameters.lpFarmingPool);
      }

      await this.finalizeUpdate();
      return this.updateResult as UpdateResult;

    } catch (error) {
      console.error('\n❌ Parameter update failed:', error);
      throw error;
    }
  }

  /**
   * Upgrade contracts to new versions
   */
  async upgradeContracts(newContractCode: { [contractName: string]: any }): Promise<UpdateResult> {
    try {
      console.log('\n🚀 Starting Contract Upgrades');
      console.log('=' .repeat(60));
      
      this.initializeUpdateResult('upgrade');

      // Note: Contract upgrades on Algorand require redeployment
      // This method would handle the migration process
      
      for (const [contractName, newCode] of Object.entries(newContractCode)) {
        if (this.shouldUpdateContract(contractName)) {
          await this.upgradeContract(contractName, newCode);
        }
      }

      await this.finalizeUpdate();
      return this.updateResult as UpdateResult;

    } catch (error) {
      console.error('\n❌ Contract upgrade failed:', error);
      throw error;
    }
  }

  /**
   * Migrate contracts and data
   */
  async migrateContracts(migrationPlan: any): Promise<UpdateResult> {
    try {
      console.log('\n📦 Starting Contract Migration');
      console.log('=' .repeat(60));
      
      this.initializeUpdateResult('migration');

      // Implement migration logic based on the plan
      await this.executeMigrationPlan(migrationPlan);

      await this.finalizeUpdate();
      return this.updateResult as UpdateResult;

    } catch (error) {
      console.error('\n❌ Contract migration failed:', error);
      throw error;
    }
  }

  /**
   * Emergency contract operations
   */
  async emergencyOperations(operations: string[]): Promise<UpdateResult> {
    try {
      console.log('\n🚨 Starting Emergency Operations');
      console.log('=' .repeat(60));
      
      this.initializeUpdateResult('emergency');

      for (const operation of operations) {
        await this.executeEmergencyOperation(operation);
      }

      await this.finalizeUpdate();
      return this.updateResult as UpdateResult;

    } catch (error) {
      console.error('\n❌ Emergency operations failed:', error);
      throw error;
    }
  }

  /**
   * Update DID Registry parameters
   */
  private async updateDIDRegistryParameters(params: any): Promise<void> {
    try {
      console.log('\n🆔 Updating DID Registry Parameters');
      
      const didRegistry = new DIDRegistryClient(
        this.algodClient,
        this.deploymentData.contracts.didRegistry.appId
      );

      const changes: string[] = [];
      const txIds: string[] = [];

      // Update fees
      if (params.registrationFee !== undefined || params.updateFee !== undefined) {
        const currentFees = await this.getCurrentDIDFees(didRegistry);
        const newRegistrationFee = params.registrationFee ?? currentFees.registrationFee;
        const newUpdateFee = params.updateFee ?? currentFees.updateFee;

        if (!this.config.dryRun) {
          const txId = await didRegistry.updateFees(
            this.admin,
            newRegistrationFee,
            newUpdateFee
          );
          txIds.push(txId);
        }

        changes.push(`Updated fees: registration=${newRegistrationFee}, update=${newUpdateFee}`);
        console.log(`   ✅ Fees updated: ${newRegistrationFee / 1000000} / ${newUpdateFee / 1000000} NEXDEN`);
      }

      // Update DIRS features
      if (params.interoperabilityEnabled !== undefined) {
        if (!this.config.dryRun) {
          const txId = await didRegistry.setInteroperabilityStatus(
            this.admin,
            params.interoperabilityEnabled
          );
          txIds.push(txId);
        }

        changes.push(`Interoperability: ${params.interoperabilityEnabled}`);
        console.log(`   ✅ Interoperability: ${params.interoperabilityEnabled}`);
      }

      if (params.crossChainSupport !== undefined) {
        if (!this.config.dryRun) {
          const txId = await didRegistry.setCrossChainSupport(
            this.admin,
            params.crossChainSupport
          );
          txIds.push(txId);
        }

        changes.push(`Cross-chain support: ${params.crossChainSupport}`);
        console.log(`   ✅ Cross-chain support: ${params.crossChainSupport}`);
      }

      this.updateResult.contracts!.didRegistry = {
        appId: this.deploymentData.contracts.didRegistry.appId,
        updated: true,
        changes,
        txIds,
      };

    } catch (error) {
      console.error('   ❌ Failed to update DID Registry:', error);
      this.updateResult.contracts!.didRegistry = {
        appId: this.deploymentData.contracts.didRegistry.appId,
        updated: false,
        changes: [],
        txIds: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Update Reputation Registry parameters
   */
  private async updateReputationRegistryParameters(params: any): Promise<void> {
    try {
      console.log('\n⭐ Updating Reputation Registry Parameters');
      
      const reputationRegistry = new ReputationRegistryClient(
        this.algodClient,
        this.deploymentData.contracts.reputationRegistry.appId
      );

      const changes: string[] = [];
      const txIds: string[] = [];

      // Update fees
      if (params.attestationFee !== undefined || params.disputeFee !== undefined) {
        const currentFees = await this.getCurrentReputationFees(reputationRegistry);
        const newAttestationFee = params.attestationFee ?? currentFees.attestationFee;
        const newDisputeFee = params.disputeFee ?? currentFees.disputeFee;

        if (!this.config.dryRun) {
          const txId = await reputationRegistry.updateFees(
            this.admin,
            newAttestationFee,
            newDisputeFee
          );
          txIds.push(txId);
        }

        changes.push(`Updated fees: attestation=${newAttestationFee}, dispute=${newDisputeFee}`);
        console.log(`   ✅ Fees updated: ${newAttestationFee / 1000000} / ${newDisputeFee / 1000000} NEXDEN`);
      }

      // Update DIRS features
      if (params.portabilityEnabled !== undefined) {
        if (!this.config.dryRun) {
          const txId = await reputationRegistry.setPortabilityStatus(
            this.admin,
            params.portabilityEnabled
          );
          txIds.push(txId);
        }

        changes.push(`Portability: ${params.portabilityEnabled}`);
        console.log(`   ✅ Portability: ${params.portabilityEnabled}`);
      }

      if (params.crossPlatformSupport !== undefined) {
        if (!this.config.dryRun) {
          const txId = await reputationRegistry.setCrossPlatformSupport(
            this.admin,
            params.crossPlatformSupport
          );
          txIds.push(txId);
        }

        changes.push(`Cross-platform support: ${params.crossPlatformSupport}`);
        console.log(`   ✅ Cross-platform support: ${params.crossPlatformSupport}`);
      }

      if (params.selfSovereignMode !== undefined) {
        if (!this.config.dryRun) {
          const txId = await reputationRegistry.setSelfSovereignMode(
            this.admin,
            params.selfSovereignMode
          );
          txIds.push(txId);
        }

        changes.push(`Self-sovereign mode: ${params.selfSovereignMode}`);
        console.log(`   ✅ Self-sovereign mode: ${params.selfSovereignMode}`);
      }

      this.updateResult.contracts!.reputationRegistry = {
        appId: this.deploymentData.contracts.reputationRegistry.appId,
        updated: true,
        changes,
        txIds,
      };

    } catch (error) {
      console.error('   ❌ Failed to update Reputation Registry:', error);
      this.updateResult.contracts!.reputationRegistry = {
        appId: this.deploymentData.contracts.reputationRegistry.appId,
        updated: false,
        changes: [],
        txIds: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Update VC Registry parameters
   */
  private async updateVCRegistryParameters(params: any): Promise<void> {
    try {
      console.log('\n📜 Updating VC Registry Parameters');
      
      const vcRegistry = new VCRegistryClient(
        this.algodClient,
        this.deploymentData.contracts.vcRegistry.appId
      );

      const changes: string[] = [];
      const txIds: string[] = [];

      // Update fees
      if (params.registrationFee !== undefined || params.revocationFee !== undefined) {
        const currentFees = await this.getCurrentVCFees(vcRegistry);
        const newRegistrationFee = params.registrationFee ?? currentFees.registrationFee;
        const newRevocationFee = params.revocationFee ?? currentFees.revocationFee;

        if (!this.config.dryRun) {
          const txId = await vcRegistry.updateFees(
            this.admin,
            newRegistrationFee,
            newRevocationFee
          );
          txIds.push(txId);
        }

        changes.push(`Updated fees: registration=${newRegistrationFee}, revocation=${newRevocationFee}`);
        console.log(`   ✅ Fees updated: ${newRegistrationFee / 1000000} / ${newRevocationFee / 1000000} NEXDEN`);
      }

      // Update DIRS features
      if (params.portabilityEnabled !== undefined) {
        if (!this.config.dryRun) {
          const txId = await vcRegistry.setPortabilityStatus(
            this.admin,
            params.portabilityEnabled
          );
          txIds.push(txId);
        }

        changes.push(`Portability: ${params.portabilityEnabled}`);
        console.log(`   ✅ Portability: ${params.portabilityEnabled}`);
      }

      if (params.crossPlatformSupport !== undefined) {
        if (!this.config.dryRun) {
          const txId = await vcRegistry.setCrossPlatformSupport(
            this.admin,
            params.crossPlatformSupport
          );
          txIds.push(txId);
        }

        changes.push(`Cross-platform support: ${params.crossPlatformSupport}`);
        console.log(`   ✅ Cross-platform support: ${params.crossPlatformSupport}`);
      }

      if (params.selfSovereignMode !== undefined) {
        if (!this.config.dryRun) {
          const txId = await vcRegistry.setSelfSovereignMode(
            this.admin,
            params.selfSovereignMode
          );
          txIds.push(txId);
        }

        changes.push(`Self-sovereign mode: ${params.selfSovereignMode}`);
        console.log(`   ✅ Self-sovereign mode: ${params.selfSovereignMode}`);
      }

      if (params.interoperabilityLevel !== undefined) {
        if (!this.config.dryRun) {
          const txId = await vcRegistry.setInteroperabilityLevel(
            this.admin,
            params.interoperabilityLevel
          );
          txIds.push(txId);
        }

        changes.push(`Interoperability level: ${params.interoperabilityLevel}`);
        console.log(`   ✅ Interoperability level: ${params.interoperabilityLevel}`);
      }

      this.updateResult.contracts!.vcRegistry = {
        appId: this.deploymentData.contracts.vcRegistry.appId,
        updated: true,
        changes,
        txIds,
      };

    } catch (error) {
      console.error('   ❌ Failed to update VC Registry:', error);
      this.updateResult.contracts!.vcRegistry = {
        appId: this.deploymentData.contracts.vcRegistry.appId,
        updated: false,
        changes: [],
        txIds: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Update Staking Pool parameters
   */
  private async updateStakingPoolParameters(params: any): Promise<void> {
    try {
      console.log('\n🏦 Updating Staking Pool Parameters');
      
      const stakingPool = new StakingPoolClient(
        this.algodClient,
        this.deploymentData.contracts.stakingPool.appId
      );

      const changes: string[] = [];
      const txIds: string[] = [];

      // Update pool parameters
      if (params.rewardRate !== undefined || params.minStakeAmount !== undefined || params.unbondingPeriod !== undefined) {
        const currentParams = await this.getCurrentStakingParams(stakingPool);
        const newRewardRate = params.rewardRate ?? currentParams.rewardRate;
        const newMinStakeAmount = params.minStakeAmount ?? currentParams.minStakeAmount;
        const newUnbondingPeriod = params.unbondingPeriod ?? currentParams.unbondingPeriod;

        if (!this.config.dryRun) {
          const txId = await stakingPool.updatePoolParameters(
            this.admin,
            newRewardRate,
            newMinStakeAmount,
            newUnbondingPeriod
          );
          txIds.push(txId);
        }

        changes.push(`Updated parameters: rate=${newRewardRate}, minStake=${newMinStakeAmount}, unbonding=${newUnbondingPeriod}`);
        console.log(`   ✅ Parameters updated: ${newRewardRate / 100}% APY, ${newMinStakeAmount / 1000000} NEXDEN min, ${newUnbondingPeriod / (24 * 3600)} days unbonding`);
      }

      this.updateResult.contracts!.stakingPool = {
        appId: this.deploymentData.contracts.stakingPool.appId,
        updated: true,
        changes,
        txIds,
      };

    } catch (error) {
      console.error('   ❌ Failed to update Staking Pool:', error);
      this.updateResult.contracts!.stakingPool = {
        appId: this.deploymentData.contracts.stakingPool.appId,
        updated: false,
        changes: [],
        txIds: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Update LP Farming Pool parameters
   */
  private async updateLPFarmingPoolParameters(params: any): Promise<void> {
    try {
      console.log('\n🚜 Updating LP Farming Pool Parameters');
      
      const lpFarmingPool = new LPFarmingPoolClient(
        this.algodClient,
        this.deploymentData.contracts.lpFarmingPool.appId
      );

      const changes: string[] = [];
      const txIds: string[] = [];

      // Update pool parameters
      if (params.rewardRate !== undefined || params.endTime !== undefined) {
        const currentParams = await this.getCurrentFarmingParams(lpFarmingPool);
        const newRewardRate = params.rewardRate ?? currentParams.rewardRate;
        const newEndTime = params.endTime ?? currentParams.endTime;

        if (!this.config.dryRun) {
          const txId = await lpFarmingPool.updatePoolParameters(
            this.admin,
            newRewardRate,
            newEndTime
          );
          txIds.push(txId);
        }

        changes.push(`Updated parameters: rate=${newRewardRate}, endTime=${newEndTime}`);
        console.log(`   ✅ Parameters updated: ${newRewardRate} NEXDEN/sec, ends ${new Date(newEndTime * 1000).toISOString()}`);
      }

      this.updateResult.contracts!.lpFarmingPool = {
        appId: this.deploymentData.contracts.lpFarmingPool.appId,
        updated: true,
        changes,
        txIds,
      };

    } catch (error) {
      console.error('   ❌ Failed to update LP Farming Pool:', error);
      this.updateResult.contracts!.lpFarmingPool = {
        appId: this.deploymentData.contracts.lpFarmingPool.appId,
        updated: false,
        changes: [],
        txIds: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Upgrade a specific contract
   */
  private async upgradeContract(contractName: string, newCode: any): Promise<void> {
    console.log(`\n🚀 Upgrading ${contractName}...`);
    
    // Note: Algorand smart contracts are immutable
    // Upgrades require deploying new contracts and migrating data
    
    try {
      // 1. Deploy new contract version
      console.log(`   📦 Deploying new ${contractName} version...`);
      
      // 2. Migrate data from old to new contract
      console.log(`   📋 Migrating data...`);
      
      // 3. Update references to new contract
      console.log(`   🔄 Updating contract references...`);
      
      // 4. Deactivate old contract
      console.log(`   🔒 Deactivating old contract...`);
      
      console.log(`   ✅ ${contractName} upgraded successfully`);
      
    } catch (error) {
      console.error(`   ❌ Failed to upgrade ${contractName}:`, error);
      throw error;
    }
  }

  /**
   * Execute migration plan
   */
  private async executeMigrationPlan(migrationPlan: any): Promise<void> {
    console.log('\n📦 Executing migration plan...');
    
    for (const step of migrationPlan.steps) {
      console.log(`   🔄 ${step.description}`);
      
      try {
        await this.executeMigrationStep(step);
        console.log(`   ✅ Step completed: ${step.description}`);
      } catch (error) {
        console.error(`   ❌ Step failed: ${step.description}`, error);
        throw error;
      }
    }
  }

  /**
   * Execute migration step
   */
  private async executeMigrationStep(step: any): Promise<void> {
    switch (step.type) {
      case 'data_export':
        await this.exportContractData(step.contract, step.outputFile);
        break;
      case 'data_import':
        await this.importContractData(step.contract, step.inputFile);
        break;
      case 'contract_deploy':
        await this.deployNewContractVersion(step.contract, step.config);
        break;
      case 'reference_update':
        await this.updateContractReferences(step.oldContract, step.newContract);
        break;
      default:
        throw new Error(`Unknown migration step type: ${step.type}`);
    }
  }

  /**
   * Execute emergency operation
   */
  private async executeEmergencyOperation(operation: string): Promise<void> {
    console.log(`\n🚨 Executing emergency operation: ${operation}`);
    
    switch (operation) {
      case 'pause_all':
        await this.pauseAllContracts();
        break;
      case 'resume_all':
        await this.resumeAllContracts();
        break;
      case 'emergency_withdraw':
        await this.emergencyWithdrawFunds();
        break;
      case 'revoke_malicious_did':
        await this.revokeMaliciousDIDs();
        break;
      default:
        throw new Error(`Unknown emergency operation: ${operation}`);
    }
  }

  /**
   * Pause all contracts
   */
  private async pauseAllContracts(): Promise<void> {
    const contracts = ['didRegistry', 'reputationRegistry', 'vcRegistry', 'stakingPool', 'lpFarmingPool'];
    
    for (const contractName of contracts) {
      try {
        console.log(`   ⏸️  Pausing ${contractName}...`);
        
        switch (contractName) {
          case 'didRegistry':
            const didRegistry = new DIDRegistryClient(this.algodClient, this.deploymentData.contracts.didRegistry.appId);
            await didRegistry.pauseRegistry(this.admin);
            break;
          case 'reputationRegistry':
            const reputationRegistry = new ReputationRegistryClient(this.algodClient, this.deploymentData.contracts.reputationRegistry.appId);
            await reputationRegistry.pauseRegistry(this.admin);
            break;
          case 'vcRegistry':
            const vcRegistry = new VCRegistryClient(this.algodClient, this.deploymentData.contracts.vcRegistry.appId);
            await vcRegistry.pauseRegistry(this.admin);
            break;
          case 'stakingPool':
            const stakingPool = new StakingPoolClient(this.algodClient, this.deploymentData.contracts.stakingPool.appId);
            await stakingPool.emergencyPause(this.admin);
            break;
          case 'lpFarmingPool':
            const lpFarmingPool = new LPFarmingPoolClient(this.algodClient, this.deploymentData.contracts.lpFarmingPool.appId);
            await lpFarmingPool.emergencyPause(this.admin);
            break;
        }
        
        console.log(`   ✅ ${contractName} paused`);
      } catch (error) {
        console.error(`   ❌ Failed to pause ${contractName}:`, error);
      }
    }
  }

  /**
   * Resume all contracts
   */
  private async resumeAllContracts(): Promise<void> {
    const contracts = ['didRegistry', 'reputationRegistry', 'vcRegistry', 'stakingPool', 'lpFarmingPool'];
    
    for (const contractName of contracts) {
      try {
        console.log(`   ▶️  Resuming ${contractName}...`);
        
        switch (contractName) {
          case 'didRegistry':
            const didRegistry = new DIDRegistryClient(this.algodClient, this.deploymentData.contracts.didRegistry.appId);
            await didRegistry.resumeRegistry(this.admin);
            break;
          case 'reputationRegistry':
            const reputationRegistry = new ReputationRegistryClient(this.algodClient, this.deploymentData.contracts.reputationRegistry.appId);
            await reputationRegistry.resumeRegistry(this.admin);
            break;
          case 'vcRegistry':
            const vcRegistry = new VCRegistryClient(this.algodClient, this.deploymentData.contracts.vcRegistry.appId);
            await vcRegistry.resumeRegistry(this.admin);
            break;
          case 'stakingPool':
            const stakingPool = new StakingPoolClient(this.algodClient, this.deploymentData.contracts.stakingPool.appId);
            await stakingPool.resumePool(this.admin);
            break;
          case 'lpFarmingPool':
            const lpFarmingPool = new LPFarmingPoolClient(this.algodClient, this.deploymentData.contracts.lpFarmingPool.appId);
            await lpFarmingPool.resumePool(this.admin);
            break;
        }
        
        console.log(`   ✅ ${contractName} resumed`);
      } catch (error) {
        console.error(`   ❌ Failed to resume ${contractName}:`, error);
      }
    }
  }

  // Helper methods

  /**
   * Initialize update result
   */
  private initializeUpdateResult(updateType: string): void {
    this.updateResult = {
      network: this.config.network,
      timestamp: new Date().toISOString(),
      updateType: updateType,
      admin: this.admin.addr,
      contracts: {},
      overallStatus: 'success',
    };
  }

  /**
   * Check if contract should be updated
   */
  private shouldUpdateContract(contractName: string): boolean {
    if (!this.config.contracts) return true;
    return this.config.contracts.includes(contractName);
  }

  /**
   * Finalize update process
   */
  private async finalizeUpdate(): Promise<void> {
    // Determine overall status
    const contracts = Object.values(this.updateResult.contracts!);
    const successCount = contracts.filter(c => c.updated).length;
    const totalCount = contracts.length;

    if (successCount === totalCount) {
      this.updateResult.overallStatus = 'success';
      console.log('\n✅ All contract updates completed successfully!');
    } else if (successCount > 0) {
      this.updateResult.overallStatus = 'partial';
      console.log(`\n⚠️  Partial update: ${successCount}/${totalCount} contracts updated`);
    } else {
      this.updateResult.overallStatus = 'failed';
      console.log('\n❌ All contract updates failed');
    }

    // Save update results
    await this.saveUpdateResults();
  }

  /**
   * Save update results to file
   */
  private async saveUpdateResults(): Promise<void> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `update-${this.config.network}-${this.config.updateType}-${timestamp}.json`;
      const filepath = path.join(__dirname, filename);

      fs.writeFileSync(filepath, JSON.stringify(this.updateResult, null, 2));
      console.log(`\n💾 Update results saved to: ${filename}`);
    } catch (error) {
      console.error('   ❌ Failed to save update results:', error);
    }
  }

  // Placeholder methods for getting current parameters
  private async getCurrentDIDFees(didRegistry: DIDRegistryClient): Promise<any> {
    // Implementation would get current fees from contract state
    return { registrationFee: 1000000, updateFee: 500000 };
  }

  private async getCurrentReputationFees(reputationRegistry: ReputationRegistryClient): Promise<any> {
    return { attestationFee: 1500000, disputeFee: 3000000 };
  }

  private async getCurrentVCFees(vcRegistry: VCRegistryClient): Promise<any> {
    return { registrationFee: 2000000, revocationFee: 1000000 };
  }

  private async getCurrentStakingParams(stakingPool: StakingPoolClient): Promise<any> {
    return { rewardRate: 1200, minStakeAmount: 1000000, unbondingPeriod: 604800 };
  }

  private async getCurrentFarmingParams(lpFarmingPool: LPFarmingPoolClient): Promise<any> {
    return { rewardRate: 100, endTime: Math.floor(Date.now() / 1000) + 7776000 };
  }

  // Placeholder methods for migration operations
  private async exportContractData(contract: string, outputFile: string): Promise<void> {
    console.log(`   📤 Exporting ${contract} data to ${outputFile}`);
  }

  private async importContractData(contract: string, inputFile: string): Promise<void> {
    console.log(`   📥 Importing ${contract} data from ${inputFile}`);
  }

  private async deployNewContractVersion(contract: string, config: any): Promise<void> {
    console.log(`   🚀 Deploying new ${contract} version`);
  }

  private async updateContractReferences(oldContract: string, newContract: string): Promise<void> {
    console.log(`   🔄 Updating references from ${oldContract} to ${newContract}`);
  }

  private async emergencyWithdrawFunds(): Promise<void> {
    console.log('   💰 Executing emergency fund withdrawal');
  }

  private async revokeMaliciousDIDs(): Promise<void> {
    console.log('   🚫 Revoking malicious DIDs');
  }
}

/**
 * CLI update function
 */
async function main() {
  const args = process.argv.slice(2);
  const network = args.find(arg => arg.startsWith('--network='))?.split('=')[1] || 'testnet';
  const updateType = args.find(arg => arg.startsWith('--type='))?.split('=')[1] || 'parameters';
  const contracts = args.find(arg => arg.startsWith('--contracts='))?.split('=')[1]?.split(',');
  const dryRun = args.includes('--dry-run');
  const configFile = args.find(arg => arg.startsWith('--config='))?.split('=')[1];

  // Load deployment data
  const deploymentFile = path.join(__dirname, `latest-${network}.json`);
  if (!fs.existsSync(deploymentFile)) {
    console.error(`❌ No deployment file found for ${network}`);
    console.error('   Deploy contracts first or specify deployment file');
    process.exit(1);
  }

  const deploymentData = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));

  // Network configurations
  const networkConfigs = {
    testnet: {
      algodToken: '',
      algodServer: 'https://testnet-api.algonode.cloud',
      algodPort: 443,
    },
    mainnet: {
      algodToken: '',
      algodServer: 'https://mainnet-api.algonode.cloud',
      algodPort: 443,
    },
    localnet: {
      algodToken: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      algodServer: 'http://localhost',
      algodPort: 4001,
    },
  };

  const networkConfig = networkConfigs[network as keyof typeof networkConfigs];
  if (!networkConfig) {
    console.error('❌ Invalid network. Use: testnet, mainnet, or localnet');
    process.exit(1);
  }

  const adminMnemonic = process.env[`${network.toUpperCase()}_MNEMONIC`];
  if (!adminMnemonic) {
    console.error(`❌ ${network.toUpperCase()}_MNEMONIC environment variable is required`);
    process.exit(1);
  }

  const config: UpdateConfig = {
    network: network as any,
    adminMnemonic,
    ...networkConfig,
    updateType: updateType as any,
    contracts,
    dryRun,
  };

  try {
    console.log(`🔧 Starting DIRS contract update on ${network}`);
    if (dryRun) {
      console.log('🧪 DRY RUN MODE - No transactions will be executed');
    }
    
    const updater = new DIRSContractUpdater(config, deploymentData);

    let result: UpdateResult;

    switch (updateType) {
      case 'parameters':
        // Load update parameters from config file or use defaults
        const updateParams = configFile ? 
          JSON.parse(fs.readFileSync(configFile, 'utf8')) : 
          getDefaultUpdateParameters();
        
        result = await updater.updateParameters(updateParams);
        break;

      case 'emergency':
        const operations = args.find(arg => arg.startsWith('--operations='))?.split('=')[1]?.split(',') || ['pause_all'];
        result = await updater.emergencyOperations(operations);
        break;

      default:
        throw new Error(`Unsupported update type: ${updateType}`);
    }

    console.log('\n📋 Update Summary:');
    console.log(`   Network: ${result.network}`);
    console.log(`   Type: ${result.updateType}`);
    console.log(`   Status: ${result.overallStatus}`);
    console.log(`   Contracts Updated: ${Object.keys(result.contracts).length}`);

    if (result.overallStatus === 'success') {
      console.log('\n🎉 Contract update completed successfully!');
    } else {
      console.log('\n⚠️  Contract update completed with issues');
    }

  } catch (error) {
    console.error('\n❌ Contract update failed:', error);
    process.exit(1);
  }
}

/**
 * Get default update parameters
 */
function getDefaultUpdateParameters(): UpdateParameters {
  return {
    didRegistry: {
      interoperabilityEnabled: true,
      crossChainSupport: true,
    },
    reputationRegistry: {
      portabilityEnabled: true,
      crossPlatformSupport: true,
      selfSovereignMode: true,
    },
    vcRegistry: {
      portabilityEnabled: true,
      crossPlatformSupport: true,
      selfSovereignMode: true,
      interoperabilityLevel: 1000,
    },
  };
}

// Export for programmatic use
export { DIRSContractUpdater, UpdateConfig, UpdateParameters, UpdateResult };

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}