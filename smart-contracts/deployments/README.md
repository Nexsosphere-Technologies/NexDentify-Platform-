# DIRS Smart Contracts Deployment

This directory contains deployment scripts and tools for the DIRS (Decentralized Identity and Reputation System) smart contracts.

## Quick Start

### Prerequisites

1. **Node.js and npm** installed
2. **Algorand account** with sufficient ALGO for deployment
3. **Network access** to Algorand nodes

### Installation

```bash
cd smart-contracts/deployments
npm install
```

### Environment Setup

Create a `.env` file with your deployment configuration:

```bash
# For testnet deployment
TESTNET_MNEMONIC="your 25 word mnemonic phrase here"

# For mainnet deployment (keep secure!)
MAINNET_MNEMONIC="your 25 word mnemonic phrase here"

# For localnet (optional)
LOCALNET_MNEMONIC="your 25 word mnemonic phrase here"
```

## Deployment Commands

### Testnet Deployment

```bash
# Deploy to testnet
npm run deploy:testnet

# Or with custom mnemonic
ts-node deploy-all.ts --network=testnet --mnemonic="your mnemonic"

# Deploy and fund contracts
ts-node deploy-all.ts --network=testnet --fund-contracts
```

### Mainnet Deployment

```bash
# Deploy to mainnet (requires confirmation)
npm run deploy:mainnet

# Or directly
ts-node deploy-mainnet.ts
```

### Localnet Deployment

```bash
# Deploy to localnet for development
npm run deploy:localnet

# Or directly
ts-node deploy-localnet.ts
```

## Verification

Verify your deployment after completion:

```bash
# Verify testnet deployment
npm run verify:testnet

# Verify mainnet deployment
npm run verify:mainnet

# Verify specific deployment file
ts-node verify-deployment.ts --network=testnet --file=deployment-testnet-2025-01-27.json
```

## Deployment Process

The deployment script follows this sequence:

1. **Account Setup**: Verify deployer account and funding
2. **NEXDEN Token**: Deploy the NEXDEN ASA token
3. **DID Registry**: Deploy decentralized identity registry
4. **Reputation Registry**: Deploy reputation attestation system
5. **VC Registry**: Deploy verifiable credentials registry
6. **Staking Pool**: Deploy NEXDEN token staking
7. **LP Farming Pool**: Deploy liquidity provider farming
8. **Configuration**: Configure contract parameters
9. **Verification**: Verify all deployments
10. **Documentation**: Save deployment results

## Contract Configuration

### Default Fee Structure

- **DID Registration**: 1 NEXDEN
- **DID Update**: 0.5 NEXDEN
- **Reputation Attestation**: 1.5 NEXDEN
- **Reputation Dispute**: 3 NEXDEN
- **VC Registration**: 2 NEXDEN
- **VC Revocation**: 1 NEXDEN

### Staking Configuration

- **Reward Rate**: 12% APY
- **Minimum Stake**: 1 NEXDEN
- **Unbonding Period**: 7 days

### Farming Configuration

- **Reward Rate**: 100 NEXDEN per second per LP token
- **Farming Period**: 90 days

## Deployment Files

After deployment, the following files are created:

- `deployment-{network}-{timestamp}.json`: Full deployment details
- `latest-{network}.json`: Latest deployment for the network
- `verification-{network}-{timestamp}.json`: Verification results

### Deployment File Structure

```json
{
  "network": "testnet",
  "timestamp": "2025-01-27T10:00:00.000Z",
  "deployer": "ALGORAND_ADDRESS",
  "nexdenAssetId": 123456789,
  "contracts": {
    "didRegistry": {
      "appId": 987654321,
      "appAddress": "CONTRACT_ADDRESS",
      "txId": "TRANSACTION_ID"
    },
    "reputationRegistry": { ... },
    "vcRegistry": { ... },
    "stakingPool": { ... },
    "lpFarmingPool": { ... }
  },
  "configuration": {
    "fees": { ... },
    "staking": { ... },
    "farming": { ... }
  }
}
```

## Network-Specific Notes

### Testnet

- **Purpose**: Testing and development
- **Funding**: Use [Algorand Testnet Faucet](https://testnet.algoexplorer.io/dispenser)
- **Reset**: Testnet resets periodically
- **Explorer**: [Testnet AlgoExplorer](https://testnet.algoexplorer.io)

### Mainnet

- **Purpose**: Production deployment
- **Funding**: Real ALGO required
- **Security**: Extra confirmation required
- **Explorer**: [Mainnet AlgoExplorer](https://algoexplorer.io)

### Localnet

- **Purpose**: Local development
- **Setup**: Requires local Algorand node
- **Funding**: Generous funding for testing
- **Reset**: Data lost on restart

## Security Considerations

### Mnemonic Security

- **Never commit** mnemonics to version control
- **Use environment variables** for sensitive data
- **Backup securely** your deployment mnemonics
- **Use hardware wallets** for mainnet deployments

### Deployment Safety

- **Test thoroughly** on testnet first
- **Verify contracts** after deployment
- **Monitor transactions** during deployment
- **Have rollback plans** for mainnet

## Troubleshooting

### Common Issues

1. **Insufficient Balance**
   ```bash
   Error: Insufficient balance for deployment
   ```
   **Solution**: Fund your deployer account with more ALGO

2. **Network Connection**
   ```bash
   Error: Network request failed
   ```
   **Solution**: Check network connectivity and node endpoints

3. **Contract Verification Failed**
   ```bash
   Error: Contract verification failed
   ```
   **Solution**: Check contract deployment and try verification again

4. **Mnemonic Issues**
   ```bash
   Error: Invalid mnemonic
   ```
   **Solution**: Verify your 25-word mnemonic phrase

### Getting Help

- Check the [Algorand Developer Portal](https://developer.algorand.org)
- Review [TEALScript Documentation](https://tealscript.algo.xyz)
- Join the [Algorand Discord](https://discord.gg/algorand)

## Advanced Usage

### Custom Configuration

You can customize deployment parameters by modifying the configuration objects in the deployment scripts:

```typescript
const customConfig = {
  fees: {
    didRegistration: 2000000, // 2 NEXDEN
    didUpdate: 1000000,       // 1 NEXDEN
    // ... other fees
  },
  staking: {
    rewardRate: 1500,         // 15% APY
    minStakeAmount: 5000000,  // 5 NEXDEN
    unbondingPeriod: 14 * 24 * 3600, // 14 days
  }
};
```

### Programmatic Deployment

Use the deployment classes programmatically:

```typescript
import { DIRSDeployment } from './deploy-all';

const deployment = new DIRSDeployment(config);
const result = await deployment.deployAll();

// Access deployment results
console.log('DID Registry App ID:', result.contracts.didRegistry.appId);
```

### Batch Operations

Deploy multiple environments:

```bash
# Deploy to all networks
npm run deploy:localnet
npm run deploy:testnet
# npm run deploy:mainnet  # Uncomment for mainnet
```

## Monitoring and Maintenance

### Post-Deployment Checklist

- [ ] Verify all contracts deployed successfully
- [ ] Test basic functionality of each contract
- [ ] Set up monitoring and alerts
- [ ] Update frontend configuration
- [ ] Document contract addresses
- [ ] Set up backup procedures
- [ ] Plan upgrade procedures

### Ongoing Maintenance

- Monitor contract usage and performance
- Track fee collection and distribution
- Update contract parameters as needed
- Plan for contract upgrades
- Maintain security best practices

## License

MIT License - see LICENSE file for details.