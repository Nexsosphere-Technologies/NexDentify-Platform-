# DIRS Smart Contracts Update System

This document describes the comprehensive update system for DIRS smart contracts, including parameter updates, emergency operations, and migration tools.

## Overview

The DIRS update system provides three main categories of operations:

1. **Parameter Updates** - Modify contract parameters and settings
2. **Emergency Operations** - Handle critical situations requiring immediate action
3. **Migration Tools** - Upgrade contracts and migrate data between versions

## Quick Start

### Prerequisites

```bash
cd smart-contracts/deployments
npm install
```

### Environment Setup

Ensure your `.env` file contains the necessary mnemonics:

```bash
TESTNET_MNEMONIC="your 25 word mnemonic for testnet"
MAINNET_MNEMONIC="your 25 word mnemonic for mainnet"
LOCALNET_MNEMONIC="your 25 word mnemonic for localnet"
```

## Parameter Updates

### Available Update Configurations

1. **Fee Adjustment** - Reduce fees for better accessibility
2. **DIRS Features** - Enable portability and sovereignty features
3. **Staking Optimization** - Improve staking parameters
4. **Farming Extension** - Extend and enhance farming rewards
5. **Comprehensive** - Apply all optimizations
6. **Emergency Security** - Increase fees for security

### Usage Examples

```bash
# List available update configurations
ts-node update-parameters.ts

# Test fee adjustment on testnet (dry run)
ts-node update-parameters.ts fee-adjustment --network=testnet --dry-run

# Apply DIRS features on testnet
ts-node update-parameters.ts dirs-features --network=testnet

# Comprehensive update on mainnet
ts-node update-parameters.ts comprehensive --network=mainnet
```

### Custom Parameter Updates

Create custom update configurations:

```typescript
import { UpdateParameters } from './update-contracts';

const customUpdate: UpdateParameters = {
  didRegistry: {
    registrationFee: 1200000, // 1.2 NEXDEN
    interoperabilityEnabled: true,
  },
  stakingPool: {
    rewardRate: 1800, // 18% APY
    minStakeAmount: 2000000, // 2 NEXDEN
  },
};
```

## Emergency Operations

### Available Operations

1. **pause-all** - Immediately pause all contracts
2. **resume-all** - Resume normal operations
3. **security-lockdown** - Full security lockdown
4. **maintenance-mode** - Enter maintenance mode
5. **exit-maintenance** - Exit maintenance mode
6. **emergency-withdraw** - Withdraw funds to admin

### Usage Examples

```bash
# List available emergency operations
ts-node emergency-operations.ts list

# Pause all contracts on testnet
ts-node emergency-operations.ts pause-all --network=testnet

# Security lockdown on mainnet (requires confirmation)
ts-node emergency-operations.ts security-lockdown --network=mainnet

# Force operation without confirmation
ts-node emergency-operations.ts pause-all --network=testnet --force
```

### Emergency Response Workflow

1. **Assess Situation** - Determine the appropriate response
2. **Execute Operation** - Run the emergency operation
3. **Investigate** - Find and fix the underlying issue
4. **Test Fixes** - Verify fixes on testnet
5. **Resume Operations** - Return to normal operations

## Migration Tools

### Available Migration Plans

1. **v1-to-v2** - Migrate from DIRS v1.0 to v2.0
2. **emergency-migration** - Emergency migration for security issues

### Migration Process

```bash
# List available migration plans
ts-node migration-tools.ts list

# Test migration on testnet (dry run)
ts-node migration-tools.ts execute v1-to-v2 --network=testnet --dry-run

# Execute migration on testnet
ts-node migration-tools.ts execute v1-to-v2 --network=testnet

# Emergency migration on mainnet
ts-node migration-tools.ts execute emergency-migration --network=mainnet
```

### Migration Steps

1. **Data Export** - Export data from current contracts
2. **Contract Deployment** - Deploy new contract versions
3. **Data Import** - Import data to new contracts
4. **Reference Updates** - Update all contract references
5. **Verification** - Verify migration completeness
6. **Cleanup** - Deactivate old contracts

## Advanced Usage

### Programmatic Updates

```typescript
import { DIRSContractUpdater, UpdateParameters } from './update-contracts';

const config = {
  network: 'testnet',
  adminMnemonic: process.env.TESTNET_MNEMONIC!,
  algodToken: '',
  algodServer: 'https://testnet-api.algonode.cloud',
  algodPort: 443,
  updateType: 'parameters',
};

const updater = new DIRSContractUpdater(config, deploymentData);
const result = await updater.updateParameters(updateParams);
```

### Batch Operations

Update multiple networks:

```bash
# Update fees on all networks
ts-node update-parameters.ts fee-adjustment --network=localnet
ts-node update-parameters.ts fee-adjustment --network=testnet
ts-node update-parameters.ts fee-adjustment --network=mainnet
```

### Selective Contract Updates

Update specific contracts only:

```bash
# Update only DID and VC registries
ts-node update-contracts.ts --type=parameters --contracts=didRegistry,vcRegistry --network=testnet
```

