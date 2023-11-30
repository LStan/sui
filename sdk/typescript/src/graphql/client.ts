// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { fromB64 } from '@mysten/bcs';
import { print } from 'graphql';
import type { DocumentNode } from 'graphql';

import { bcs } from '../bcs/index.js';
import type { PaginationArguments, SuiClientOptions } from '../client/client.js';
import { SuiClient } from '../client/client.js';
import type {
	AddressMetrics,
	AllEpochsAddressMetrics,
	CheckpointPage,
	DynamicFieldPage,
	EpochInfo,
	EpochPage,
	MoveCallMetrics,
	NetworkMetrics,
	ResolvedNameServiceNames,
	SuiMoveNormalizedModules,
} from '../client/types/chain.js';
import type { CoinBalance } from '../client/types/coins.js';
import type { Unsubscribe } from '../client/types/common.js';
import type {
	Checkpoint,
	CoinMetadata,
	CoinSupply,
	CommitteeInfo,
	DelegatedStake,
	DevInspectResults,
	DryRunTransactionBlockResponse,
	ExecutionStatus,
	MoveStruct,
	MoveValue,
	ObjectRead,
	PaginatedCoins,
	PaginatedEvents,
	PaginatedObjectsResponse,
	PaginatedTransactionResponse,
	ProtocolConfig,
	ProtocolConfigValue,
	SuiEvent,
	SuiMoveFunctionArgType,
	SuiMoveNormalizedFunction,
	SuiMoveNormalizedModule,
	SuiMoveNormalizedStruct,
	SuiObjectResponse,
	SuiSystemStateSummary,
	SuiTransactionBlockResponse,
	SuiTransactionBlockResponseOptions,
	TransactionEffects,
	ValidatorsApy,
} from '../client/types/generated.js';
import type {
	DevInspectTransactionBlockParams,
	DryRunTransactionBlockParams,
	ExecuteTransactionBlockParams,
	GetAllBalancesParams,
	GetAllCoinsParams,
	GetBalanceParams,
	GetCheckpointParams,
	GetCheckpointsParams,
	GetCoinMetadataParams,
	GetCoinsParams,
	GetCommitteeInfoParams,
	GetDynamicFieldObjectParams,
	GetDynamicFieldsParams,
	GetMoveFunctionArgTypesParams,
	GetNormalizedMoveFunctionParams,
	GetNormalizedMoveModuleParams,
	GetNormalizedMoveModulesByPackageParams,
	GetNormalizedMoveStructParams,
	GetObjectParams,
	GetOwnedObjectsParams,
	GetProtocolConfigParams,
	GetStakesByIdsParams,
	GetStakesParams,
	GetTotalSupplyParams,
	GetTransactionBlockParams,
	MultiGetObjectsParams,
	MultiGetTransactionBlocksParams,
	QueryEventsParams,
	QueryTransactionBlocksParams,
	ResolveNameServiceAddressParams,
	ResolveNameServiceNamesParams,
	SubscribeEventParams,
	SubscribeTransactionParams,
	TryGetPastObjectParams,
} from '../client/types/params.js';
import { normalizeStructTag, normalizeSuiAddress, parseStructTag } from '../utils/sui-types.js';
import type {
	QueryEventsQueryVariables,
	Rpc_Object_FieldsFragment,
	Rpc_Transaction_FieldsFragment,
	TransactionBlockKindInput,
} from './generated.js';
import {
	GetAllBalancesDocument,
	GetBalanceDocument,
	GetChainIdentifierDocument,
	GetCheckpointDocument,
	GetCoinMetadataDocument,
	GetCoinsDocument,
	GetCurrentEpochDocument,
	GetDynamicFieldObjectDocument,
	GetDynamicFieldsDocument,
	GetLatestCheckpointSequenceNumberDocument,
	GetLatestSuiSystemStateDocument,
	GetMoveFunctionArgTypesDocument,
	GetNormalizedMoveFunctionDocument,
	GetNormalizedMoveModuleDocument,
	GetNormalizedMoveModulesByPackageDocument,
	GetNormalizedMoveStructDocument,
	GetObjectDocument,
	GetOwnedObjectsDocument,
	GetProtocolConfigDocument,
	GetReferenceGasPriceDocument,
	GetStakesByIdsDocument,
	GetStakesDocument,
	GetTotalSupplyDocument,
	GetTotalTransactionBlocksDocument,
	GetTransactionBlockDocument,
	MultiGetObjectsDocument,
	MultiGetTransactionBlocksDocument,
	QueryEventsDocument,
	QueryTransactionBlocksDocument,
	ResolveNameServiceAddressDocument,
	ResolveNameServiceNamesDocument,
	TryGetPastObjectDocument,
	TypedDocumentString,
} from './generated.js';

export type GraphQLDocument<
	Result = Record<string, unknown>,
	Variables = Record<string, unknown>,
> =
	| string
	| DocumentNode
	| TypedDocumentNode<Result, Variables>
	| TypedDocumentString<Result, Variables>;

export type GraphQLQueryOptions<
	Result = Record<string, unknown>,
	Variables = Record<string, unknown>,
> = {
	query: GraphQLDocument<Result, Variables>;
	operationName?: string;
	extensions?: Record<string, unknown>;
} & (Variables extends { [key: string]: never }
	? { variables?: Variables }
	: {
			variables: Variables;
	  });

export type GraphQLQueryResult<Result = Record<string, unknown>> = {
	data?: Result;
	errors?: GraphQLResponseErrors;
	extensions?: Record<string, unknown>;
};

export type GraphQLResponseErrors = Array<{
	message: string;
	locations?: { line: number; column: number }[];
	path?: (string | number)[];
}>;

export class GraphQLSuiClient extends SuiClient {
	#graphqlURL: string;

	constructor({ graphqlURL, ...options }: SuiClientOptions & { graphqlURL: string }) {
		super(options);
		this.#graphqlURL = graphqlURL;
	}

