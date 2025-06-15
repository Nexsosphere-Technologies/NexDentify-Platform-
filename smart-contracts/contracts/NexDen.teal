import {
  Account,
  Algodv2,
  makeAssetCreateTxnWithSuggestedParamsFromObject,
  makeAssetConfigTxnWithSuggestedParamsFromObject,
  makeAssetTransferTxnWithSuggestedParamsFromObject,
  makeAssetFreezeTxnWithSuggestedParamsFromObject,
  waitForConfirmation,
  encodeUint64,
  decodeUint64,
} from 'algosdk';

export interface NexDenASAConfig {
  total: number;
  decimals: number;
  defaultFrozen: boolean;
  unitName: string;
  assetName: string;
  assetURL?: string;
  assetMetadataHash?: Uint8Array;
  manager?: string;
  reserve?: string;
  freeze?: string;
  clawback?: string;
}

export class NexDenASA {
  private algodClient: Algodv2;
  private creatorAccount: Account;
  private assetId?: number;

  constructor(algodClient: Algodv2, creatorAccount: Account) {
    this.algodClient = algodClient;
    this.creatorAccount = creatorAccount;
  }

  /**
   * Create the NexDen ASA token
   */
  async createASA(config?: Partial<NexDenASAConfig>): Promise<number> {
    const defaultConfig: NexDenASAConfig = {
      total: 1000000000, // 1 billion tokens
      decimals: 6,
      defaultFrozen: false,
      unitName: 'NexDen',
      assetName: 'NexDentify Token',
      assetURL: 'https://nexdentify.com',
      manager: this.creatorAccount.addr,
      reserve: this.creatorAccount.addr,
      freeze: this.creatorAccount.addr,
      clawback: this.creatorAccount.addr,
    };

    const finalConfig = { ...defaultConfig, ...config };

    try {
      const suggestedParams = await this.algodClient.getTransactionParams().do();

      const txn = makeAssetCreateTxnWithSuggestedParamsFromObject({
        from: this.creatorAccount.addr,
        total: finalConfig.total,
        decimals: finalConfig.decimals,
        defaultFrozen: finalConfig.defaultFrozen,
        manager: finalConfig.manager,
        reserve: finalConfig.reserve,
        freeze: finalConfig.freeze,
        clawback: finalConfig.clawback,
        unitName: finalConfig.unitName,
        assetName: finalConfig.assetName,
        assetURL: finalConfig.assetURL,
        assetMetadataHash: finalConfig.assetMetadataHash,
        suggestedParams,
      });

      const signedTxn = txn.signTxn(this.creatorAccount.sk);
      const { txId } = await this.algodClient.sendRawTransaction(signedTxn).do();
      
      const confirmedTxn = await waitForConfirmation(this.algodClient, txId, 4);
      this.assetId = confirmedTxn['asset-index'];

      console.log(`NexDen ASA created with ID: ${this.assetId}`);
      return this.assetId;
    } catch (error) {
      console.error('Error creating NexDen ASA:', error);
      throw error;
    }
  }

  /**
   * Opt-in to receive NexDen tokens
   */
  async optIn(account: Account, assetId?: number): Promise<string> {
    const targetAssetId = assetId || this.assetId;
    if (!targetAssetId) {
      throw new Error('Asset ID not provided and ASA not created yet');
    }

    try {
      const suggestedParams = await this.algodClient.getTransactionParams().do();

      const txn = makeAssetTransferTxnWithSuggestedParamsFromObject({
        from: account.addr,
        to: account.addr,
        amount: 0,
        assetIndex: targetAssetId,
        suggestedParams,
      });

      const signedTxn = txn.signTxn(account.sk);
      const { txId } = await this.algodClient.sendRawTransaction(signedTxn).do();
      
      await waitForConfirmation(this.algodClient, txId, 4);
      console.log(`Account ${account.addr} opted in to NexDen ASA`);
      return txId;
    } catch (error) {
      console.error('Error opting in to NexDen ASA:', error);
      throw error;
    }
  }

