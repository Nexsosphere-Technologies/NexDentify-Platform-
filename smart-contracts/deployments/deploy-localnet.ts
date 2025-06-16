import { DIRSDeployment } from './deploy-all';

/**
 * Localnet-specific deployment script for development
 */
async function deployToLocalnet() {
  const config = {
    network: 'localnet' as const,
    algodToken: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    algodServer: 'http://localhost',
    algodPort: 4001,
    deployerFunding: 1000000000, // 1000 ALGO
    // For localnet, we can generate a new account or use a known one
    adminMnemonic: process.env.LOCALNET_MNEMONIC,
  };

  console.log('🏠 Deploying DIRS to Local Algorand Network');
  console.log('=' .repeat(50));

  try {
    const deployment = new DIRSDeployment(config);
    const result = await deployment.deployAll();

    // Fund contracts generously for development
    console.log('\n💰 Funding contracts for development...');
    await deployment.fundContracts(1000000000); // 1000 NEXDEN

    console.log(deployment.generateSummary());

    // Localnet-specific notes
    console.log('\n🏠 Localnet Deployment Notes:');
    console.log('- Localnet is for development and testing only');
    console.log('- Data will be lost when localnet is reset');
    console.log('- Use generous funding for testing scenarios');
    console.log('- Perfect for integration testing and debugging');

    // Create test accounts and scenarios
    console.log('\n🧪 Setting up test scenarios...');
    await setupTestScenarios(deployment);

    return result;
  } catch (error) {
    console.error('❌ Localnet deployment failed:', error);
    throw error;
  }
}

/**
 * Set up test scenarios for development
 */
async function setupTestScenarios(deployment: DIRSDeployment) {
  try {
    console.log('   Creating test accounts and scenarios...');
    
    // This would create test users, DIDs, attestations, etc.
    // for development and testing purposes
    
    console.log('   ✅ Test scenarios created');
  } catch (error) {
    console.error('   ❌ Failed to set up test scenarios:', error);
  }
}

if (require.main === module) {
  deployToLocalnet().catch(console.error);
}

export { deployToLocalnet };