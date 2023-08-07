/* eslint-disable @typescript-eslint/no-unused-vars */
import _ from 'lodash';
import { randomUUID } from 'crypto';
import { XComError } from '../../error';
import { Repository } from './repository';
import { AssetsController } from './assets-controller';
import {
  BlockchainWithdrawalRequest,
  CrossAccountTransferCapability,
  CrossAccountWithdrawalRequest,
  FiatWithdrawalRequest,
  IbanCapability,
  Layer1Cryptocurrency,
  NationalCurrencyCode,
  PublicBlockchainCapability,
  SwiftCapability,
  Withdrawal,
  WithdrawalCapability,
  WithdrawalStatus,
} from '../../client/generated';
import { fakeSchemaObject } from '../../schemas';
import { JSONSchemaFaker } from 'json-schema-faker';

export type WithdrawalRequest =
  | FiatWithdrawalRequest
  | BlockchainWithdrawalRequest
  | CrossAccountWithdrawalRequest;

type Order = 'asc' | 'desc';

export class WithdrawalNotFoundError extends XComError {
  constructor() {
    super('Withdrawal not found');
  }
}

export class WithdrawalController {
  private readonly withdrawalRepository = new Repository<Withdrawal>();
  private readonly withdrawalCapabilityRepository = new Repository<WithdrawalCapability>();

  constructor(
    assetsConroller: AssetsController,
    capabilitiesCount: number,
    withdrawalsCount: number
  ) {
    Array.from(Array(capabilitiesCount)).map(() =>
      this.withdrawalRepository.create(fakeSchemaObject('Withdrawal') as Withdrawal)
    );
    Array.from(Array(withdrawalsCount)).map(() =>
      this.withdrawalCapabilityRepository.create(
        fakeSchemaObject('WithdrawalCapability') as WithdrawalCapability
      )
    );

    this.setKnownAdditionalAssets(assetsConroller);
  }

  private setKnownAdditionalAssets(assetsController: AssetsController): void {
    const additionalAssetsIds = assetsController.getAllAdditionalAssets().map((asset) => asset.id);

    for (const { id } of this.withdrawalCapabilityRepository.list()) {
      const capability = this.withdrawalCapabilityRepository.find(id);
      if (!capability) {
        throw new Error('Not possible!');
      }

      if ('assetId' in capability.balanceAsset) {
        capability.balanceAsset.assetId = JSONSchemaFaker.random.pick(additionalAssetsIds);
      }

      if ('assetId' in capability.withdrawal.asset) {
        capability.withdrawal.asset.assetId = JSONSchemaFaker.random.pick(additionalAssetsIds);
      }
    }

    for (const { id } of this.withdrawalRepository.list()) {
      const withdrawal = this.withdrawalRepository.find(id);
      if (!withdrawal) {
        throw new Error('Not possible!');
      }

      if ('assetId' in withdrawal.balanceAsset) {
        withdrawal.balanceAsset.assetId = JSONSchemaFaker.random.pick(additionalAssetsIds);
      }

      if ('assetId' in withdrawal.destination.asset) {
        withdrawal.destination.asset.assetId = JSONSchemaFaker.random.pick(additionalAssetsIds);
      }
    }
  }

  private withdrawalFromWithdrawalRequest(request: WithdrawalRequest): Withdrawal {
    const { idempotencyKey, ...withdrawalRequest } = request;
    return {
      id: randomUUID(),
      status: WithdrawalStatus.PENDING,
      createdAt: new Date().toISOString(),
      ...withdrawalRequest,
    };
  }

  public getCapabilites(): WithdrawalCapability[] {
    return this.withdrawalCapabilityRepository.list();
  }

  public getWithdrawals(order: Order): Withdrawal[] {
    const withdrawals = this.withdrawalRepository.list();
    return _.orderBy(withdrawals, 'createdAt', order);
  }

  public getWithdrawal(withdrawalId: string): Withdrawal {
    const withdrawal = this.withdrawalRepository.find(withdrawalId);

    if (!withdrawal) {
      throw new WithdrawalNotFoundError();
    }

    return withdrawal;
  }

  public getSubAccountWithdrawals(order: Order): Withdrawal[] {
    const withdrawals = this.getWithdrawals(order);
    return withdrawals.filter(
      (withdrawal) =>
        withdrawal.destination.transferMethod ===
        CrossAccountTransferCapability.transferMethod.INTERNAL_TRANSFER
    );
  }

  public getPeerAccountWithdrawals(order: Order): Withdrawal[] {
    const withdrawals = this.getWithdrawals(order);
    return withdrawals.filter(
      (withdrawal) =>
        withdrawal.destination.transferMethod ===
        CrossAccountTransferCapability.transferMethod.PEER_ACCOUNT_TRANSFER
    );
  }

  public getFiatWithdrawals(order: Order): Withdrawal[] {
    const fiatTransferMethods: string[] = [
      IbanCapability.transferMethod.IBAN,
      SwiftCapability.transferMethod.SWIFT,
    ];
    const withdrawals = this.getWithdrawals(order);
    return withdrawals.filter((withdrawal) =>
      fiatTransferMethods.includes(withdrawal.destination.transferMethod)
    );
  }

  public getBlockchainWithdrawals(order: Order): Withdrawal[] {
    const withdrawals = this.getWithdrawals(order);
    return withdrawals.filter(
      (withdrawal) =>
        withdrawal.destination.transferMethod ===
        PublicBlockchainCapability.transferMethod.PUBLIC_BLOCKCHAIN
    );
  }

  public createWithdrawal(request: WithdrawalRequest): Withdrawal {
    const withdrawal = this.withdrawalFromWithdrawalRequest(request);
    this.withdrawalRepository.create(withdrawal);
    return withdrawal;
  }
}