  /**
   * Transfer NexDen tokens
   */
  async transfer(
    from: Account,
    to: string,
    amount: number,
    assetId?: number
  ): Promise<string> {
    const targetAssetId = assetId || this.assetId;
    if (!targetAssetId) {
      throw new Error('Asset ID not provided and ASA not created yet');
    }

    try {
      const suggestedParams = await this.algodClient.getTransactionParams().do();

      const txn = makeAssetTransferTxnWithSuggestedParamsFromObject({
        from: from.addr,
        to: to,
        amount: amount,
        assetIndex: targetAssetId,
        suggestedParams,
      });

      const signedTxn = txn.signTxn(from.sk);
      const { txId } = await this.algodClient.sendRawTransaction(signedTxn).do();
      
      await waitForConfirmation(this.algodClient, txId, 4);
      console.log(`Transferred ${amount} NexDen tokens from ${from.addr} to ${to}`);
      return txId;
    } catch (error) {
      console.error('Error transferring NexDen tokens:', error);
      throw error;
    }
  }

  /**
   * Freeze/unfreeze NexDen tokens for an account
   */
  async freezeAccount(
    targetAccount: string,
    freezeState: boolean,
    assetId?: number
  ): Promise<string> {
    const targetAssetId = assetId || this.assetId;
    if (!targetAssetId) {
      throw new Error('Asset ID not provided and ASA not created yet');
    }

    try {
      const suggestedParams = await this.algodClient.getTransactionParams().do();

      const txn = makeAssetFreezeTxnWithSuggestedParamsFromObject({
        from: this.creatorAccount.addr,
        assetIndex: targetAssetId,
        freezeTarget: targetAccount,
        freezeState: freezeState,
        suggestedParams,
      });

      const signedTxn = txn.signTxn(this.creatorAccount.sk);
      const { txId } = await this.algodClient.sendRawTransaction(signedTxn).do();
      
      await waitForConfirmation(this.algodClient, txId, 4);
      console.log(`${freezeState ? 'Frozen' : 'Unfrozen'} NexDen tokens for ${targetAccount}`);
      return txId;
    } catch (error) {
      console.error('Error freezing/unfreezing account:', error);
      throw error;
    }
  }

  /**
   * Clawback NexDen tokens from an account
   */
  async clawback(
    from: string,
    to: string,
    amount: number,
    assetId?: number
  ): Promise<string> {
    const targetAssetId = assetId || this.assetId;
    if (!targetAssetId) {
      throw new Error('Asset ID not provided and ASA not created yet');
    }

    try {
      const suggestedParams = await this.algodClient.getTransactionParams().do();

      const txn = makeAssetTransferTxnWithSuggestedParamsFromObject({
        from: this.creatorAccount.addr, // Clawback account
        to: to,
        amount: amount,
        assetIndex: targetAssetId,
        revocationTarget: from, // Account to clawback from
        suggestedParams,
      });

      const signedTxn = txn.signTxn(this.creatorAccount.sk);
      const { txId } = await this.algodClient.sendRawTransaction(signedTxn).do();
      
      await waitForConfirmation(this.algodClient, txId, 4);
      console.log(`Clawed back ${amount} NexDen tokens from ${from} to ${to}`);
      return txId;
    } catch (error) {
      console.error('Error clawing back tokens:', error);
      throw error;
    }
  }

  /**
   * Update ASA configuration
   */
  async updateConfig(
    newManager?: string,
    newReserve?: string,
    newFreeze?: string,
    newClawback?: string,
    assetId?: number
  ): Promise<string> {
    const targetAssetId = assetId || this.assetId;
    if (!targetAssetId) {
      throw new Error('Asset ID not provided and ASA not created yet');
    }

    try {
      const suggestedParams = await this.algodClient.getTransactionParams().do();

      const txn = makeAssetConfigTxnWithSuggestedParamsFromObject({
        from: this.creatorAccount.addr,
        assetIndex: targetAssetId,
        manager: newManager,
        reserve: newReserve,
        freeze: newFreeze,
        clawback: newClawback,
        suggestedParams,
      });

      const signedTxn = txn.signTxn(this.creatorAccount.sk);
      const { txId } = await this.algodClient.sendRawTransaction(signedTxn).do();
      
      await waitForConfirmation(this.algodClient, txId, 4);
      console.log('NexDen ASA configuration updated');
      return txId;
    } catch (error) {
      console.error('Error updating ASA configuration:', error);
      throw error;
    }
  }

