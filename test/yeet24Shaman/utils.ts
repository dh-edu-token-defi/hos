import { ethers } from "hardhat";
import { BigNumberish } from "ethers";
import { TokenConfig, YEETER_SHAMAN_PERMISSIONS, YeeterParams, assembleYeeterShamanParams, encodeValues } from "../utils";
import { MetadataConfigParams, SummonParams, assembleBaalInitActions, assembleLootTokenParams, assembleShamanParams, assembleShareTokenParams, shamanZodiacModuleConfigTX } from "../utils/hos";
import { Yeet24HOS } from "../../types";

export type Yeet24Params = {
  endTimeInSeconds: BigNumberish;
  goal: BigNumberish;
  nonFungiblePositionManager: `0x${string}`;
  poolFee: BigNumberish;
  boostRewardsPoolAddress: `0x${string}`;
  weth9: `0${string}`;
};

export const YEET24_SHAMAN_PERMISSIONS = "3";

export const assembleYeet24ShamanParams = ({
  boostRewardsPoolAddress,
  endTimeInSeconds,
  goal,
  nonFungiblePositionManager,
  poolFee,
  weth9,
} : Yeet24Params) => {
  // address _nftPositionManager,
  // address _weth9Address,
  // uint256 _threshold,
  // uint256 _expiration,
  // uint24 _poolFee
  return encodeValues(
    ["address", "address", "address", "uint256", "uint256", "uint24"],
    [
      nonFungiblePositionManager,
      weth9,
      boostRewardsPoolAddress,
      // DEFAULT_YEETER_VALUES.minThresholdGoal, // align with yeeter
      goal,
      // Number(endDateTime), // align with yeeter
      endTimeInSeconds,
      // DEFAULT_MEME_YEETER_VALUES.poolFee,
      poolFee,
    ]
  );
}

export const assembleYeet24SummonerArgs = async ({
  avatarAddress,
  daoName,
  lootConfig,
  metadataConfigParams,
  sharesConfig,
  saltNonce,
  shamanZodiacModuleAddress,
  summonParams,
  yeet24Singleton,
  yeet24Params,
  yeeterParams,
  yeeterSingleton,
} : {
  avatarAddress: string;
  daoName: string;
  lootConfig: TokenConfig;
  metadataConfigParams: MetadataConfigParams;
  sharesConfig: TokenConfig;
  saltNonce: string;
  shamanZodiacModuleAddress: string;
  summonParams: SummonParams;
  yeeterParams: YeeterParams;
  yeeterSingleton: string;
  yeet24Params: Yeet24Params;
  yeet24Singleton: string;
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

  // yeeter + yeet24 setup
  const yeeterInitParams = assembleYeeterShamanParams(yeeterParams);
  const yeet24InitParams = assembleYeet24ShamanParams(yeet24Params);
  const initializationShamanParams = assembleShamanParams({
    shamanSingletons: [yeet24Singleton , yeeterSingleton] as Array<`0x${string}`>,
    shamanInitParams: [yeet24InitParams, yeeterInitParams],
    shamanPermissions: [YEET24_SHAMAN_PERMISSIONS, YEETER_SHAMAN_PERMISSIONS],
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

  // console.log(">>>>> summon args", initializationLootTokenParams, initializationShareTokenParams, initializationShamanParams, postInitializationActions);

  return [
    initializationLootTokenParams,
    initializationSharesTokenParams,
    initializationShamanParams,
    [
      ...postInitializationActions,
      yeet24ShamanEnableModule,
    ],
    saltNonce,
  ];
};
