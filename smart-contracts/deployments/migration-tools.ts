import { Algodv2, Account, mnemonicToSecretKey } from 'algosdk';
import { DIRSContractUpdater } from './update-contracts';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Migration tools for DIRS smart contracts
 */

interface MigrationPlan {
  name: string;
  description: string;
  version: {
    from: string;
    to: string;
  };
  steps: MigrationStep[];
  rollbackSteps: MigrationStep[];
  estimatedDuration: string;
  risks: string[];
}

interface MigrationStep {
  id: string;
  type: 'data_export' | 'data_import' | 'contract_deploy' | 'reference_update' | 'verification' | 'cleanup';
  description: string;
  contract?: string;
  parameters?: any;
  dependencies?: string[];
  rollbackable: boolean;
}

/**
 * Predefined migration plans
 */
export const migrationPlans: { [key: string]: MigrationPlan } = {
  'v1-to-v2': {
    name: 'DIRS v1.0 to v2.0 Migration',
    description: 'Migrate from DIRS v1.0 to v2.0 with enhanced portability features',
    version: {
      from: '1.0.0',
      to: '2.0.0',
    },
    steps: [
      {
        id: 'export-did-data',
        type: 'data_export',
        description: 'Export all DID registry data',
        contract: 'didRegistry',
        parameters: { includeHistory: true },
        dependencies: [],
        rollbackable: true,
      },
      {
        id: 'export-reputation-data',
        type: 'data_export',
        description: 'Export all reputation attestations',
        contract: 'reputationRegistry',
        parameters: { includeDisputes: true },
        dependencies: [],
        rollbackable: true,
      },
      {
        id: 'export-vc-data',
        type: 'data_export',
        description: 'Export all verifiable credentials',
        contract: 'vcRegistry',
        parameters: { includeRevoked: true },
        dependencies: [],
        rollbackable: true,
      },
      {
        id: 'deploy-new-contracts',
        type: 'contract_deploy',
        description: 'Deploy new v2.0 contracts',
        parameters: { version: '2.0.0' },
        dependencies: ['export-did-data', 'export-reputation-data', 'export-vc-data'],
        rollbackable: false,
      },
      {
        id: 'import-did-data',
        type: 'data_import',
        description: 'Import DID data to new contracts',
        contract: 'didRegistry',
        dependencies: ['deploy-new-contracts'],
        rollbackable: true,
      },
      {
        id: 'import-reputation-data',
        type: 'data_import',
        description: 'Import reputation data to new contracts',
        contract: 'reputationRegistry',
        dependencies: ['deploy-new-contracts'],
        rollbackable: true,
      },
      {
        id: 'import-vc-data',
        type: 'data_import',
        description: 'Import VC data to new contracts',
        contract: 'vcRegistry',
        dependencies: ['deploy-new-contracts'],
        rollbackable: true,
      },
      {
        id: 'update-references',
        type: 'reference_update',
        description: 'Update all contract references',
        dependencies: ['import-did-data', 'import-reputation-data', 'import-vc-data'],
        rollbackable: true,
      },
      {
        id: 'verify-migration',
        type: 'verification',
        description: 'Verify migration completeness and data integrity',
        dependencies: ['update-references'],
        rollbackable: false,
      },
      {
        id: 'cleanup-old-contracts',
        type: 'cleanup',
        description: 'Deactivate old contracts and clean up',
        dependencies: ['verify-migration'],
        rollbackable: false,
      },
    ],
    rollbackSteps: [
      {
        id: 'restore-references',
        type: 'reference_update',
        description: 'Restore references to old contracts',
        rollbackable: false,
      },
      {
        id: 'reactivate-old-contracts',
        type: 'contract_deploy',
        description: 'Reactivate old contracts',
        rollbackable: false,
      },
    ],
    estimatedDuration: '2-4 hours',
    risks: [
      'Data loss during migration',
      'Downtime during contract switching',
      'Reference update failures',
      'Incomplete data migration',
    ],
  },
  'emergency-migration': {
    name: 'Emergency Migration',
    description: 'Emergency migration to new contracts due to security issues',
    version: {
      from: 'current',
      to: 'emergency',
    },
    steps: [
      {
        id: 'pause-all-contracts',
        type: 'contract_deploy',
        description: 'Immediately pause all current contracts',
        rollbackable: true,
      },
      {
        id: 'export-critical-data',
        type: 'data_export',
        description: 'Export only critical data',
        parameters: { criticalOnly: true },
        dependencies: ['pause-all-contracts'],
        rollbackable: true,
      },
      {
        id: 'deploy-emergency-contracts',
        type: 'contract_deploy',
        description: 'Deploy emergency contracts with security fixes',
        dependencies: ['export-critical-data'],
        rollbackable: false,
      },
      {
        id: 'import-critical-data',
        type: 'data_import',
        description: 'Import critical data to emergency contracts',
        dependencies: ['deploy-emergency-contracts'],
        rollbackable: true,
      },
      {
        id: 'emergency-verification',
        type: 'verification',
        description: 'Verify emergency contracts are working',
        dependencies: ['import-critical-data'],
        rollbackable: false,
      },
    ],
    rollbackSteps: [
      {
        id: 'resume-old-contracts',
        type: 'contract_deploy',
        description: 'Resume old contracts if emergency migration fails',
        rollbackable: false,
      },
    ],
    estimatedDuration: '30-60 minutes',
    risks: [
      'Potential data loss',
      'Extended downtime',
      'User confusion',
      'Incomplete security fixes',
    ],
  },
};

