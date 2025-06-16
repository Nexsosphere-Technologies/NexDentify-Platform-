import { DIRSDeployment } from './deploy-all';

/**
 * Testnet-specific deployment script
 */
async function deployToTestnet() {
  const config = {
    network: 'testnet' as const,
    algodToken: '',
    algodServer: 'https://testnet-api.algonode.cloud',
    algodPort: 443,
    deployerFunding: 10000000, // 10 ALGO
    // Add your testnet mnemonic here or pass via environment variable
    adminMnemonic: process.env.TESTNET_MNEMONIC,
  };

  console.log('🧪 Deploying DIRS to Algorand Testnet');
  console.log('=' .repeat(50));

  try {
    const deployment = new DIRSDeployment(config);
    const result = await deployment.deployAll();

    // Fund contracts with initial tokens
    console.log('\n💰 Funding contracts...');
    await deployment.fundContracts(50000000); // 50 NEXDEN

    console.log(deployment.generateSummary());

    // Save testnet-specific configuration
    console.log('\n📝 Testnet Deployment Notes:');
    console.log('- Use the testnet faucet to fund accounts');
    console.log('- Testnet resets periodically - save important data');
    console.log('- Test all functionality before mainnet deployment');

    return result;
  } catch (error) {
    console.error('❌ Testnet deployment failed:', error);
    throw error;
  }
}

if (require.main === module) {
  deployToTestnet().catch(console.error);
}

export { deployToTestnet };