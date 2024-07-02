import { BigNumberish } from "ethers";

import { TokenConfig } from "../utils";
import {
  MetadataConfigParams,
  SummonParams,
  assembleBaalInitActions,
  assembleLootTokenParams,
  assembleShamanParams,
  assembleShareTokenParams,
  shamanZodiacModuleConfigTX,
} from "../utils/hos";

export type Yeet24Params = {
  endTimeInSeconds: BigNumberish;
  goal: BigNumberish;
  nonFungiblePositionManager: `0x${string}`;
  poolFee: BigNumberish;
  boostRewardsPoolAddress: `0x${string}`;
  weth9: `0${string}`;
};

export const SHAMAN_NAME = "ExampleShaman";
export const SHAMAN_PERMISSIONS = "7"; // Admin + Manager + Governor

export const assembleYeet24SummonerArgs = async ({
  avatarAddress,
  daoName,
  lootConfig,
  metadataConfigParams,
  sharesConfig,
  saltNonce,
  shamanZodiacModuleAddress,
  summonParams,
  shamanInitParams,
  shamanSingleton,
}: {
  avatarAddress: string;
  daoName: string;
  lootConfig: TokenConfig;
  metadataConfigParams: MetadataConfigParams;
  sharesConfig: TokenConfig;
  saltNonce: string;
  shamanZodiacModuleAddress: string;
  summonParams: SummonParams;
  shamanInitParams: string;
  shamanSingleton: string;
}) => {
  const initializationLootTokenParams = assembleLootTokenParams({
    daoName,
    lootSingleton: lootConfig.singleton as `0x${string}`,
    tokenSymbol: lootConfig.tokenSymbol,
  });

  const initializationSharesTokenParams = assembleShareTokenParams({
    daoName,
    sharesSingleton: sharesConfig.singleton as `0x${string}`,
    tokenSymbol: sharesConfig.tokenSymbol,
  });

  const initializationShamanParams = assembleShamanParams({
    shamanSingletons: [shamanSingleton] as Array<`0x${string}`>,
    shamanInitParams: [shamanInitParams],
    shamanPermissions: [SHAMAN_PERMISSIONS],
  });

  const postInitializationActions = await assembleBaalInitActions({
    lootConfig,
    metadataConfigParams,
    sharesConfig,
    summonParams,
  });

  const yeet24ShamanEnableModule = await shamanZodiacModuleConfigTX({
    avatarAddress: avatarAddress as `0x${string}`,
    shamanZodiacModuleAddress: shamanZodiacModuleAddress as `0x${string}`,
  });

  return [
    initializationLootTokenParams,
    initializationSharesTokenParams,
    initializationShamanParams,
    [...postInitializationActions, yeet24ShamanEnableModule],
    saltNonce,
  ];
};