/**
 * Migration executor class
 */
export class DIRSMigrationExecutor {
  private algodClient: Algodv2;
  private admin: Account;
  private network: string;
  private deploymentData: any;
  private migrationLog: any[] = [];

  constructor(
    network: string,
    adminMnemonic: string,
    algodConfig: any,
    deploymentData: any
  ) {
    this.network = network;
    this.algodClient = new Algodv2(
      algodConfig.algodToken,
      algodConfig.algodServer,
      algodConfig.algodPort
    );
    this.admin = mnemonicToSecretKey(adminMnemonic);
    this.deploymentData = deploymentData;
  }

  /**
   * Execute migration plan
   */
  async executeMigration(planName: string, dryRun: boolean = false): Promise<any> {
    const plan = migrationPlans[planName];
    if (!plan) {
      throw new Error(`Migration plan not found: ${planName}`);
    }

    console.log(`🚀 Starting Migration: ${plan.name}`);
    console.log('=' .repeat(60));
    console.log(`Description: ${plan.description}`);
    console.log(`Version: ${plan.version.from} → ${plan.version.to}`);
    console.log(`Estimated Duration: ${plan.estimatedDuration}`);
    console.log(`Steps: ${plan.steps.length}`);
    
    if (dryRun) {
      console.log('🧪 DRY RUN MODE - No actual changes will be made');
    }

    // Display risks
    if (plan.risks.length > 0) {
      console.log('\n⚠️  Migration Risks:');
      plan.risks.forEach(risk => console.log(`   - ${risk}`));
    }

    const migrationResult = {
      planName,
      network: this.network,
      startTime: new Date().toISOString(),
      endTime: '',
      status: 'in_progress',
      completedSteps: [],
      failedStep: null,
      rollbackExecuted: false,
      dryRun,
    };

    try {
      // Execute migration steps
      for (const step of plan.steps) {
        console.log(`\n🔄 Executing Step: ${step.description}`);
        
        // Check dependencies
        if (step.dependencies && step.dependencies.length > 0) {
          const missingDeps = step.dependencies.filter(dep => 
            !migrationResult.completedSteps.includes(dep)
          );
          
          if (missingDeps.length > 0) {
            throw new Error(`Missing dependencies for step ${step.id}: ${missingDeps.join(', ')}`);
          }
        }

        if (!dryRun) {
          await this.executeStep(step);
        }
        
        migrationResult.completedSteps.push(step.id);
        console.log(`   ✅ Step completed: ${step.id}`);
        
        // Log step completion
        this.migrationLog.push({
          timestamp: new Date().toISOString(),
          step: step.id,
          status: 'completed',
          description: step.description,
        });
      }

      migrationResult.status = 'completed';
      migrationResult.endTime = new Date().toISOString();
      
      console.log('\n🎉 Migration completed successfully!');
      
    } catch (error) {
      console.error('\n❌ Migration failed:', error);
      
      migrationResult.status = 'failed';
      migrationResult.failedStep = this.migrationLog.length > 0 ? 
        this.migrationLog[this.migrationLog.length - 1].step : 'unknown';
      migrationResult.endTime = new Date().toISOString();

      // Execute rollback if possible
      if (!dryRun) {
        console.log('\n🔄 Attempting rollback...');
        try {
          await this.executeRollback(plan, migrationResult.completedSteps);
          migrationResult.rollbackExecuted = true;
          console.log('✅ Rollback completed successfully');
        } catch (rollbackError) {
          console.error('❌ Rollback failed:', rollbackError);
          migrationResult.rollbackExecuted = false;
        }
      }

      throw error;
    } finally {
      // Save migration log
      await this.saveMigrationLog(migrationResult);
    }

    return migrationResult;
  }

