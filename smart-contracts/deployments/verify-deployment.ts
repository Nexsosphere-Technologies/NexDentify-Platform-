import { Algodv2 } from 'algosdk';
import * as fs from 'fs';
import * as path from 'path';

interface DeploymentVerification {
  network: string;
  timestamp: string;
  deployer: string;
  nexdenAssetId: number;
  contracts: {
    [key: string]: {
      appId: number;
      appAddress: string;
      verified: boolean;
      error?: string;
    };
  };
  overallStatus: 'success' | 'partial' | 'failed';
}

/**
 * Verify a DIRS deployment
 */
export class DeploymentVerifier {
  private algodClient: Algodv2;
  private deploymentData: any;

  constructor(algodClient: Algodv2, deploymentData: any) {
    this.algodClient = algodClient;
    this.deploymentData = deploymentData;
  }

  /**
   * Verify all contracts in the deployment
   */
  async verifyDeployment(): Promise<DeploymentVerification> {
    console.log('🔍 Verifying DIRS deployment...');
    console.log('=' .repeat(50));

    const verification: DeploymentVerification = {
      network: this.deploymentData.network,
      timestamp: new Date().toISOString(),
      deployer: this.deploymentData.deployer,
      nexdenAssetId: this.deploymentData.nexdenAssetId,
      contracts: {},
      overallStatus: 'success',
    };

    let successCount = 0;
    let totalCount = 0;

    // Verify NEXDEN ASA
    console.log('\n📄 Verifying NEXDEN ASA...');
    try {
      const assetInfo = await this.algodClient.getAssetByID(this.deploymentData.nexdenAssetId).do();
      console.log(`   ✅ NEXDEN ASA verified: ${assetInfo.params.name}`);
    } catch (error) {
      console.log(`   ❌ NEXDEN ASA verification failed: ${error}`);
      verification.overallStatus = 'failed';
    }

    // Verify each contract
    for (const [contractName, contractInfo] of Object.entries(this.deploymentData.contracts)) {
      totalCount++;
      console.log(`\n🔍 Verifying ${contractName}...`);
      
      try {
        const appInfo = await this.algodClient.getApplicationByID((contractInfo as any).appId).do();
        
        // Basic verification
        const isValid = this.verifyContractBasics(appInfo, contractName);
        
        if (isValid) {
          console.log(`   ✅ ${contractName} verified successfully`);
          verification.contracts[contractName] = {
            ...(contractInfo as any),
            verified: true,
          };
          successCount++;
        } else {
          console.log(`   ⚠️  ${contractName} verification incomplete`);
          verification.contracts[contractName] = {
            ...(contractInfo as any),
            verified: false,
            error: 'Basic verification failed',
          };
        }
      } catch (error) {
        console.log(`   ❌ ${contractName} verification failed: ${error}`);
        verification.contracts[contractName] = {
          ...(contractInfo as any),
          verified: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }

    // Determine overall status
    if (successCount === totalCount) {
      verification.overallStatus = 'success';
      console.log('\n✅ All contracts verified successfully!');
    } else if (successCount > 0) {
      verification.overallStatus = 'partial';
      console.log(`\n⚠️  Partial verification: ${successCount}/${totalCount} contracts verified`);
    } else {
      verification.overallStatus = 'failed';
      console.log('\n❌ Verification failed for all contracts');
    }

    return verification;
  }

  /**
   * Verify basic contract properties
   */
  private verifyContractBasics(appInfo: any, contractName: string): boolean {
    try {
      // Check if contract exists and has expected properties
      if (!appInfo.id) return false;
      if (!appInfo.params) return false;
      if (!appInfo.params['global-state']) return false;

      // Contract-specific verifications
      switch (contractName) {
        case 'didRegistry':
          return this.verifyDIDRegistry(appInfo);
        case 'reputationRegistry':
          return this.verifyReputationRegistry(appInfo);
        case 'vcRegistry':
          return this.verifyVCRegistry(appInfo);
        case 'stakingPool':
          return this.verifyStakingPool(appInfo);
        case 'lpFarmingPool':
          return this.verifyLPFarmingPool(appInfo);
        default:
          return true;
      }
    } catch (error) {
      console.log(`     Error in basic verification: ${error}`);
      return false;
    }
  }

  /**
   * Verify DID Registry specific properties
   */
  private verifyDIDRegistry(appInfo: any): boolean {
    // Check for expected global state keys
    const globalState = appInfo.params['global-state'];
    const expectedKeys = ['totalDIDs', 'registrationFee', 'updateFee', 'registryOwner'];
    
    for (const key of expectedKeys) {
      const found = globalState.some((item: any) => 
        Buffer.from(item.key, 'base64').toString() === key
      );
      if (!found) {
        console.log(`     Missing expected key: ${key}`);
        return false;
      }
    }
    
    console.log('     DID Registry state verified');
    return true;
  }

  /**
   * Verify Reputation Registry specific properties
   */
  private verifyReputationRegistry(appInfo: any): boolean {
    const globalState = appInfo.params['global-state'];
    const expectedKeys = ['totalAttestations', 'attestationFee', 'disputeFee'];
    
    for (const key of expectedKeys) {
      const found = globalState.some((item: any) => 
        Buffer.from(item.key, 'base64').toString() === key
      );
      if (!found) {
        console.log(`     Missing expected key: ${key}`);
        return false;
      }
    }
    
    console.log('     Reputation Registry state verified');
    return true;
  }

  /**
   * Verify VC Registry specific properties
   */
  private verifyVCRegistry(appInfo: any): boolean {
    const globalState = appInfo.params['global-state'];
    const expectedKeys = ['totalVCs', 'registrationFee', 'revocationFee'];
    
    for (const key of expectedKeys) {
      const found = globalState.some((item: any) => 
        Buffer.from(item.key, 'base64').toString() === key
      );
      if (!found) {
        console.log(`     Missing expected key: ${key}`);
        return false;
      }
    }
    
    console.log('     VC Registry state verified');
    return true;
  }

  /**
   * Verify Staking Pool specific properties
   */
  private verifyStakingPool(appInfo: any): boolean {
    const globalState = appInfo.params['global-state'];
    const expectedKeys = ['nexdenAssetId', 'rewardRate', 'totalStaked'];
    
    for (const key of expectedKeys) {
      const found = globalState.some((item: any) => 
        Buffer.from(item.key, 'base64').toString() === key
      );
      if (!found) {
        console.log(`     Missing expected key: ${key}`);
        return false;
      }
    }
    
    console.log('     Staking Pool state verified');
    return true;
  }

  /**
   * Verify LP Farming Pool specific properties
   */
  private verifyLPFarmingPool(appInfo: any): boolean {
    const globalState = appInfo.params['global-state'];
    const expectedKeys = ['lpTokenAssetId', 'rewardTokenAssetId', 'totalLPStaked'];
    
    for (const key of expectedKeys) {
      const found = globalState.some((item: any) => 
        Buffer.from(item.key, 'base64').toString() === key
      );
      if (!found) {
        console.log(`     Missing expected key: ${key}`);
        return false;
      }
    }
    
    console.log('     LP Farming Pool state verified');
    return true;
  }
}

/**
 * CLI verification function
 */
async function main() {
  const args = process.argv.slice(2);
  const network = args.find(arg => arg.startsWith('--network='))?.split('=')[1] || 'testnet';
  const deploymentFile = args.find(arg => arg.startsWith('--file='))?.split('=')[1];

  // Load deployment data
  let deploymentData;
  if (deploymentFile) {
    const filepath = path.resolve(deploymentFile);
    deploymentData = JSON.parse(fs.readFileSync(filepath, 'utf8'));
  } else {
    const latestFile = path.join(__dirname, `latest-${network}.json`);
    if (!fs.existsSync(latestFile)) {
      console.error(`❌ No deployment file found for ${network}`);
      console.error('   Use --file=path/to/deployment.json or deploy first');
      process.exit(1);
    }
    deploymentData = JSON.parse(fs.readFileSync(latestFile, 'utf8'));
  }

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

  const config = networkConfigs[network as keyof typeof networkConfigs];
  if (!config) {
    console.error('❌ Invalid network. Use: testnet, mainnet, or localnet');
    process.exit(1);
  }

  const algodClient = new Algodv2(config.algodToken, config.algodServer, config.algodPort);
  const verifier = new DeploymentVerifier(algodClient, deploymentData);

  try {
    const verification = await verifier.verifyDeployment();
    
    // Save verification results
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const verificationFile = path.join(__dirname, `verification-${network}-${timestamp}.json`);
    fs.writeFileSync(verificationFile, JSON.stringify(verification, null, 2));
    
    console.log(`\n📄 Verification results saved to: ${path.basename(verificationFile)}`);
    
    if (verification.overallStatus === 'success') {
      console.log('\n🎉 Deployment verification completed successfully!');
      process.exit(0);
    } else {
      console.log('\n⚠️  Deployment verification completed with issues');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Verification failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { DeploymentVerifier, DeploymentVerification };