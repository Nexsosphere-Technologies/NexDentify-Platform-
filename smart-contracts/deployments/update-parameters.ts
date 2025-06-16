import { DIRSContractUpdater, UpdateParameters } from './update-contracts';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Parameter update configurations for different scenarios
 */

/**
 * Fee adjustment update
 */
export const feeAdjustmentUpdate: UpdateParameters = {
  didRegistry: {
    registrationFee: 800000,  // Reduce to 0.8 NEXDEN
    updateFee: 400000,        // Reduce to 0.4 NEXDEN
  },
  reputationRegistry: {
    attestationFee: 1200000,  // Reduce to 1.2 NEXDEN
    disputeFee: 2500000,      // Reduce to 2.5 NEXDEN
  },
  vcRegistry: {
    registrationFee: 1500000, // Reduce to 1.5 NEXDEN
    revocationFee: 800000,    // Reduce to 0.8 NEXDEN
  },
};

/**
 * DIRS features enablement update
 */
export const dirsFeatureUpdate: UpdateParameters = {
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

/**
 * Staking optimization update
 */
export const stakingOptimizationUpdate: UpdateParameters = {
  stakingPool: {
    rewardRate: 1500,         // Increase to 15% APY
    minStakeAmount: 500000,   // Reduce to 0.5 NEXDEN
    unbondingPeriod: 5 * 24 * 3600, // Reduce to 5 days
  },
};

/**
 * Farming extension update
 */
export const farmingExtensionUpdate: UpdateParameters = {
  lpFarmingPool: {
    rewardRate: 150,          // Increase to 150 NEXDEN/sec
    endTime: Math.floor(Date.now() / 1000) + (120 * 24 * 3600), // Extend to 120 days
  },
};

/**
 * Comprehensive update combining all improvements
 */
export const comprehensiveUpdate: UpdateParameters = {
  ...feeAdjustmentUpdate,
  ...dirsFeatureUpdate,
  ...stakingOptimizationUpdate,
  ...farmingExtensionUpdate,
};

/**
 * Emergency security update
 */
export const emergencySecurityUpdate: UpdateParameters = {
  didRegistry: {
    registrationFee: 5000000,  // Increase to 5 NEXDEN to prevent spam
    updateFee: 2500000,        // Increase to 2.5 NEXDEN
  },
  reputationRegistry: {
    attestationFee: 10000000,  // Increase to 10 NEXDEN
    disputeFee: 20000000,      // Increase to 20 NEXDEN
  },
  vcRegistry: {
    registrationFee: 10000000, // Increase to 10 NEXDEN
    revocationFee: 5000000,    // Increase to 5 NEXDEN
  },
};

/**
 * Apply specific update configuration
 */
async function applyUpdateConfiguration(
  updateName: string,
  network: string = 'testnet',
  dryRun: boolean = false
) {
  const updateConfigurations: { [key: string]: UpdateParameters } = {
    'fee-adjustment': feeAdjustmentUpdate,
    'dirs-features': dirsFeatureUpdate,
    'staking-optimization': stakingOptimizationUpdate,
    'farming-extension': farmingExtensionUpdate,
    'comprehensive': comprehensiveUpdate,
    'emergency-security': emergencySecurityUpdate,
  };

  const updateParams = updateConfigurations[updateName];
  if (!updateParams) {
    console.error(`❌ Unknown update configuration: ${updateName}`);
    console.error('Available configurations:', Object.keys(updateConfigurations).join(', '));
    process.exit(1);
  }

  // Load deployment data
  const deploymentFile = path.join(__dirname, `latest-${network}.json`);
  if (!fs.existsSync(deploymentFile)) {
    console.error(`❌ No deployment file found for ${network}`);
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

  const config = {
    network: network as any,
    adminMnemonic,
    ...networkConfig,
    updateType: 'parameters' as const,
    dryRun,
  };

  try {
    console.log(`🔧 Applying ${updateName} update to ${network}`);
    if (dryRun) {
      console.log('🧪 DRY RUN MODE - No transactions will be executed');
    }
    
    const updater = new DIRSContractUpdater(config, deploymentData);
    const result = await updater.updateParameters(updateParams);

    console.log('\n📋 Update Summary:');
    console.log(`   Configuration: ${updateName}`);
    console.log(`   Network: ${result.network}`);
    console.log(`   Status: ${result.overallStatus}`);
    console.log(`   Contracts Updated: ${Object.keys(result.contracts).length}`);

    // Display specific changes
    for (const [contractName, contractResult] of Object.entries(result.contracts)) {
      console.log(`\n   ${contractName}:`);
      if (contractResult.updated) {
        contractResult.changes.forEach(change => {
          console.log(`     ✅ ${change}`);
        });
      } else {
        console.log(`     ❌ Update failed: ${contractResult.error}`);
      }
    }

    if (result.overallStatus === 'success') {
      console.log('\n🎉 Parameter update completed successfully!');
    } else {
      console.log('\n⚠️  Parameter update completed with issues');
    }

  } catch (error) {
    console.error('\n❌ Parameter update failed:', error);
    process.exit(1);
  }
}

/**
 * CLI for parameter updates
 */
async function main() {
  const args = process.argv.slice(2);
  const updateName = args[0];
  const network = args.find(arg => arg.startsWith('--network='))?.split('=')[1] || 'testnet';
  const dryRun = args.includes('--dry-run');

  if (!updateName) {
    console.log('📋 Available Update Configurations:');
    console.log('');
    console.log('🔧 Parameter Updates:');
    console.log('   fee-adjustment      - Reduce fees for better accessibility');
    console.log('   dirs-features       - Enable all DIRS portability features');
    console.log('   staking-optimization - Optimize staking parameters');
    console.log('   farming-extension   - Extend and enhance farming rewards');
    console.log('   comprehensive       - Apply all optimizations');
    console.log('   emergency-security  - Emergency security measures');
    console.log('');
    console.log('Usage:');
    console.log('   ts-node update-parameters.ts <update-name> [--network=testnet] [--dry-run]');
    console.log('');
    console.log('Examples:');
    console.log('   ts-node update-parameters.ts fee-adjustment --network=testnet --dry-run');
    console.log('   ts-node update-parameters.ts dirs-features --network=mainnet');
    console.log('   ts-node update-parameters.ts comprehensive --network=testnet');
    process.exit(0);
  }

  await applyUpdateConfiguration(updateName, network, dryRun);
}

if (require.main === module) {
  main().catch(console.error);
}

export {
  feeAdjustmentUpdate,
  dirsFeatureUpdate,
  stakingOptimizationUpdate,
  farmingExtensionUpdate,
  comprehensiveUpdate,
  emergencySecurityUpdate,
  applyUpdateConfiguration,
};