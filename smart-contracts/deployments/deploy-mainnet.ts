import { DIRSDeployment } from './deploy-all';
import * as readline from 'readline';

/**
 * Mainnet-specific deployment script with safety checks
 */
async function deployToMainnet() {
  console.log('🚨 MAINNET DEPLOYMENT WARNING 🚨');
  console.log('=' .repeat(50));
  console.log('You are about to deploy to Algorand Mainnet.');
  console.log('This will use real ALGO and create permanent contracts.');
  console.log('Make sure you have:');
  console.log('1. Tested thoroughly on testnet');
  console.log('2. Sufficient ALGO for deployment costs');
  console.log('3. Backed up your mnemonic securely');
  console.log('4. Reviewed all contract code');
  console.log('=' .repeat(50));

  // Confirmation prompt
  const confirmed = await confirmDeployment();
  if (!confirmed) {
    console.log('❌ Deployment cancelled by user');
    return;
  }

  const config = {
    network: 'mainnet' as const,
    algodToken: '',
    algodServer: 'https://mainnet-api.algonode.cloud',
    algodPort: 443,
    deployerFunding: 100000000, // 100 ALGO
    // Mainnet mnemonic must be provided via environment variable for security
    adminMnemonic: process.env.MAINNET_MNEMONIC,
  };

  if (!config.adminMnemonic) {
    console.error('❌ MAINNET_MNEMONIC environment variable is required for mainnet deployment');
    console.error('   Set it with: export MAINNET_MNEMONIC="your 25 word mnemonic"');
    process.exit(1);
  }

  console.log('\n🌐 Deploying DIRS to Algorand Mainnet');
  console.log('=' .repeat(50));

  try {
    const deployment = new DIRSDeployment(config);
    const result = await deployment.deployAll();

    // Fund contracts with initial tokens
    console.log('\n💰 Funding contracts...');
    await deployment.fundContracts(1000000000); // 1000 NEXDEN

    console.log(deployment.generateSummary());

    // Mainnet-specific post-deployment steps
    console.log('\n🎯 Mainnet Deployment Complete!');
    console.log('=' .repeat(50));
    console.log('📋 Important Next Steps:');
    console.log('1. 🔐 Secure your deployer mnemonic');
    console.log('2. 📊 Set up monitoring and alerts');
    console.log('3. 🔍 Verify contracts on AlgoExplorer');
    console.log('4. 📢 Announce deployment to community');
    console.log('5. 📚 Update documentation with mainnet addresses');
    console.log('6. 🛡️  Set up emergency procedures');

    console.log('\n🔗 Mainnet Links:');
    console.log(`   Explorer: https://algoexplorer.io/address/${result.deployer}`);
    console.log(`   DID Registry: https://algoexplorer.io/application/${result.contracts.didRegistry.appId}`);
    console.log(`   Reputation Registry: https://algoexplorer.io/application/${result.contracts.reputationRegistry.appId}`);

    return result;
  } catch (error) {
    console.error('❌ Mainnet deployment failed:', error);
    throw error;
  }
}

/**
 * Prompt user for deployment confirmation
 */
function confirmDeployment(): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('\nType "DEPLOY TO MAINNET" to confirm: ', (answer) => {
      rl.close();
      resolve(answer === 'DEPLOY TO MAINNET');
    });
  });
}

if (require.main === module) {
  deployToMainnet().catch(console.error);
}

export { deployToMainnet };