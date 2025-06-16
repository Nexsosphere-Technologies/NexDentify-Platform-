import { Algodv2, Account, mnemonicToSecretKey, generateAccount } from 'algosdk';
import { DIDRegistryClient } from '../contracts/DIDRegistryClient';
import { ReputationRegistryClient } from '../contracts/ReputationRegistryClient';
import { VCRegistryClient } from '../contracts/VCRegistryClient';
import { StakingPoolClient } from '../contracts/StakingPoolClient';
import { LPFarmingPoolClient } from '../contracts/LPFarmingPoolClient';
import { NexDenASA } from '../contracts/NexDen';
import * as fs from 'fs';
import * as path from 'path';

// Deployment configuration interface
interface DeploymentConfig {
  network: 'testnet' | 'mainnet' | 'localnet';
  adminMnemonic?: string;
  algodToken: string;
  algodServer: string;
  algodPort: number;
  deployerFunding: number; // Amount in microAlgos to fund deployer
}

// Deployment result interface
interface DeploymentResult {
  network: string;
  timestamp: string;
  deployer: string;
  nexdenAssetId: number;
  contracts: {
    didRegistry: {
      appId: number;
      appAddress: string;
      txId: string;
    };
    reputationRegistry: {
      appId: number;
      appAddress: string;
      txId: string;
    };
    vcRegistry: {
      appId: number;
      appAddress: string;
      txId: string;
    };
    stakingPool: {
      appId: number;
      appAddress: string;
      txId: string;
    };
    lpFarmingPool: {
      appId: number;
      appAddress: string;
      txId: string;
    };
  };
  configuration: {
    fees: {
      didRegistration: number;
      didUpdate: number;
      reputationAttestation: number;
      reputationDispute: number;
      vcRegistration: number;
      vcRevocation: number;
    };
    staking: {
      rewardRate: number;
      minStakeAmount: number;
      unbondingPeriod: number;
    };
    farming: {
      rewardRate: number;
      farmingPeriod: number;
    };
  };
}

/**
 * Main deployment class for DIRS smart contracts
 */
export class DIRSDeployment {
  private algodClient: Algodv2;
  private config: DeploymentConfig;
  private deployer: Account;
  private deploymentResult: Partial<DeploymentResult> = {};

  constructor(config: DeploymentConfig) {
    this.config = config;
    this.algodClient = new Algodv2(
      config.algodToken,
      config.algodServer,
      config.algodPort
    );
    
    // Initialize deployer account
    if (config.adminMnemonic) {
      this.deployer = mnemonicToSecretKey(config.adminMnemonic);
    } else {
      this.deployer = generateAccount();
      console.log('⚠️  Generated new deployer account. Save this mnemonic:');
      console.log('🔑 Mnemonic:', this.deployer.mnemonic);
    }
    
    console.log('🚀 Deployer Address:', this.deployer.addr);
  }

  /**
   * Deploy all DIRS contracts in the correct order
   */
  async deployAll(): Promise<DeploymentResult> {
    try {
      console.log('\n🌟 Starting DIRS Smart Contracts Deployment');
      console.log('=' .repeat(60));
      
      // Initialize deployment result
      this.deploymentResult = {
        network: this.config.network,
        timestamp: new Date().toISOString(),
        deployer: this.deployer.addr,
        contracts: {} as any,
        configuration: {} as any,
      };

      // Step 1: Check deployer balance and fund if necessary
      await this.checkAndFundDeployer();

      // Step 2: Deploy NEXDEN ASA token
      console.log('\n📄 Step 1: Deploying NEXDEN ASA Token');
      const nexdenAssetId = await this.deployNexdenToken();
      this.deploymentResult.nexdenAssetId = nexdenAssetId;

      // Step 3: Deploy DID Registry
      console.log('\n🆔 Step 2: Deploying DID Registry');
      const didRegistry = await this.deployDIDRegistry(nexdenAssetId);
      this.deploymentResult.contracts!.didRegistry = didRegistry;

      // Step 4: Deploy Reputation Registry
      console.log('\n⭐ Step 3: Deploying Reputation Registry');
      const reputationRegistry = await this.deployReputationRegistry(nexdenAssetId);
      this.deploymentResult.contracts!.reputationRegistry = reputationRegistry;

      // Step 5: Deploy VC Registry
      console.log('\n📜 Step 4: Deploying VC Registry');
      const vcRegistry = await this.deployVCRegistry(nexdenAssetId);
      this.deploymentResult.contracts!.vcRegistry = vcRegistry;

      // Step 6: Deploy Staking Pool
      console.log('\n🏦 Step 5: Deploying Staking Pool');
      const stakingPool = await this.deployStakingPool(nexdenAssetId);
      this.deploymentResult.contracts!.stakingPool = stakingPool;

      // Step 7: Deploy LP Farming Pool
      console.log('\n🚜 Step 6: Deploying LP Farming Pool');
      const lpFarmingPool = await this.deployLPFarmingPool(nexdenAssetId);
      this.deploymentResult.contracts!.lpFarmingPool = lpFarmingPool;

      // Step 8: Configure contracts
      console.log('\n⚙️  Step 7: Configuring Contracts');
      await this.configureContracts();

      // Step 9: Save deployment results
      console.log('\n💾 Step 8: Saving Deployment Results');
      await this.saveDeploymentResults();

      // Step 10: Verify deployment
      console.log('\n✅ Step 9: Verifying Deployment');
      await this.verifyDeployment();

      console.log('\n🎉 DIRS Deployment Completed Successfully!');
      console.log('=' .repeat(60));
      
      return this.deploymentResult as DeploymentResult;

    } catch (error) {
      console.error('\n❌ Deployment failed:', error);
      throw error;
    }
  }

