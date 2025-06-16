import { DIRSContractUpdater } from './update-contracts';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

/**
 * Emergency operations for DIRS smart contracts
 */

interface EmergencyOperation {
  name: string;
  description: string;
  operations: string[];
  requiresConfirmation: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Available emergency operations
 */
export const emergencyOperations: { [key: string]: EmergencyOperation } = {
  'pause-all': {
    name: 'Pause All Contracts',
    description: 'Immediately pause all DIRS contracts to prevent further operations',
    operations: ['pause_all'],
    requiresConfirmation: true,
    severity: 'high',
  },
  'resume-all': {
    name: 'Resume All Contracts',
    description: 'Resume normal operations for all DIRS contracts',
    operations: ['resume_all'],
    requiresConfirmation: true,
    severity: 'medium',
  },
  'emergency-withdraw': {
    name: 'Emergency Fund Withdrawal',
    description: 'Withdraw all available funds from contracts to admin wallet',
    operations: ['emergency_withdraw'],
    requiresConfirmation: true,
    severity: 'critical',
  },
  'security-lockdown': {
    name: 'Security Lockdown',
    description: 'Pause all contracts and initiate security measures',
    operations: ['pause_all', 'revoke_malicious_did'],
    requiresConfirmation: true,
    severity: 'critical',
  },
  'maintenance-mode': {
    name: 'Maintenance Mode',
    description: 'Pause contracts for scheduled maintenance',
    operations: ['pause_all'],
    requiresConfirmation: false,
    severity: 'low',
  },
  'exit-maintenance': {
    name: 'Exit Maintenance Mode',
    description: 'Resume contracts after maintenance',
    operations: ['resume_all'],
    requiresConfirmation: false,
    severity: 'low',
  },
};

/**
 * Execute emergency operation
 */
async function executeEmergencyOperation(
  operationName: string,
  network: string = 'testnet',
  force: boolean = false
) {
  const operation = emergencyOperations[operationName];
  if (!operation) {
    console.error(`❌ Unknown emergency operation: ${operationName}`);
    console.error('Available operations:', Object.keys(emergencyOperations).join(', '));
    process.exit(1);
  }

  // Display operation details
  console.log('🚨 EMERGENCY OPERATION');
  console.log('=' .repeat(50));
  console.log(`Operation: ${operation.name}`);
  console.log(`Description: ${operation.description}`);
  console.log(`Severity: ${operation.severity.toUpperCase()}`);
  console.log(`Network: ${network}`);
  console.log('=' .repeat(50));

  // Confirmation for high-severity operations
  if (operation.requiresConfirmation && !force) {
    const confirmed = await confirmOperation(operation);
    if (!confirmed) {
      console.log('❌ Operation cancelled by user');
      return;
    }
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
    updateType: 'emergency' as const,
  };

  try {
    console.log(`\n🚨 Executing emergency operation: ${operation.name}`);
    
    const updater = new DIRSContractUpdater(config, deploymentData);
    const result = await updater.emergencyOperations(operation.operations);

    console.log('\n📋 Emergency Operation Summary:');
    console.log(`   Operation: ${operation.name}`);
    console.log(`   Network: ${result.network}`);
    console.log(`   Status: ${result.overallStatus}`);
    console.log(`   Timestamp: ${result.timestamp}`);

    if (result.overallStatus === 'success') {
      console.log('\n✅ Emergency operation completed successfully!');
      
      // Log important next steps based on operation
      logNextSteps(operation);
    } else {
      console.log('\n⚠️  Emergency operation completed with issues');
    }

    // Save emergency log
    await saveEmergencyLog(operation, result, network);

  } catch (error) {
    console.error('\n❌ Emergency operation failed:', error);
    
    // Save failure log
    await saveEmergencyLog(operation, { error: error instanceof Error ? error.message : 'Unknown error' }, network);
    
    process.exit(1);
  }
}

/**
 * Prompt user for operation confirmation
 */
function confirmOperation(operation: EmergencyOperation): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    const confirmText = operation.severity === 'critical' ? 
      'EXECUTE CRITICAL OPERATION' : 
      'CONFIRM OPERATION';
    
    rl.question(`\nType "${confirmText}" to confirm: `, (answer) => {
      rl.close();
      resolve(answer === confirmText);
    });
  });
}

/**
 * Log next steps after operation
 */