	async graphqlQuery<Result = Record<string, unknown>, Variables = Record<string, unknown>>(
		options: GraphQLQueryOptions<Result, Variables>,
	): Promise<GraphQLQueryResult<Result>> {
		const res = await fetch(this.#graphqlURL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				query:
					typeof options.query === 'string' || options.query instanceof TypedDocumentString
						? options.query.toString()
						: print(options.query),
				variables: options.variables,
				extensions: options.extensions,
				operationName: options.operationName,
			}),
		});

		if (!res.ok) {
			throw new Error('Failed to fetch');
		}

		return res.json();
	}

	async #graphqlQuery<
		Result = Record<string, unknown>,
		Variables = Record<string, unknown>,
		Data = Result,
	>(
		options: GraphQLQueryOptions<Result, Variables>,
		getData?: (result: Result) => Data,
	): Promise<NonNullable<Data>> {
		const { data, errors } = await this.graphqlQuery(options);

		handleGraphQLErrors(errors);

		const extractedData = data && (getData ? getData(data) : data);

		if (extractedData == null) {
			throw new Error('Missing response data');
		}

		return extractedData as NonNullable<Data>;
	}

	override getRpcApiVersion(): Promise<string | undefined> {
		throw new Error('Method not implemented.');
	}

	override async getCoins(input: GetCoinsParams): Promise<PaginatedCoins> {
		const { nodes: coins, pageInfo } = await this.#graphqlQuery(
			{
				query: GetCoinsDocument,
				variables: {
					owner: input.owner,
					type: input.coinType,
					first: input.limit,
					cursor: input.cursor,
				},
			},
			(data) => data.address?.coinConnection,
		);

		return {
			data: coins.map((coin) => ({
				balance: coin.balance,
				coinObjectId: coin.asMoveObject.asObject.coinObjectId,
				coinType: normalizeStructTag(
					parseStructTag(coin.asMoveObject?.contents?.type.repr!).typeParams[0],
				),
				digest: coin.asMoveObject?.asObject?.digest!,
				previousTransaction: coin.asMoveObject?.asObject?.previousTransactionBlock?.digest!,
				version: String(coin.asMoveObject?.asObject?.version!),
			})),
			nextCursor: pageInfo.endCursor,
			hasNextPage: pageInfo.hasNextPage,
		};
	}

	override getAllCoins(input: GetAllCoinsParams): Promise<PaginatedCoins> {
		return this.getCoins({
			...input,
			coinType: null,
		});
	}
	override async getBalance(input: GetBalanceParams): Promise<CoinBalance> {
		const balance = await this.#graphqlQuery(
			{
				query: GetBalanceDocument,
				variables: {
					owner: input.owner,
					type: input.coinType,
				},
			},
			(data) => data.address?.balance,
		);

		return {
			coinType: balance.coinType?.repr!,
			coinObjectCount: balance.coinObjectCount!,
			totalBalance: balance.totalBalance,
			lockedBalance: {},
		};
	}
	override async getAllBalances(input: GetAllBalancesParams): Promise<CoinBalance[]> {
		const balances = await this.#graphqlQuery(
			{
				query: GetAllBalancesDocument,
				variables: {
					owner: input.owner,
				},
			},
			(data) => data.address?.balanceConnection?.nodes,
		);

		return balances.map((balance) => ({
			coinType: balance.coinType?.repr!,
			coinObjectCount: balance.coinObjectCount!,
			totalBalance: balance.totalBalance,
			lockedBalance: {},
		}));
	}

	override async getCoinMetadata(input: GetCoinMetadataParams): Promise<CoinMetadata | null> {
		const metadata = await this.#graphqlQuery(
			{
				query: GetCoinMetadataDocument,
				variables: {
					coinType: input.coinType,
				},
			},
			(data) => data.coinMetadata,
		);

		return {
			decimals: metadata.decimals!,
			name: metadata.name!,
			symbol: metadata.symbol!,
			description: metadata.description!,
			iconUrl: metadata.iconUrl,
			id: metadata.asMoveObject.asObject.location,
		};
	}

	override async getTotalSupply(input: GetTotalSupplyParams): Promise<CoinSupply> {
		const metadata = await this.#graphqlQuery(
			{
				query: GetTotalSupplyDocument,
				variables: {
					coinType: input.coinType,
				},
			},
			(data) => data.coinMetadata,
		);

		return {
			value: (BigInt(metadata.supply!) * 10n ** BigInt(metadata.decimals!)).toString(),
		};
	}

	override async getMoveFunctionArgTypes(
		input: GetMoveFunctionArgTypesParams,
	): Promise<SuiMoveFunctionArgType[]> {
		const moveModule = await this.#graphqlQuery(
			{
				query: GetMoveFunctionArgTypesDocument,
				variables: {
					module: input.module,
					packageId: input.package,
					function: input.function,
				},
			},
			(data) => data.object?.asMovePackage?.module,
		);

		void moveModule;
		throw new Error('Method not implemented.');
	}

	override async getNormalizedMoveFunction(
		input: GetNormalizedMoveFunctionParams,
	): Promise<SuiMoveNormalizedFunction> {
		const moveModule = await this.#graphqlQuery(
			{
				query: GetNormalizedMoveFunctionDocument,
				variables: {
					module: input.module,
					packageId: input.package,
					function: input.function,
				},
			},
			(data) => data.object?.asMovePackage?.module,
		);

		void moveModule;
		throw new Error('Method not implemented.');
	}

	override async getNormalizedMoveModulesByPackage(
		input: GetNormalizedMoveModulesByPackageParams,
	): Promise<SuiMoveNormalizedModules> {
		const movePackage = await this.#graphqlQuery(
			{
				query: GetNormalizedMoveModulesByPackageDocument,
				variables: {
					packageId: input.package,
				},
			},
			(data) => data.object?.asMovePackage,
		);

		void movePackage;
		throw new Error('Method not implemented.');
	}

	override async getNormalizedMoveModule(
		input: GetNormalizedMoveModuleParams,
	): Promise<SuiMoveNormalizedModule> {
		const moveModule = await this.#graphqlQuery(
			{
				query: GetNormalizedMoveModuleDocument,
				variables: {
					module: input.module,
					packageId: input.package,
				},
			},
			(data) => data.object?.asMovePackage?.module,
		);

		void moveModule;
		throw new Error('Method not implemented.');
	}

	override async getNormalizedMoveStruct(
		input: GetNormalizedMoveStructParams,
	): Promise<SuiMoveNormalizedStruct> {
		const moveModule = await this.#graphqlQuery(
			{
				query: GetNormalizedMoveStructDocument,
				variables: {
					module: input.module,
					packageId: input.package,
				},
			},
			(data) => data.object?.asMovePackage?.module,
		);

		void moveModule;
		throw new Error('Method not implemented.');
	}

	override async getOwnedObjects(input: GetOwnedObjectsParams): Promise<PaginatedObjectsResponse> {
		const { nodes: objects, pageInfo } = await this.#graphqlQuery(
			{
				query: GetOwnedObjectsDocument,
				variables: {
					owner: input.owner,
					limit: input.limit,
					cursor: input.cursor,
					showBcs: input.options?.showBcs,
					showContent: input.options?.showContent,
					showOwner: input.options?.showOwner,
					showPreviousTransaction: input.options?.showPreviousTransaction,
					showStorageRebate: input.options?.showStorageRebate,
					showType: input.options?.showType,
				},
			},
			(data) => data.address?.objectConnection,
		);

		return {
			hasNextPage: pageInfo.hasNextPage,
			nextCursor: pageInfo.endCursor,
			data: objects.map((object) => ({
				data: mapGraphQLObjectToRpcObject(object, input.options ?? {}),
			})),
		};
	}

	override async getObject(input: GetObjectParams): Promise<SuiObjectResponse> {
		const object = await this.#graphqlQuery(
			{
				query: GetObjectDocument,
				variables: {
					id: input.id,
					showBcs: input.options?.showBcs,
					showContent: input.options?.showContent,
					showOwner: input.options?.showOwner,
					showPreviousTransaction: input.options?.showPreviousTransaction,
					showStorageRebate: input.options?.showStorageRebate,
					showType: input.options?.showType,
				},
			},
			(data) => data.object,
		);

		return {
			data: mapGraphQLObjectToRpcObject(object, input.options ?? {}),
		};
	}

	override async tryGetPastObject(input: TryGetPastObjectParams): Promise<ObjectRead> {
		const object = await this.#graphqlQuery(
			{
				query: TryGetPastObjectDocument,
				variables: {
					id: input.id,
					version: input.version,
					showBcs: input.options?.showBcs,
					showContent: input.options?.showContent,
					showOwner: input.options?.showOwner,
					showPreviousTransaction: input.options?.showPreviousTransaction,
					showStorageRebate: input.options?.showStorageRebate,
					showType: input.options?.showType,
				},
			},
			(data) => data.object,
		);

		// TODO: needs custom error handling

		return {
			status: 'VersionFound',
			details: mapGraphQLObjectToRpcObject(object, input.options ?? {}),
		};
	}

	override async multiGetObjects(input: MultiGetObjectsParams): Promise<SuiObjectResponse[]> {
		const objects = await this.#graphqlQuery(
			{
				query: MultiGetObjectsDocument,
				variables: {
					ids: input.ids,
					showBcs: input.options?.showBcs,
					showContent: input.options?.showContent,
					showOwner: input.options?.showOwner,
					showPreviousTransaction: input.options?.showPreviousTransaction,
					showStorageRebate: input.options?.showStorageRebate,
					showType: input.options?.showType,
					limit: input.ids.length,
				},
			},
			(data) => data.objectConnection?.nodes,
		);

		return objects.map((object) => ({
			data: mapGraphQLObjectToRpcObject(object, input.options ?? {}),
		}));
	}

	override async queryTransactionBlocks(
		input: QueryTransactionBlocksParams,
	): Promise<PaginatedTransactionResponse> {
		const limit = input.limit ?? 20;
		const pagination =
			input.order === 'descending'
				? {
						last: limit,
						before: input.cursor,
				  }
				: {
						first: limit,
						after: input.cursor,
				  };

		const { nodes: transactionBlocks, pageInfo } = await this.#graphqlQuery(
			{
				query: QueryTransactionBlocksDocument,
				variables: {
					...pagination,
					showBalanceChanges: input.options?.showBalanceChanges,
					showEffects: input.options?.showEffects,
					showObjectChanges: input.options?.showObjectChanges,
					showRawInput: input.options?.showRawInput,
					showInput: input.options?.showInput,
					filter: input.filter
						? {
								atCheckpoint:
									'Checkpoint' in input.filter
										? Number.parseInt(input.filter.Checkpoint)
										: undefined,
								function:
									'MoveFunction' in input.filter
										? `${input.filter.MoveFunction.package}::${input.filter.MoveFunction.module}::${input.filter.MoveFunction.function}`
										: undefined,
								inputObject: 'InputObject' in input.filter ? input.filter.InputObject : undefined,
								changedObject:
									'ChangedObject' in input.filter ? input.filter.ChangedObject : undefined,
								sentAddress: 'FromAddress' in input.filter ? input.filter.FromAddress : undefined,
								recvAddress: 'ToAddress' in input.filter ? input.filter.ToAddress : undefined,
								// FromOrToAddress
								// FromAndToAddress
								kind:
									'TransactionKind' in input.filter
										? (input.filter.TransactionKind as TransactionBlockKindInput) // TODO: ensure this is formatted correctly
										: undefined,
								// TransactionKindIn
						  }
						: {},
				},
			},
			(data) => data.transactionBlockConnection,
		);

		return {
			hasNextPage: pagination.last ? pageInfo.hasPreviousPage : pageInfo.hasNextPage,
			nextCursor: pagination.last ? pageInfo.endCursor : pageInfo.startCursor,
			data: transactionBlocks.map((transactionBlock) =>
				mapGraphQLTransactionBlockToRpcTransactionBlock(transactionBlock, input.options),
			),
		};
	}

	override async getTransactionBlock(
		input: GetTransactionBlockParams,
	): Promise<SuiTransactionBlockResponse> {
		const transactionBlock = await this.#graphqlQuery(
			{
				query: GetTransactionBlockDocument,
				variables: {
					digest: input.digest,
					showBalanceChanges: input.options?.showBalanceChanges,
					showEffects: input.options?.showEffects,
					showObjectChanges: input.options?.showObjectChanges,
					showRawInput: input.options?.showRawInput,
					showInput: input.options?.showInput,
				},
			},
			(data) => data.transactionBlock,
		);

		return mapGraphQLTransactionBlockToRpcTransactionBlock(transactionBlock, input.options);
	}

	override async multiGetTransactionBlocks(
		input: MultiGetTransactionBlocksParams,
	): Promise<SuiTransactionBlockResponse[]> {
		const transactionBlocks = await this.#graphqlQuery(
			{
				query: MultiGetTransactionBlocksDocument,
				variables: {
					digests: input.digests,
					showBalanceChanges: input.options?.showBalanceChanges,
					showEffects: input.options?.showEffects,
					showObjectChanges: input.options?.showObjectChanges,
					showRawInput: input.options?.showRawInput,
					showInput: input.options?.showInput,
					limit: input.digests.length,
				},
			},
			(data) => data.transactionBlockConnection?.nodes,
		);

		return transactionBlocks.map((transactionBlock) =>
			mapGraphQLTransactionBlockToRpcTransactionBlock(transactionBlock, input.options),
		);
	}

	override async getTotalTransactionBlocks(): Promise<bigint> {
		return this.#graphqlQuery(
			{
				query: GetTotalTransactionBlocksDocument,
			},
			(data) => BigInt(data.checkpoint?.networkTotalTransactions!),
		);
	}

	override async getReferenceGasPrice(): Promise<bigint> {
		const epoch = await this.#graphqlQuery(
			{
				query: GetReferenceGasPriceDocument,
				variables: {},
			},
			(data) => data.epoch,
		);

		return BigInt(epoch.referenceGasPrice);
	}

	override async getStakes(input: GetStakesParams): Promise<DelegatedStake[]> {
		const stakes = await this.#graphqlQuery(
			{
				query: GetStakesDocument,
				variables: {
					owner: input.owner,
				},
			},
			(data) => data.address?.stakedSuiConnection?.nodes,
		);

		// TODO: need to figure out mapping to groups
		void stakes;
		throw new Error('Method not implemented.');
	}

	override async getStakesByIds(input: GetStakesByIdsParams): Promise<DelegatedStake[]> {
		const stakes = await this.#graphqlQuery(
			{
				query: GetStakesByIdsDocument,
				variables: {
					ids: input.stakedSuiIds,
				},
			},
			(data) =>
				data.objectConnection?.nodes
					.map((node) => node?.asMoveObject?.asStakedSui!)
					.filter(Boolean),
		);

		// TODO: need to extract some details from contents
		void stakes;
		throw new Error('Method not implemented.');
	}

	override async getLatestSuiSystemState(): Promise<SuiSystemStateSummary> {
		const systemState = await this.#graphqlQuery(
			{
				query: GetLatestSuiSystemStateDocument,
			},
			(data) => data.latestSuiSystemState,
		);

		return {
			activeValidators: systemState.validatorSet?.activeValidators?.map((validator) => ({
				commissionRate: validator.commissionRate?.toString()!,
				description: validator.description!,
				exchangeRatesId: validator.exchangeRates?.asObject?.location!,
				exchangeRatesSize: 'TODO',
				gasPrice: validator.gasPrice,
				imageUrl: validator.imageUrl!,
				name: validator.name!,
				netAddress: validator.credentials?.netAddress!,
				networkPubkeyBytes: validator.credentials?.networkPubKey!,
				nextEpochCommissionRate: validator.nextEpochCommissionRate?.toString()!,
				nextEpochGasPrice: validator.nextEpochGasPrice,
				nextEpochNetAddress: validator.nextEpochCredentials?.netAddress,
				nextEpochNetworkPubkeyBytes: validator.nextEpochCredentials?.networkPubKey,
				nextEpochP2pAddress: validator.nextEpochCredentials?.p2PAddress,
				nextEpochPrimaryAddress: validator.nextEpochCredentials?.primaryAddress,
				nextEpochProofOfPossession: validator.nextEpochCredentials?.proofOfPossession,
				nextEpochProtocolPubkeyBytes: validator.nextEpochCredentials?.protocolPubKey,
				nextEpochStake: validator.nextEpochStake!,
				nextEpochWorkerAddress: validator.nextEpochCredentials?.workerAddress,
				nextEpochWorkerPubkeyBytes: validator.nextEpochCredentials?.workerPubKey,
				operationCapId: validator.operationCap?.asObject?.location!,
				p2pAddress: validator.credentials?.p2PAddress!,
				pendingTotalSuiWithdraw: validator.pendingTotalSuiWithdraw,
				pendingPoolTokenWithdraw: validator.pendingPoolTokenWithdraw,
				poolTokenBalance: validator.poolTokenBalance,
				pendingStake: validator.pendingStake,
				primaryAddress: validator.credentials?.primaryAddress!,
				projectUrl: validator.projectUrl!,
				proofOfPossessionBytes: validator.credentials?.proofOfPossession,
				protocolPubkeyBytes: validator.credentials?.protocolPubKey,
				rewardsPool: validator.rewardsPool,
				stakingPoolId: 'TODO',
				stakingPoolSuiBalance: validator.stakingPoolSuiBalance,
				suiAddress: validator.address.location,
				votingPower: validator.votingPower?.toString()!,
				workerAddress: validator.credentials?.workerAddress!,
				workerPubkeyBytes: validator.credentials?.workerPubKey,
			}))!,
			atRiskValidators: [], // TODO;
			epoch: String(systemState.epoch?.epochId),
			epochDurationMs: String(
				new Date(systemState.epoch?.endTimestamp).getTime() -
					new Date(systemState.epoch?.startTimestamp).getTime(),
			),
			epochStartTimestampMs: String(new Date(systemState.epoch?.startTimestamp).getTime()),
			inactivePoolsId: 'TODO',
			inactivePoolsSize: String(systemState.validatorSet?.inactivePoolsSize),
			maxValidatorCount: String(systemState.systemParameters?.maxValidatorCount),
			minValidatorJoiningStake: String(systemState.systemParameters?.minValidatorJoiningStake),
			pendingActiveValidatorsId: 'TODO',
			pendingActiveValidatorsSize: String(systemState.validatorSet?.pendingActiveValidatorsSize),
			pendingRemovals: [], // TODO;
			protocolVersion: String(systemState.protocolConfigs?.protocolVersion),
			referenceGasPrice: String(systemState.referenceGasPrice),
			safeMode: systemState.safeMode?.enabled!,
			safeModeComputationRewards: String(systemState.safeMode?.gasSummary?.computationCost),
			safeModeNonRefundableStorageFee: String(
				systemState.safeMode?.gasSummary?.nonRefundableStorageFee,
			),
			safeModeStorageRebates: String(systemState.safeMode?.gasSummary?.storageRebate),
			safeModeStorageRewards: String(systemState.safeMode?.gasSummary?.storageCost),
			stakeSubsidyBalance: String(systemState.stakeSubsidy?.balance),
			stakeSubsidyCurrentDistributionAmount: String(
				systemState.stakeSubsidy?.currentDistributionAmount,
			),
			stakeSubsidyDecreaseRate: systemState.stakeSubsidy?.decreaseRate!,
			stakeSubsidyDistributionCounter: String(systemState.stakeSubsidy?.distributionCounter),
			stakeSubsidyPeriodLength: String(systemState.stakeSubsidy?.periodLength),
			stakeSubsidyStartEpoch: 'TODO',
			stakingPoolMappingsId: 'TODO',
			stakingPoolMappingsSize: 'TODO',
			storageFundNonRefundableBalance: String(systemState.storageFund?.nonRefundableBalance),
			storageFundTotalObjectStorageRebates: String(
				systemState.storageFund?.totalObjectStorageRebates,
			),
			systemStateVersion: String(systemState.systemStateVersion),
			totalStake: 'TODO',
			validatorCandidatesId: 'TODO',
			validatorCandidatesSize: 'TODO',
			validatorLowStakeGracePeriod: systemState.systemParameters?.validatorLowStakeGracePeriod,
			validatorLowStakeThreshold: systemState.systemParameters?.validatorLowStakeThreshold,
			validatorReportRecords: [], // TODO;
			validatorVeryLowStakeThreshold: systemState.systemParameters?.validatorVeryLowStakeThreshold,
		};
	}

	override async queryEvents(input: QueryEventsParams): Promise<PaginatedEvents> {
		const pagination: Partial<QueryEventsQueryVariables> =
			input.order === 'ascending'
				? { first: input.limit, after: input.cursor as never }
				: { last: input.limit, before: input.cursor as never };

		const filter: QueryEventsQueryVariables['filter'] = {
			sender: 'Sender' in input.query ? input.query.Sender : undefined,
			transactionDigest: 'Transaction' in input.query ? input.query.Transaction : undefined,
			emittingPackage: 'Package' in input.query ? input.query.Package : undefined,
			eventType: 'MoveEventType' in input.query ? input.query.MoveEventType : undefined,
		};

		if ('MoveModule' in input.query) {
			filter.emittingPackage = input.query.MoveModule.package;
			filter.emittingModule = input.query.MoveModule.module;
		}

		if ('MoveEventModule' in input.query) {
			filter.eventPackage = input.query.MoveEventModule.package;
			filter.eventModule = input.query.MoveEventModule.module;
		}

		const { nodes: events, pageInfo } = await this.#graphqlQuery(
			{
				query: QueryEventsDocument,
				variables: {
					...pagination,
					filter,
				},
			},
			(data) => data.eventConnection,
		);

		return {
			hasNextPage: pagination.last ? pageInfo.hasPreviousPage : pageInfo.hasNextPage,
			nextCursor: (pagination.last ? pageInfo.endCursor : pageInfo.startCursor) as never,
			data: events.map((event) => ({
				bcs: event.bcs,
				id: 'TODO' as never, // TODO: turn id into an object
				packageId: event.sendingModuleId?.package.asObject?.location!,
				parsedJson: event.json ? JSON.parse(event.json) : undefined,
				sender: event.senders?.[0]?.location,
				timestampMs: new Date(event.timestamp).getTime().toString(),
				transactionModule: 'TODO',
				type: toShortTypeString(event.eventType?.repr)!,
			})),
		};
	}

	override async devInspectTransactionBlock(
		input: DevInspectTransactionBlockParams,
	): Promise<DevInspectResults> {
		void input;
		throw new Error('Method not implemented.');
	}

	override async getDynamicFields(input: GetDynamicFieldsParams): Promise<DynamicFieldPage> {
		const { nodes: fields, pageInfo } = await this.#graphqlQuery(
			{
				query: GetDynamicFieldsDocument,
				variables: {
					parentId: input.parentId,
					first: input.limit,
					cursor: input.cursor,
				},
			},
			(data) => data.object?.dynamicFieldConnection,
		);

		return {
			data: fields.map((field) => ({
				bcsName: field.name?.bcs,
				digest: (field.value?.__typename === 'MoveObject'
					? field.value.asObject.digest
					: undefined)!,
				name: {
					type: toShortTypeString(field.name?.type.repr)!,
					value: field.name?.json.bytes,
				},
				objectId:
					field.value?.__typename === 'MoveObject' ? field.value.asObject.location : undefined,
				objectType: (field.value?.__typename === 'MoveObject'
					? field.value.contents?.type.repr
					: undefined)!,
				type: field.value?.__typename === 'MoveObject' ? 'DynamicObject' : 'DynamicField',
				version: (field.value?.__typename === 'MoveObject'
					? field.value.asObject.version
					: undefined) as unknown as string, // RPC types are wrong here,
			})),
			nextCursor: pageInfo.endCursor ?? null,
			hasNextPage: pageInfo.hasNextPage,
		};
	}

	override async getDynamicFieldObject(
		input: GetDynamicFieldObjectParams,
	): Promise<SuiObjectResponse> {
		const field = await this.#graphqlQuery(
			{
				query: GetDynamicFieldObjectDocument,
				variables: {
					parentId: input.parentId,
					name: {
						type: input.name.type,
						bcs: input.name.value,
					},
				},
			},
			(data) => {
				console.log(data);

				return data.object?.dynamicObjectField;
			},
		);

		if (field.value?.__typename !== 'MoveObject') {
			throw new Error('Expected a MoveObject');
		}

		return {
			data: {
				content: field.value.contents?.json, // TODO: requires formatting
				digest: field.value.asObject.digest,
				display: {}, // TODO
				objectId: field.value.asObject.location,
				type: toShortTypeString(field.value.contents?.type.repr),
				version: field.value.asObject.version as unknown as string, // RPC types are wrong here
			},
		};
	}
	override async subscribeEvent(
		input: SubscribeEventParams & { onMessage: (event: SuiEvent) => void },
	): Promise<Unsubscribe> {
		void input;
		throw new Error('Method not implemented.');
	}
	override async subscribeTransaction(
		input: SubscribeTransactionParams & { onMessage: (event: TransactionEffects) => void },
	): Promise<Unsubscribe> {
		void input;
		throw new Error('Method not implemented.');
	}

	override async executeTransactionBlock(
		input: ExecuteTransactionBlockParams,
	): Promise<SuiTransactionBlockResponse> {
		void input;
		throw new Error('Method not implemented.');
	}

	override async dryRunTransactionBlock(
		input: DryRunTransactionBlockParams,
	): Promise<DryRunTransactionBlockResponse> {
		void input;
		throw new Error('Method not implemented.');
	}

	override async call<T = unknown>(method: string, params: unknown[]): Promise<T> {
		void method;
		void params;
		throw new Error('Method not implemented.');
	}

	override async getLatestCheckpointSequenceNumber(): Promise<string> {
		const sequenceNumber = await this.#graphqlQuery(
			{
				query: GetLatestCheckpointSequenceNumberDocument,
			},
			(data) => data.checkpoint?.sequenceNumber,
		);

		return sequenceNumber.toString();
	}

	override async getCheckpoint(input: GetCheckpointParams): Promise<Checkpoint> {
		const checkpoint = await this.#graphqlQuery(
			{
				query: GetCheckpointDocument,
				variables: {
					id: {
						// TODO handle differentiating digest and sequence number
						digest: input.id,
					},
				},
			},
			(data) => data.checkpoint,
		);

		return {
			checkpointCommitments: [], // TODO
			digest: checkpoint.digest,
			endOfEpochData: checkpoint.endOfEpoch && {
				epochCommitments: [], // TODO
				nextEpochCommittee: [], // TODO
				nextEpochProtocolVersion: String(checkpoint.endOfEpoch.nextProtocolVersion),
			},
			epoch: String(checkpoint.epoch?.epochId),
			epochRollingGasCostSummary: {
				computationCost: checkpoint.rollingGasSummary?.computationCost,
				nonRefundableStorageFee: checkpoint.rollingGasSummary?.nonRefundableStorageFee,
				storageCost: checkpoint.rollingGasSummary?.storageCost,
				storageRebate: checkpoint.rollingGasSummary?.storageRebate,
			},
			networkTotalTransactions: String(checkpoint.networkTotalTransactions),
			previousDigest: checkpoint.previousCheckpointDigest,
			sequenceNumber: String(checkpoint.sequenceNumber),
			timestampMs: new Date(checkpoint.timestamp).getTime().toString(),
			transactions:
				checkpoint.transactionBlockConnection?.nodes.map(
					(transactionBlock) => transactionBlock.digest!,
				) ?? [],
			validatorSignature: checkpoint.validatorSignature,
		};
	}
	override async getCheckpoints(
		input: PaginationArguments<string | null> & GetCheckpointsParams,
	): Promise<CheckpointPage> {
		void input;
		throw new Error('Method not implemented.');
	}

	override async getCommitteeInfo(
		input?: GetCommitteeInfoParams | undefined,
	): Promise<CommitteeInfo> {
		void input;
		throw new Error('Method not implemented.');
	}

	override async getNetworkMetrics(): Promise<NetworkMetrics> {
		throw new Error('Method not implemented.');
	}

	override async getMoveCallMetrics(): Promise<MoveCallMetrics> {
		throw new Error('Method not implemented.');
	}

	override async getAddressMetrics(): Promise<AddressMetrics> {
		throw new Error('Method not implemented.');
	}

	override async getAllEpochAddressMetrics(
		input?: { descendingOrder?: boolean | undefined } | undefined,
	): Promise<AllEpochsAddressMetrics> {
		void input;
		throw new Error('Method not implemented.');
	}

	override async getEpochs(
		input?:
			| ({ descendingOrder?: boolean | undefined } & PaginationArguments<string | null>)
			| undefined,
	): Promise<EpochPage> {
		void input;
		throw new Error('Method not implemented.');
	}

	override async getCurrentEpoch(): Promise<EpochInfo> {
		const epoch = await this.#graphqlQuery(
			{
				query: GetCurrentEpochDocument,
			},
			(data) => data.epoch,
		);

		return {
			epoch: String(epoch.epochId),
			validators: [], // TODO,
			epochTotalTransactions: 'TODO',
			firstCheckpointId: epoch.firstCheckpoint?.nodes[0]?.digest!,
			endOfEpochInfo: {} as never, // TODO,
			referenceGasPrice: epoch.referenceGasPrice,
			epochStartTimestamp: new Date(epoch.startTimestamp).getTime().toString(),
		};
	}

	override async getValidatorsApy(): Promise<ValidatorsApy> {
		throw new Error('Method not implemented.');
	}

	override async getChainIdentifier(): Promise<string> {
		const identifier = await this.#graphqlQuery(
			{
				query: GetChainIdentifierDocument,
			},
			(data) => data.chainIdentifier,
		);

		return identifier;
	}

	override async getProtocolConfig(
		input?: GetProtocolConfigParams | undefined,
	): Promise<ProtocolConfig> {
		const protocolConfig = await this.#graphqlQuery(
			{
				query: GetProtocolConfigDocument,
				variables: {
					protocolVersion: input?.version ? Number.parseInt(input.version) : undefined,
				},
			},
			(data) => data.protocolConfig,
		);

		const featureFlags: Record<string, boolean> = {};
		const attributes: Record<string, ProtocolConfigValue | null> = {};

		for (const { key, value } of protocolConfig.configs) {
			attributes[key] = {
				// TODO: can't infer types correctly here
				u64: value,
			};
		}

		for (const { key, value } of protocolConfig.featureFlags) {
			featureFlags[key] = value;
		}

		return {
			maxSupportedProtocolVersion: 'TODO',
			minSupportedProtocolVersion: 'TODO',
			protocolVersion: String(protocolConfig.protocolVersion),
			attributes,
			featureFlags,
		};
	}

	override async resolveNameServiceAddress(
		input: ResolveNameServiceAddressParams,
	): Promise<string | null> {
		const address = await this.#graphqlQuery(
			{
				query: ResolveNameServiceAddressDocument,
				variables: {
					name: input.name,
				},
			},
			(data) => data.resolveNameServiceAddress?.location,
		);

		return address;
	}

	override async resolveNameServiceNames(
		input: ResolveNameServiceNamesParams,
	): Promise<ResolvedNameServiceNames> {
		const name = await this.#graphqlQuery(
			{
				query: ResolveNameServiceNamesDocument,
				variables: {
					address: input.address,
				},
			},
			(data) => data.address?.defaultNameServiceName,
		);

		// TODO currently only defaultNameServiceName is supported
		return {
			hasNextPage: false,
			nextCursor: null,
			data: [name],
		};
	}
}