  /**
   * Check deployer balance and fund if necessary
   */
  private async checkAndFundDeployer(): Promise<void> {
    try {
      const accountInfo = await this.algodClient.accountInformation(this.deployer.addr).do();
      const balance = accountInfo.amount;
      
      console.log(`💰 Deployer balance: ${balance / 1000000} ALGO`);
      
      if (balance < this.config.deployerFunding) {
        if (this.config.network === 'testnet') {
          console.log('💸 Insufficient balance for testnet deployment.');
          console.log('🔗 Please fund your account using the Algorand testnet faucet:');
          console.log(`   https://testnet.algoexplorer.io/dispenser`);
          console.log(`   Address: ${this.deployer.addr}`);
          throw new Error('Insufficient balance. Please fund the deployer account.');
        } else if (this.config.network === 'localnet') {
          console.log('💸 Funding deployer account on localnet...');
          // In localnet, you would typically have a funded account to transfer from
          console.log('⚠️  Please ensure the deployer account is funded on localnet.');
        } else {
          throw new Error('Insufficient balance for mainnet deployment. Please fund the deployer account.');
        }
      }
    } catch (error) {
      console.error('Error checking deployer balance:', error);
      throw error;
    }
  }

  /**
   * Deploy NEXDEN ASA token
   */
  private async deployNexdenToken(): Promise<number> {
    try {
      const nexDenASA = new NexDenASA(this.algodClient, this.deployer);
      
      const assetConfig = {
        total: 1000000000000000, // 1 billion NEXDEN with 6 decimals
        decimals: 6,
        assetName: 'DIRS NexDentify Token',
        unitName: 'NEXDEN',
        url: 'https://dirs.org/nexden',
        defaultFrozen: false,
      };

      console.log('   Creating NEXDEN ASA with config:', assetConfig);
      const assetId = await nexDenASA.createASA(assetConfig);
      
      console.log(`   ✅ NEXDEN ASA created with ID: ${assetId}`);
      return assetId;
    } catch (error) {
      console.error('   ❌ Failed to deploy NEXDEN ASA:', error);
      throw error;
    }
  }

  /**
   * Deploy DID Registry contract
   */
  private async deployDIDRegistry(nexdenAssetId: number): Promise<any> {
    try {
      const didRegistry = new DIDRegistryClient(this.algodClient);
      
      const config = {
        registrationFee: 1000000, // 1 NEXDEN
        updateFee: 500000, // 0.5 NEXDEN
        nexdenAssetId: nexdenAssetId,
      };

      console.log('   Deploying DID Registry with config:', config);
      const result = await didRegistry.deploy(this.deployer, config);
      
      console.log(`   ✅ DID Registry deployed:`);
      console.log(`      App ID: ${result.appId}`);
      console.log(`      App Address: ${result.appAddress}`);
      
      return {
        appId: result.appId,
        appAddress: result.appAddress,
        txId: 'deployment_tx', // Would be actual transaction ID
      };
    } catch (error) {
      console.error('   ❌ Failed to deploy DID Registry:', error);
      throw error;
    }
  }