  /**
   * Get ASA information
   */
  async getASAInfo(assetId?: number): Promise<any> {
    const targetAssetId = assetId || this.assetId;
    if (!targetAssetId) {
      throw new Error('Asset ID not provided and ASA not created yet');
    }

    try {
      const assetInfo = await this.algodClient.getAssetByID(targetAssetId).do();
      return assetInfo;
    } catch (error) {
      console.error('Error getting ASA info:', error);
      throw error;
    }
  }

  /**
   * Get account asset balance
   */
  async getBalance(accountAddress: string, assetId?: number): Promise<number> {
    const targetAssetId = assetId || this.assetId;
    if (!targetAssetId) {
      throw new Error('Asset ID not provided and ASA not created yet');
    }

    try {
      const accountInfo = await this.algodClient.accountInformation(accountAddress).do();
      const asset = accountInfo['assets'].find((a: any) => a['asset-id'] === targetAssetId);
      return asset ? asset.amount : 0;
    } catch (error) {
      console.error('Error getting account balance:', error);
      throw error;
    }
  }

  /**
   * Destroy the ASA (only if manager is set and no tokens are held by other accounts)
   */
  async destroyASA(assetId?: number): Promise<string> {
    const targetAssetId = assetId || this.assetId;
    if (!targetAssetId) {
      throw new Error('Asset ID not provided and ASA not created yet');
    }

    try {
      const suggestedParams = await this.algodClient.getTransactionParams().do();

      const txn = makeAssetConfigTxnWithSuggestedParamsFromObject({
        from: this.creatorAccount.addr,
        assetIndex: targetAssetId,
        manager: undefined, // Setting to undefined destroys the asset
        reserve: undefined,
        freeze: undefined,
        clawback: undefined,
        suggestedParams,
      });

      const signedTxn = txn.signTxn(this.creatorAccount.sk);
      const { txId } = await this.algodClient.sendRawTransaction(signedTxn).do();
      
      await waitForConfirmation(this.algodClient, txId, 4);
      console.log('NexDen ASA destroyed');
      return txId;
    } catch (error) {
      console.error('Error destroying ASA:', error);
      throw error;
    }
  }

  // Getter for asset ID
  get assetID(): number | undefined {
    return this.assetId;
  }
}

// Example usage
export async function exampleUsage() {
  // Initialize Algod client (replace with your node details)
  const algodClient = new Algodv2(
    'your-api-token',
    'https://testnet-api.algonode.cloud',
    443
  );

  // Create or import creator account
  const creatorMnemonic = 'your 25-word mnemonic here';
  // const creatorAccount = mnemonicToSecretKey(creatorMnemonic);

  // For demo purposes, creating a random account
  const creatorAccount = Account.generate();

  // Initialize NexDen ASA
  const nexDenASA = new NexDenASA(algodClient, creatorAccount);

  try {
    // Create the ASA
    const assetId = await nexDenASA.createASA({
      total: 1000000000, // 1 billion tokens
      decimals: 6,
      assetName: 'NexDentify Token',
      unitName: 'NexDen',
      assetURL: 'https://nexdentify.com',
    });

    console.log(`NexDen ASA created with ID: ${assetId}`);

    // Create a recipient account
    const recipientAccount = Account.generate();

    // Recipient opts in to receive tokens
    await nexDenASA.optIn(recipientAccount, assetId);

    // Transfer tokens to recipient
    await nexDenASA.transfer(creatorAccount, recipientAccount.addr, 1000000, assetId);

    // Check balance
    const balance = await nexDenASA.getBalance(recipientAccount.addr, assetId);
    console.log(`Recipient balance: ${balance} NexDen tokens`);

    // Get ASA info
    const asaInfo = await nexDenASA.getASAInfo(assetId);
    console.log('ASA Info:', asaInfo);

  } catch (error) {
    console.error('Error in example usage:', error);
  }
}