function handleGraphQLErrors(errors: GraphQLResponseErrors | undefined): void {
	if (!errors || errors.length === 0) return;

	const errorInstances = errors.map((error) => new GraphQLResponseError(error));

	if (errorInstances.length === 1) {
		throw errorInstances[0];
	}

	throw new AggregateError(errorInstances);
}

class GraphQLResponseError extends Error {
	locations?: Array<{ line: number; column: number }>;

	constructor(error: GraphQLResponseErrors[0]) {
		super(error.message);
		this.locations = error.locations;
	}
}

function mapGraphQLObjectToRpcObject(
	object: Rpc_Object_FieldsFragment,
	options: { showBcs?: boolean | null } = {},
): NonNullable<SuiObjectResponse['data']> {
	return {
		bcs: options?.showBcs
			? {
					dataType: 'moveObject' as const,
					bcsBytes: object.asMoveObject?.contents?.bcs,
					hasPublicTransfer: object.asMoveObject?.hasPublicTransfer!,
					version: object.version as unknown as string, // RPC type is wrong here
					type: toShortTypeString(object.asMoveObject?.contents?.type.repr!),
			  }
			: undefined,
		content: {
			dataType: 'moveObject' as const,
			fields: moveDataToRpcContent(
				object.asMoveObject?.contents?.data!,
				object.asMoveObject?.contents?.type.layout!,
			) as MoveStruct,
			hasPublicTransfer: object.asMoveObject?.hasPublicTransfer!,
			type: toShortTypeString(object.asMoveObject?.contents?.type.repr!),
		},
		digest: object.digest,
		// display: {}, // Not implemented yet
		objectId: object.objectId,
		owner: object.owner?.asObject
			? {
					ObjectOwner: object.owner.asObject.location,
			  }
			: {
					AddressOwner: object.owner?.asAddress?.location,
			  },
		previousTransaction: object.previousTransactionBlock?.digest,
		storageRebate: object.storageRebate,
		type: toShortTypeString(object.asMoveObject?.contents?.type.repr!),
		version: String(object.version),
	};
}