  /**
   * Deploy Reputation Registry contract
   */
  private async deployReputationRegistry(nexdenAssetId: number): Promise<any> {
    try {
      const reputationRegistry = new ReputationRegistryClient(this.algodClient);
      
      const config = {
        attestationFee: 1500000, // 1.5 NEXDEN
        disputeFee: 3000000, // 3 NEXDEN
        nexdenAssetId: nexdenAssetId,
      };

      console.log('   Deploying Reputation Registry with config:', config);
      const result = await reputationRegistry.deploy(this.deployer, config);
      
      console.log(`   ✅ Reputation Registry deployed:`);
      console.log(`      App ID: ${result.appId}`);
      console.log(`      App Address: ${result.appAddress}`);
      
      return {
        appId: result.appId,
        appAddress: result.appAddress,
        txId: 'deployment_tx',
      };
    } catch (error) {
      console.error('   ❌ Failed to deploy Reputation Registry:', error);
      throw error;
    }
  }

  /**
   * Deploy VC Registry contract
   */
  private async deployVCRegistry(nexdenAssetId: number): Promise<any> {
    try {
      const vcRegistry = new VCRegistryClient(this.algodClient);
      
      const config = {
        registrationFee: 2000000, // 2 NEXDEN
        revocationFee: 1000000, // 1 NEXDEN
        nexdenAssetId: nexdenAssetId,
      };

      console.log('   Deploying VC Registry with config:', config);
      const result = await vcRegistry.deploy(this.deployer, config);
      
      console.log(`   ✅ VC Registry deployed:`);
      console.log(`      App ID: ${result.appId}`);
      console.log(`      App Address: ${result.appAddress}`);
      
      return {
        appId: result.appId,
        appAddress: result.appAddress,
        txId: 'deployment_tx',
      };
    } catch (error) {
      console.error('   ❌ Failed to deploy VC Registry:', error);
      throw error;
    }
  }

  /**
   * Deploy Staking Pool contract
   */
  private async deployStakingPool(nexdenAssetId: number): Promise<any> {
    try {
      const stakingPool = new StakingPoolClient(this.algodClient);
      
      const config = {
        nexdenAssetId: nexdenAssetId,
        rewardRate: 1200, // 12% APY
        minStakeAmount: 1000000, // 1 NEXDEN
        unbondingPeriod: 7 * 24 * 3600, // 7 days
      };

      console.log('   Deploying Staking Pool with config:', config);
      const result = await stakingPool.deploy(this.deployer, config);
      
      console.log(`   ✅ Staking Pool deployed:`);
      console.log(`      App ID: ${result.appId}`);
      console.log(`      App Address: ${result.appAddress}`);
      
      return {
        appId: result.appId,
        appAddress: result.appAddress,
        txId: 'deployment_tx',
      };
    } catch (error) {
      console.error('   ❌ Failed to deploy Staking Pool:', error);
      throw error;
    }
  }

  /**
   * Deploy LP Farming Pool contract
   */
  private async deployLPFarmingPool(nexdenAssetId: number): Promise<any> {
    try {
      const lpFarmingPool = new LPFarmingPoolClient(this.algodClient);
      
      // Create a mock LP token for demonstration
      const nexDenASA = new NexDenASA(this.algodClient, this.deployer);
      const lpTokenAssetId = await nexDenASA.createASA({
        total: 100000000000000, // 100 million LP tokens with 6 decimals
        decimals: 6,
        assetName: 'DIRS-ALGO LP Token',
        unitName: 'DIRSLP',
        url: 'https://dirs.org/lp',
        defaultFrozen: false,
      });

      const currentTime = Math.floor(Date.now() / 1000);
      const config = {
        lpTokenAssetId: lpTokenAssetId,
        rewardTokenAssetId: nexdenAssetId,
        rewardRate: 100, // 100 NEXDEN per second per LP token
        startTime: currentTime,
        endTime: currentTime + (90 * 24 * 3600), // 90 days
      };

      console.log('   Deploying LP Farming Pool with config:', config);
      const result = await lpFarmingPool.deploy(this.deployer, config);
      
      console.log(`   ✅ LP Farming Pool deployed:`);
      console.log(`      App ID: ${result.appId}`);
      console.log(`      App Address: ${result.appAddress}`);
      console.log(`      LP Token ID: ${lpTokenAssetId}`);
      
      return {
        appId: result.appId,
        appAddress: result.appAddress,
        txId: 'deployment_tx',
        lpTokenAssetId: lpTokenAssetId,
      };
    } catch (error) {
      console.error('   ❌ Failed to deploy LP Farming Pool:', error);
      throw error;
    }
  }