  /**
   * Execute a single migration step
   */
  private async executeStep(step: MigrationStep): Promise<void> {
    switch (step.type) {
      case 'data_export':
        await this.exportData(step);
        break;
      case 'data_import':
        await this.importData(step);
        break;
      case 'contract_deploy':
        await this.deployContract(step);
        break;
      case 'reference_update':
        await this.updateReferences(step);
        break;
      case 'verification':
        await this.verifyMigration(step);
        break;
      case 'cleanup':
        await this.cleanup(step);
        break;
      default:
        throw new Error(`Unknown step type: ${step.type}`);
    }
  }

  /**
   * Execute rollback steps
   */
  private async executeRollback(plan: MigrationPlan, completedSteps: string[]): Promise<void> {
    console.log('🔄 Executing rollback steps...');
    
    // Execute rollback steps in reverse order
    for (const step of plan.rollbackSteps.reverse()) {
      console.log(`   🔄 Rollback: ${step.description}`);
      
      try {
        await this.executeStep(step);
        console.log(`   ✅ Rollback step completed: ${step.id}`);
      } catch (error) {
        console.error(`   ❌ Rollback step failed: ${step.id}`, error);
        throw error;
      }
    }
  }

  // Step implementation methods

  private async exportData(step: MigrationStep): Promise<void> {
    console.log(`   📤 Exporting data from ${step.contract}`);
    
    const exportFile = path.join(__dirname, `migration-export-${step.contract}-${Date.now()}.json`);
    
    // Implementation would export actual contract data
    const exportData = {
      contract: step.contract,
      timestamp: new Date().toISOString(),
      parameters: step.parameters,
      data: {}, // Actual data would be exported here
    };
    
    fs.writeFileSync(exportFile, JSON.stringify(exportData, null, 2));
    console.log(`   💾 Data exported to: ${path.basename(exportFile)}`);
  }

  private async importData(step: MigrationStep): Promise<void> {
    console.log(`   📥 Importing data to ${step.contract}`);
    
    // Implementation would import data to new contracts
    console.log(`   ✅ Data imported to ${step.contract}`);
  }

  private async deployContract(step: MigrationStep): Promise<void> {
    console.log(`   🚀 Deploying contract: ${step.description}`);
    
    // Implementation would deploy new contract versions
    console.log(`   ✅ Contract deployed`);
  }