function mapGraphQLTransactionBlockToRpcTransactionBlock(
	transactionBlock: Rpc_Transaction_FieldsFragment,
	options?: SuiTransactionBlockResponseOptions | null,
): SuiTransactionBlockResponse {
	return {
		balanceChanges: transactionBlock.effects?.balanceChanges?.map((balanceChange) => ({
			amount: balanceChange?.amount,
			coinType: toShortTypeString(balanceChange?.coinType?.repr),
			owner: balanceChange?.owner?.asObject
				? { ObjectOwner: balanceChange?.owner?.asObject.location }
				: {
						AddressOwner: balanceChange?.owner?.asAddress?.location,
				  },
		})),
		checkpoint: transactionBlock.effects?.checkpoint?.sequenceNumber.toString(),
		timestampMs: new Date(transactionBlock.effects?.timestamp).getTime().toString(),
		// confirmedLocalExecution: TODO
		digest: transactionBlock.digest,
		effects: options?.showEffects
			? {
					created: transactionBlock.effects?.objectChanges
						?.filter((change) => change?.idCreated === true)
						.map((change) => ({
							owner: change?.outputState?.owner?.asObject
								? {
										ObjectOwner: change?.outputState?.owner?.asObject.location,
								  }
								: {
										AddressOwner: change?.outputState?.owner?.asAddress?.location,
								  },
							reference: {
								digest: change?.outputState?.digest!,
								version: change?.outputState?.version?.toString()!,
								objectId: change?.outputState?.location,
							},
						})),
					deleted: transactionBlock.effects?.objectChanges
						?.filter((change) => change?.idDeleted === true)
						.map((change) => ({
							digest: change?.inputState?.digest!,
							version: String(change?.inputState?.version),
							objectId: change?.inputState?.location,
						})),
					dependencies: transactionBlock.effects?.dependencies?.map((dep) => dep?.digest!),
					eventsDigest: transactionBlock.digest, // TODO check this is the correct digest
					executedEpoch: String(transactionBlock.effects?.executedEpoch?.epochId),
					gasObject: {
						owner: transactionBlock.effects?.gasEffects?.gasObject?.owner?.asObject
							? {
									ObjectOwner:
										transactionBlock.effects?.gasEffects?.gasObject?.owner?.asObject.location,
							  }
							: {
									AddressOwner:
										transactionBlock.effects?.gasEffects?.gasObject?.owner?.asAddress?.location,
							  },
						reference: {
							digest: transactionBlock.effects?.gasEffects?.gasObject?.digest!,
							version: transactionBlock.effects?.gasEffects?.gasObject?.version.toString()!,
							objectId: transactionBlock.effects?.gasEffects?.gasObject?.location,
						},
					},
					gasUsed: {
						computationCost: transactionBlock.effects?.gasEffects?.gasSummary?.computationCost,
						nonRefundableStorageFee:
							transactionBlock.effects?.gasEffects?.gasSummary?.nonRefundableStorageFee,
						storageCost: transactionBlock.effects?.gasEffects?.gasSummary?.storageCost,
						storageRebate: transactionBlock.effects?.gasEffects?.gasSummary?.storageRebate,
					},
					messageVersion: 'v1' as const,
					modifiedAtVersions: transactionBlock.effects?.objectChanges?.map((change) => ({
						objectId: change?.inputState?.location,
						sequenceNumber: String(change?.inputState?.version),
					})),
					mutated: transactionBlock.effects?.objectChanges
						?.filter((change) => !change?.idCreated && !change?.idDeleted)
						?.map((change) => ({
							owner: change?.outputState?.owner?.asObject
								? { ObjectOwner: change?.outputState?.owner?.asObject.location }
								: {
										AddressOwner: change?.outputState?.owner?.asAddress?.location,
								  },
							reference: {
								digest: change?.outputState?.digest!,
								version: String(change?.outputState?.version),
								objectId: change?.outputState?.location,
							},
						})),

					sharedObjects: [], // TODO
					status: { status: transactionBlock.effects?.status?.toLowerCase() } as ExecutionStatus,
					transactionDigest: transactionBlock.digest,
					unwrapped: [], // TODO
					unwrappedThenDeleted: [], // TODO
					wrapped: [], // TODO
			  }
			: undefined,
		errors: [], // TODO
		events: options?.showEvents ? [] : undefined, // TODO
		rawTransaction: options?.showRawInput ? transactionBlock.rawTransaction : undefined,
		transaction: options?.showInput &&
			transactionBlock.rawTransaction && {
				data: bcs.SenderSignedData.parse(fromB64(transactionBlock.rawTransaction))[0].intentMessage
					.value.V1,
			},

		objectChanges: options?.showObjectChanges
			? transactionBlock.effects?.objectChanges?.map((change) =>
					change?.idDeleted
						? {
								digest: change?.inputState?.digest!,
								objectId: change?.inputState?.location,
								owner: change?.inputState?.owner?.asObject
									? { ObjectOwner: change?.inputState?.owner?.asObject.location }
									: { AddressOwner: change?.inputState?.owner?.asAddress?.location },
								objectType: toShortTypeString(
									change?.inputState?.asMoveObject?.contents?.type.repr,
								),
								sender: transactionBlock.sender?.location!,
								type: 'deleted',
								version: change?.inputState?.version.toString()!,
						  }
						: {
								digest: change?.outputState?.digest!,
								objectId: change?.outputState?.location,
								owner: change?.outputState?.owner?.asObject
									? { ObjectOwner: change?.outputState?.owner?.asObject.location }
									: { AddressOwner: change?.outputState?.owner?.asAddress?.location },
								objectType: toShortTypeString(
									change?.outputState?.asMoveObject?.contents?.type.repr,
								),
								previousVersion: change?.inputState?.version.toString()!,
								sender: transactionBlock.sender?.location,
								type: change?.idCreated ? 'created' : 'mutated',
								version: change?.outputState?.version.toString()!,
						  },
			  )
			: undefined,
	};
}