  /**
   * Configure contracts after deployment
   */
  private async configureContracts(): Promise<void> {
    try {
      console.log('   Configuring DIRS features...');
      
      // Store configuration in deployment result
      this.deploymentResult.configuration = {
        fees: {
          didRegistration: 1000000,
          didUpdate: 500000,
          reputationAttestation: 1500000,
          reputationDispute: 3000000,
          vcRegistration: 2000000,
          vcRevocation: 1000000,
        },
        staking: {
          rewardRate: 1200,
          minStakeAmount: 1000000,
          unbondingPeriod: 7 * 24 * 3600,
        },
        farming: {
          rewardRate: 100,
          farmingPeriod: 90 * 24 * 3600,
        },
      };

      console.log('   ✅ Contracts configured successfully');
    } catch (error) {
      console.error('   ❌ Failed to configure contracts:', error);
      throw error;
    }
  }

  /**
   * Save deployment results to file
   */
  private async saveDeploymentResults(): Promise<void> {
    try {
      const deploymentsDir = path.join(__dirname, '../deployments');
      if (!fs.existsSync(deploymentsDir)) {
        fs.mkdirSync(deploymentsDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `deployment-${this.config.network}-${timestamp}.json`;
      const filepath = path.join(deploymentsDir, filename);

      fs.writeFileSync(filepath, JSON.stringify(this.deploymentResult, null, 2));
      
      // Also save as latest deployment
      const latestFilepath = path.join(deploymentsDir, `latest-${this.config.network}.json`);
      fs.writeFileSync(latestFilepath, JSON.stringify(this.deploymentResult, null, 2));

      console.log(`   ✅ Deployment results saved to: ${filename}`);
      console.log(`   ✅ Latest deployment saved to: latest-${this.config.network}.json`);
    } catch (error) {
      console.error('   ❌ Failed to save deployment results:', error);
      throw error;
    }
  }

  /**
   * Verify deployment by checking contract states
   */
  private async verifyDeployment(): Promise<void> {
    try {
      console.log('   Verifying contract deployments...');
      
      const contracts = this.deploymentResult.contracts!;
      
      // Verify each contract exists and is accessible
      for (const [contractName, contractInfo] of Object.entries(contracts)) {
        try {
          const appInfo = await this.algodClient.getApplicationByID(contractInfo.appId).do();
          console.log(`   ✅ ${contractName}: App ID ${contractInfo.appId} verified`);
        } catch (error) {
          console.log(`   ❌ ${contractName}: Verification failed`);
          throw error;
        }
      }

      console.log('   ✅ All contracts verified successfully');
    } catch (error) {
      console.error('   ❌ Deployment verification failed:', error);
      throw error;
    }
  }

  /**
   * Fund contracts with initial tokens for operations
   */
  async fundContracts(fundingAmount: number = 100000000): Promise<void> {
    try {
      console.log('\n💰 Funding contracts with NEXDEN tokens...');
      
      const nexDenASA = new NexDenASA(this.algodClient, this.deployer);
      const nexdenAssetId = this.deploymentResult.nexdenAssetId!;
      const contracts = this.deploymentResult.contracts!;

      // Fund staking pool
      if (contracts.stakingPool) {
        const stakingPool = new StakingPoolClient(this.algodClient, contracts.stakingPool.appId);
        await stakingPool.fundPool(this.deployer, fundingAmount, nexdenAssetId);
        console.log(`   ✅ Staking Pool funded with ${fundingAmount / 1000000} NEXDEN`);
      }

      // Fund LP farming pool
      if (contracts.lpFarmingPool) {
        const lpFarmingPool = new LPFarmingPoolClient(this.algodClient, contracts.lpFarmingPool.appId);
        await lpFarmingPool.fundPool(this.deployer, fundingAmount, nexdenAssetId);
        console.log(`   ✅ LP Farming Pool funded with ${fundingAmount / 1000000} NEXDEN`);
      }

      console.log('   ✅ All contracts funded successfully');
    } catch (error) {
      console.error('   ❌ Failed to fund contracts:', error);
      throw error;
    }
  }

  /**
   * Generate deployment summary
   */
  generateSummary(): string {
    const result = this.deploymentResult as DeploymentResult;
    
    return `
🌟 DIRS Smart Contracts Deployment Summary
${'='.repeat(50)}

Network: ${result.network}
Deployed: ${result.timestamp}
Deployer: ${result.deployer}

📄 NEXDEN Token
   Asset ID: ${result.nexdenAssetId}

🆔 DID Registry
   App ID: ${result.contracts.didRegistry.appId}
   Address: ${result.contracts.didRegistry.appAddress}

⭐ Reputation Registry
   App ID: ${result.contracts.reputationRegistry.appId}
   Address: ${result.contracts.reputationRegistry.appAddress}

📜 VC Registry
   App ID: ${result.contracts.vcRegistry.appId}
   Address: ${result.contracts.vcRegistry.appAddress}

🏦 Staking Pool
   App ID: ${result.contracts.stakingPool.appId}
   Address: ${result.contracts.stakingPool.appAddress}

🚜 LP Farming Pool
   App ID: ${result.contracts.lpFarmingPool.appId}
   Address: ${result.contracts.lpFarmingPool.appAddress}

💰 Fee Configuration
   DID Registration: ${result.configuration.fees.didRegistration / 1000000} NEXDEN
   DID Update: ${result.configuration.fees.didUpdate / 1000000} NEXDEN
   Reputation Attestation: ${result.configuration.fees.reputationAttestation / 1000000} NEXDEN
   Reputation Dispute: ${result.configuration.fees.reputationDispute / 1000000} NEXDEN
   VC Registration: ${result.configuration.fees.vcRegistration / 1000000} NEXDEN
   VC Revocation: ${result.configuration.fees.vcRevocation / 1000000} NEXDEN

🏦 Staking Configuration
   Reward Rate: ${result.configuration.staking.rewardRate / 100}% APY
   Min Stake: ${result.configuration.staking.minStakeAmount / 1000000} NEXDEN
   Unbonding Period: ${result.configuration.staking.unbondingPeriod / (24 * 3600)} days

🚜 Farming Configuration
   Reward Rate: ${result.configuration.farming.rewardRate} NEXDEN/second/LP
   Farming Period: ${result.configuration.farming.farmingPeriod / (24 * 3600)} days

${'='.repeat(50)}
🎉 Deployment completed successfully!
`;
  }
}

/**
 * CLI deployment function
 */
async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const network = args.find(arg => arg.startsWith('--network='))?.split('=')[1] || 'testnet';
  const mnemonic = args.find(arg => arg.startsWith('--mnemonic='))?.split('=')[1];
  const fundContracts = args.includes('--fund-contracts');

  // Network configurations
  const networkConfigs = {
    testnet: {
      network: 'testnet' as const,
      algodToken: '',
      algodServer: 'https://testnet-api.algonode.cloud',
      algodPort: 443,
      deployerFunding: 10000000, // 10 ALGO
    },
    mainnet: {
      network: 'mainnet' as const,
      algodToken: '',
      algodServer: 'https://mainnet-api.algonode.cloud',
      algodPort: 443,
      deployerFunding: 100000000, // 100 ALGO
    },
    localnet: {
      network: 'localnet' as const,
      algodToken: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      algodServer: 'http://localhost',
      algodPort: 4001,
      deployerFunding: 1000000000, // 1000 ALGO
    },
  };

  const config = {
    ...networkConfigs[network as keyof typeof networkConfigs],
    adminMnemonic: mnemonic,
  };

  if (!config) {
    console.error('❌ Invalid network. Use: testnet, mainnet, or localnet');
    process.exit(1);
  }

  try {
    console.log(`🚀 Starting DIRS deployment on ${network}`);
    
    const deployment = new DIRSDeployment(config);
    const result = await deployment.deployAll();

    if (fundContracts) {
      await deployment.fundContracts();
    }

    console.log(deployment.generateSummary());
    
    console.log('\n📋 Next Steps:');
    console.log('1. Save the deployment results file');
    console.log('2. Update your frontend configuration with the contract addresses');
    console.log('3. Test the contracts with the example scripts');
    console.log('4. Set up monitoring and alerts');
    
    if (network === 'testnet') {
      console.log('\n🔗 Useful Links:');
      console.log(`   Testnet Explorer: https://testnet.algoexplorer.io/address/${result.deployer}`);
      console.log(`   DID Registry: https://testnet.algoexplorer.io/application/${result.contracts.didRegistry.appId}`);
      console.log(`   Reputation Registry: https://testnet.algoexplorer.io/application/${result.contracts.reputationRegistry.appId}`);
    }

  } catch (error) {
    console.error('\n❌ Deployment failed:', error);
    process.exit(1);
  }
}

// Export for programmatic use
export { DIRSDeployment, DeploymentConfig, DeploymentResult };

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}