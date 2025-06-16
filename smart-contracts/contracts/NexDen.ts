import { Contract } from '@algorandfoundation/tealscript';
import { Algodv2, Account, makeAssetCreateTxnWithSuggestedParamsFromObject, makeAssetTransferTxnWithSuggestedParamsFromObject, makeAssetConfigTxnWithSuggestedParamsFromObject } from 'algosdk';

export interface ASAConfig {
  total: number;
  decimals: number;
  assetName: string;
  unitName: string;
  url?: string;
  metadataHash?: Uint8Array;
  defaultFrozen?: boolean;
}

/**
 * NexDen ASA Token Management Class
 */
export class NexDenASA {
  private algodClient: Algodv2;
  private creator: Account;

  constructor(algodClient: Algodv2, creator: Account) {
    this.algodClient = algodClient;
    this.creator = creator;
  }

  /**
   * Create the NEXDEN ASA token
   */
  async createASA(config: ASAConfig): Promise<number> {
    try {
      const suggestedParams = await this.algodClient.getTransactionParams().do();

      const txn = makeAssetCreateTxnWithSuggestedParamsFromObject({
        from: this.creator.addr,
        total: config.total,
        decimals: config.decimals,
        assetName: config.assetName,
        unitName: config.unitName,
        assetURL: config.url || '',
        assetMetadataHash: config.metadataHash,
        defaultFrozen: config.defaultFrozen || false,
        freeze: this.creator.addr,
        manager: this.creator.addr,
        clawback: this.creator.addr,
        reserve: this.creator.addr,
        suggestedParams,
      });

      const signedTxn = txn.signTxn(this.creator.sk);
      const { txId } = await this.algodClient.sendRawTransaction(signedTxn).do();
      
      const result = await this.algodClient.pendingTransactionInformation(txId).do();
      const assetId = result['asset-index'];

      console.log(`NEXDEN ASA created with Asset ID: ${assetId}`);
      return assetId;
    } catch (error) {
      console.error('Error creating NEXDEN ASA:', error);
      throw error;
    }
  }

  /**
   * Opt user into the ASA
   */
  async optIn(user: Account, assetId: number): Promise<string> {
    try {
      const suggestedParams = await this.algodClient.getTransactionParams().do();

      const txn = makeAssetTransferTxnWithSuggestedParamsFromObject({
        from: user.addr,
        to: user.addr,
        amount: 0,
        assetIndex: assetId,
        suggestedParams,
      });

      const signedTxn = txn.signTxn(user.sk);
      const { txId } = await this.algodClient.sendRawTransaction(signedTxn).do();

      console.log(`User ${user.addr} opted into asset ${assetId}`);
      return txId;
    } catch (error) {
      console.error('Error opting into ASA:', error);
      throw error;
    }
  }

  /**
   * Transfer ASA tokens
   */
  async transfer(
    sender: Account,
    receiver: string,
    amount: number,
    assetId: number
  ): Promise<string> {
    try {
      const suggestedParams = await this.algodClient.getTransactionParams().do();

      const txn = makeAssetTransferTxnWithSuggestedParamsFromObject({
        from: sender.addr,
        to: receiver,
        amount: amount,
        assetIndex: assetId,
        suggestedParams,
      });

      const signedTxn = txn.signTxn(sender.sk);
      const { txId } = await this.algodClient.sendRawTransaction(signedTxn).do();

      console.log(`Transferred ${amount} tokens from ${sender.addr} to ${receiver}`);
      return txId;
    } catch (error) {
      console.error('Error transferring ASA:', error);
      throw error;
    }
  }

  /**
   * Get asset balance for an account
   */
  async getBalance(address: string, assetId: number): Promise<number> {
    try {
      const accountInfo = await this.algodClient.accountInformation(address).do();
      const asset = accountInfo.assets.find((a: any) => a['asset-id'] === assetId);
      return asset ? asset.amount : 0;
    } catch (error) {
      console.error('Error getting asset balance:', error);
      throw error;
    }
  }

  /**
   * Get asset information
   */
  async getAssetInfo(assetId: number): Promise<any> {
    try {
      const assetInfo = await this.algodClient.getAssetByID(assetId).do();
      return assetInfo;
    } catch (error) {
      console.error('Error getting asset info:', error);
      throw error;
    }
  }
}