## Configuration Files

### Update Parameters Configuration

```json
{
  "didRegistry": {
    "registrationFee": 800000,
    "updateFee": 400000,
    "interoperabilityEnabled": true,
    "crossChainSupport": true
  },
  "reputationRegistry": {
    "attestationFee": 1200000,
    "disputeFee": 2500000,
    "portabilityEnabled": true,
    "crossPlatformSupport": true,
    "selfSovereignMode": true
  },
  "vcRegistry": {
    "registrationFee": 1500000,
    "revocationFee": 800000,
    "portabilityEnabled": true,
    "crossPlatformSupport": true,
    "selfSovereignMode": true,
    "interoperabilityLevel": 1000
  },
  "stakingPool": {
    "rewardRate": 1500,
    "minStakeAmount": 500000,
    "unbondingPeriod": 432000
  },
  "lpFarmingPool": {
    "rewardRate": 150,
    "endTime": 1740000000
  }
}
```

### Migration Plan Configuration

```json
{
  "name": "Custom Migration",
  "description": "Custom migration plan",
  "version": {
    "from": "1.0.0",
    "to": "1.1.0"
  },
  "steps": [
    {
      "id": "export-data",
      "type": "data_export",
      "description": "Export contract data",
      "contract": "didRegistry",
      "rollbackable": true
    }
  ],
  "estimatedDuration": "1 hour",
  "risks": ["Minimal risk"]
}
```

## Monitoring and Logging

### Update Logs

All updates generate detailed logs:

- `update-{network}-{type}-{timestamp}.json` - Update results
- `emergency-log-{network}-{timestamp}.json` - Emergency operation logs
- `migration-log-{network}-{timestamp}.json` - Migration execution logs

### Log Structure

```json
{
  "network": "testnet",
  "timestamp": "2025-01-27T10:00:00.000Z",
  "updateType": "parameters",
  "admin": "ADMIN_ADDRESS",
  "contracts": {
    "didRegistry": {
      "appId": 123456789,
      "updated": true,
      "changes": ["Updated fees: registration=800000, update=400000"],
      "txIds": ["TRANSACTION_ID"]
    }
  },
  "overallStatus": "success"
}
```

## Security Considerations

### Mainnet Operations

- **Confirmation Required** - All mainnet operations require explicit confirmation
- **Mnemonic Security** - Use environment variables for mnemonics
- **Dry Run Testing** - Always test with `--dry-run` first
- **Backup Plans** - Have rollback procedures ready

### Emergency Procedures

1. **Immediate Response** - Use emergency operations for critical issues
2. **Communication** - Notify stakeholders of emergency actions
3. **Documentation** - Log all emergency operations
4. **Post-Incident** - Conduct post-incident reviews

### Access Control

- **Admin Only** - All update operations require admin privileges
- **Multi-Signature** - Consider multi-signature for critical operations
- **Audit Trail** - Maintain complete audit trails
- **Regular Reviews** - Review access and procedures regularly

## Troubleshooting

### Common Issues

1. **Insufficient Balance**
   ```
   Error: Insufficient balance for transaction
   ```
   **Solution**: Fund admin account with more ALGO

2. **Contract Not Found**
   ```
   Error: Contract not deployed
   ```
   **Solution**: Deploy contracts first or check deployment file

3. **Parameter Validation**
   ```
   Error: Invalid parameter value
   ```
   **Solution**: Check parameter ranges and types

4. **Network Connection**
   ```
   Error: Network request failed
   ```
   **Solution**: Check network connectivity and endpoints

### Recovery Procedures

1. **Failed Updates** - Use rollback procedures if available
2. **Emergency Situations** - Use emergency operations to stabilize
3. **Data Loss** - Restore from backups if available
4. **Contract Issues** - Deploy new contracts and migrate data

## Best Practices

### Update Workflow

1. **Plan Updates** - Plan all updates carefully
2. **Test Thoroughly** - Test on localnet and testnet first
3. **Dry Run** - Always use dry run mode for testing
4. **Gradual Rollout** - Roll out updates gradually
5. **Monitor Closely** - Monitor system after updates

### Emergency Response

1. **Quick Assessment** - Quickly assess the situation
2. **Immediate Action** - Take immediate action if needed
3. **Clear Communication** - Communicate clearly with stakeholders
4. **Thorough Investigation** - Investigate root causes
5. **Preventive Measures** - Implement preventive measures

### Migration Management

1. **Comprehensive Planning** - Plan migrations thoroughly
2. **Data Backup** - Backup all data before migration
3. **Rollback Plans** - Have rollback plans ready
4. **Verification** - Verify migration completeness
5. **User Communication** - Communicate with users about migrations

## Support and Resources

- **Documentation** - Comprehensive documentation available
- **Examples** - Working examples for all operations
- **Testing Tools** - Dry run and verification tools
- **Logging** - Detailed logging for troubleshooting
- **Community** - Active community support

## License

MIT License - see LICENSE file for details.