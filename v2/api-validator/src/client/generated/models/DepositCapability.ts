/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { AssetReference } from './AssetReference';
import type { DepositAddressCreationPolicy } from './DepositAddressCreationPolicy';
import type { IbanCapability } from './IbanCapability';
import type { PublicBlockchainCapability } from './PublicBlockchainCapability';
import type { SwiftCapability } from './SwiftCapability';

/**
 * Capability to deposit to a balance asset using a specific transfer capability. `addressCreationPolicy` determines either a new deposit address can be created with `/accounts/{accountId}/transfers/deposits/addresses` or not.
 */
export type DepositCapability = {
    id: string;
    deposit: (PublicBlockchainCapability | IbanCapability | SwiftCapability);
    balanceAsset: AssetReference;
    addressCreationPolicy: DepositAddressCreationPolicy;
};