type MoveData =
	| { Address: number[] }
	| { UID: number[] }
	| { Bool: boolean }
	| { Number: string }
	| { String: string }
	| { Vector: MoveData[] }
	| { Option: MoveData | null }
	| { Struct: [{ name: string; value: MoveData }] };

type MoveTypeLayout =
	| 'address'
	| 'bool'
	| 'u8'
	| 'u16'
	| 'u32'
	| 'u64'
	| 'u128'
	| 'u256'
	| { vector: MoveTypeLayout }
	| {
			struct: { name: string; layout: MoveTypeLayout }[];
	  };

function moveDataToRpcContent(data: MoveData, layout: MoveTypeLayout): MoveValue {
	if ('Address' in data) {
		return normalizeSuiAddress(
			data.Address.map((byte) => byte.toString(16).padStart(2, '0')).join(''),
		);
	}

	if ('UID' in data) {
		return {
			id: normalizeSuiAddress(data.UID.map((byte) => byte.toString(16).padStart(2, '0')).join('')),
		};
	}

	if ('Bool' in data) {
		return data.Bool;
	}

	if ('Number' in data) {
		return layout === 'u64' || layout === 'u128' || layout === 'u256'
			? String(data.Number)
			: Number.parseInt(data.Number, 10);
	}

	if ('String' in data) {
		return data.String;
	}

	if ('Vector' in data) {
		if (typeof layout !== 'object' || !('vector' in layout)) {
			throw new Error(`Invalid layout for data: ${JSON.stringify(data)}}`);
		}
		const itemLayout = layout.vector;
		return data.Vector.map((item) => moveDataToRpcContent(item, itemLayout));
	}

	if ('Option' in data) {
		return data.Option && moveDataToRpcContent(data.Option, layout);
	}

	if ('Struct' in data) {
		const result: MoveStruct = {};

		if (typeof layout !== 'object' || !('struct' in layout)) {
			throw new Error(`Invalid layout for data: ${JSON.stringify(data)}}`);
		}

		data.Struct.forEach((item, index) => {
			const { name, layout: itemLayout } = layout.struct[index];
			result[name] = moveDataToRpcContent(item.value, itemLayout);
		});

		return result;
	}

	throw new Error('Invalid move data');
}

function toShortTypeString<T extends string | null | undefined>(type?: T): T {
	return type?.replace(/0x0+/g, '0x') as T;
}