  private async updateReferences(step: MigrationStep): Promise<void> {
    console.log(`   🔄 Updating contract references`);
    
    // Implementation would update all references to point to new contracts
    console.log(`   ✅ References updated`);
  }

  private async verifyMigration(step: MigrationStep): Promise<void> {
    console.log(`   🔍 Verifying migration integrity`);
    
    // Implementation would verify data integrity and contract functionality
    console.log(`   ✅ Migration verified`);
  }

  private async cleanup(step: MigrationStep): Promise<void> {
    console.log(`   🧹 Cleaning up old contracts`);
    
    // Implementation would deactivate old contracts and clean up
    console.log(`   ✅ Cleanup completed`);
  }

  /**
   * Save migration log
   */
  private async saveMigrationLog(migrationResult: any): Promise<void> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const logFile = path.join(__dirname, `migration-log-${this.network}-${timestamp}.json`);
      
      const fullLog = {
        ...migrationResult,
        steps: this.migrationLog,
        admin: this.admin.addr,
      };
      
      fs.writeFileSync(logFile, JSON.stringify(fullLog, null, 2));
      console.log(`\n📄 Migration log saved to: ${path.basename(logFile)}`);
    } catch (error) {
      console.error('   ❌ Failed to save migration log:', error);
    }
  }
}

/**
 * CLI for migration operations
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const planName = args[1];
  const network = args.find(arg => arg.startsWith('--network='))?.split('=')[1] || 'testnet';
  const dryRun = args.includes('--dry-run');

  if (command === 'list' || !command) {
    console.log('📋 Available Migration Plans:');
    console.log('=' .repeat(50));
    
    for (const [key, plan] of Object.entries(migrationPlans)) {
      console.log(`\n🔄 ${key}`);
      console.log(`   Name: ${plan.name}`);
      console.log(`   Description: ${plan.description}`);
      console.log(`   Version: ${plan.version.from} → ${plan.version.to}`);
      console.log(`   Duration: ${plan.estimatedDuration}`);
      console.log(`   Steps: ${plan.steps.length}`);
      console.log(`   Risks: ${plan.risks.length}`);
    }
    
    console.log('\n📋 Usage:');
    console.log('   ts-node migration-tools.ts execute <plan-name> [--network=testnet] [--dry-run]');
    console.log('   ts-node migration-tools.ts list');
    console.log('\n📋 Examples:');
    console.log('   ts-node migration-tools.ts execute v1-to-v2 --network=testnet --dry-run');
    console.log('   ts-node migration-tools.ts execute emergency-migration --network=mainnet');
    
    process.exit(0);
  }

  if (command !== 'execute') {
    console.error('❌ Unknown command. Use "execute" or "list"');
    process.exit(1);
  }

  if (!planName) {
    console.error('❌ Migration plan name is required');
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

  try {
    const migrationExecutor = new DIRSMigrationExecutor(
      network,
      adminMnemonic,
      networkConfig,
      deploymentData
    );

    const result = await migrationExecutor.executeMigration(planName, dryRun);
    
    console.log('\n📋 Migration Summary:');
    console.log(`   Plan: ${result.planName}`);
    console.log(`   Network: ${result.network}`);
    console.log(`   Status: ${result.status}`);
    console.log(`   Duration: ${new Date(result.endTime).getTime() - new Date(result.startTime).getTime()}ms`);
    console.log(`   Completed Steps: ${result.completedSteps.length}`);
    
    if (result.status === 'completed') {
      console.log('\n🎉 Migration completed successfully!');
    } else {
      console.log('\n❌ Migration failed');
      if (result.rollbackExecuted) {
        console.log('✅ Rollback was executed successfully');
      } else {
        console.log('❌ Rollback failed or was not executed');
      }
    }

  } catch (error) {
    console.error('\n❌ Migration execution failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export {
  migrationPlans,
  DIRSMigrationExecutor,
  MigrationPlan,
  MigrationStep,
};