function logNextSteps(operation: EmergencyOperation): void {
  console.log('\n📋 Important Next Steps:');
  
  switch (operation.name) {
    case 'Pause All Contracts':
      console.log('1. 🔍 Investigate the issue that required pausing');
      console.log('2. 📢 Notify users about the temporary pause');
      console.log('3. 🔧 Apply necessary fixes or updates');
      console.log('4. ✅ Test fixes on testnet if possible');
      console.log('5. ▶️  Resume contracts when ready');
      break;
      
    case 'Resume All Contracts':
      console.log('1. 📊 Monitor contract activity closely');
      console.log('2. 📢 Notify users that operations have resumed');
      console.log('3. 🔍 Watch for any unusual behavior');
      console.log('4. 📈 Track key metrics and performance');
      break;
      
    case 'Emergency Fund Withdrawal':
      console.log('1. 🔒 Secure the withdrawn funds immediately');
      console.log('2. 📋 Document the withdrawal reason and amount');
      console.log('3. 📢 Communicate with stakeholders');
      console.log('4. 🔧 Address the underlying issue');
      console.log('5. 💰 Plan fund redistribution strategy');
      break;
      
    case 'Security Lockdown':
      console.log('1. 🔍 Conduct thorough security investigation');
      console.log('2. 📋 Document all security findings');
      console.log('3. 🔧 Implement security fixes');
      console.log('4. 🧪 Test security measures thoroughly');
      console.log('5. 📢 Communicate security status to users');
      break;
      
    default:
      console.log('1. 📊 Monitor system status');
      console.log('2. 📋 Document operation results');
      console.log('3. 📢 Update stakeholders as needed');
  }
}

/**
 * Save emergency operation log
 */
async function saveEmergencyLog(
  operation: EmergencyOperation,
  result: any,
  network: string
): Promise<void> {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logEntry = {
      timestamp: new Date().toISOString(),
      network,
      operation: operation.name,
      severity: operation.severity,
      description: operation.description,
      operations: operation.operations,
      result,
    };

    const logFile = path.join(__dirname, `emergency-log-${network}-${timestamp}.json`);
    fs.writeFileSync(logFile, JSON.stringify(logEntry, null, 2));
    
    // Also append to master emergency log
    const masterLogFile = path.join(__dirname, `emergency-log-${network}.jsonl`);
    fs.appendFileSync(masterLogFile, JSON.stringify(logEntry) + '\n');
    
    console.log(`\n📄 Emergency log saved to: ${path.basename(logFile)}`);
  } catch (error) {
    console.error('   ❌ Failed to save emergency log:', error);
  }
}

/**
 * List available emergency operations
 */
function listEmergencyOperations(): void {
  console.log('🚨 Available Emergency Operations:');
  console.log('=' .repeat(50));
  
  for (const [key, operation] of Object.entries(emergencyOperations)) {
    const severityIcon = {
      low: '🟢',
      medium: '🟡',
      high: '🟠',
      critical: '🔴',
    }[operation.severity];
    
    console.log(`\n${severityIcon} ${key}`);
    console.log(`   Name: ${operation.name}`);
    console.log(`   Description: ${operation.description}`);
    console.log(`   Severity: ${operation.severity.toUpperCase()}`);
    console.log(`   Requires Confirmation: ${operation.requiresConfirmation ? 'Yes' : 'No'}`);
  }
  
  console.log('\n📋 Usage:');
  console.log('   ts-node emergency-operations.ts <operation> [--network=testnet] [--force]');
  console.log('\n📋 Examples:');
  console.log('   ts-node emergency-operations.ts pause-all --network=testnet');
  console.log('   ts-node emergency-operations.ts maintenance-mode --network=mainnet');
  console.log('   ts-node emergency-operations.ts security-lockdown --network=testnet --force');
}

/**
 * CLI for emergency operations
 */
async function main() {
  const args = process.argv.slice(2);
  const operationName = args[0];
  const network = args.find(arg => arg.startsWith('--network='))?.split('=')[1] || 'testnet';
  const force = args.includes('--force');

  if (!operationName || operationName === 'list') {
    listEmergencyOperations();
    process.exit(0);
  }

  // Special confirmation for mainnet operations
  if (network === 'mainnet' && !force) {
    console.log('🚨 MAINNET EMERGENCY OPERATION WARNING 🚨');
    console.log('You are about to execute an emergency operation on MAINNET.');
    console.log('This will affect the production DIRS system.');
    console.log('Make sure you understand the consequences.');
    
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const confirmed = await new Promise<boolean>((resolve) => {
      rl.question('\nType "EXECUTE ON MAINNET" to confirm: ', (answer) => {
        rl.close();
        resolve(answer === 'EXECUTE ON MAINNET');
      });
    });

    if (!confirmed) {
      console.log('❌ Mainnet operation cancelled by user');
      process.exit(0);
    }
  }

  await executeEmergencyOperation(operationName, network, force);
}

if (require.main === module) {
  main().catch(console.error);
}

export {
  emergencyOperations,
  executeEmergencyOperation,
  listEmergencyOperations,
};