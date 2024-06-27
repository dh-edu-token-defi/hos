import { BigNumberish } from "ethers";
import { ethers } from "hardhat";

import { Yeet24HOS } from "../../types";
import { encodeValues } from "./index";

export type MetadataConfigParams = {
  name: string;
  daoId: `0x${string}`;
  avatarImg: string;
  description: string;
  longDescription: string;
  tags: Array<string>;
  title: string;
  authorAddress: `0x${string}`;
  posterAddress: string;
};

export type SummonParams = {
  votingPeriodInSeconds: BigNumberish;
  gracePeriodInSeconds: BigNumberish;
  newOffering: BigNumberish;
  quorum: BigNumberish;
  sponsorThreshold: BigNumberish;
  minRetention: BigNumberish;
  votingTransferable: boolean;
  nvTransferable: boolean;
};

export type TokenConfig = {
  singleton: `0x${string}`;
  tokenSymbol: string;
  paused: boolean;
};

export const DEFAULT_SUMMON_VALUES: SummonParams = {
  //votingPeriodInSeconds: 259200,
  votingPeriodInSeconds: 200,
  // gracePeriodInSeconds: 172800,
  gracePeriodInSeconds: 6,
  newOffering: ethers.utils.parseEther("0.01"),
  //   quorum: "20",
  quorum: "20",
  sponsorThreshold: ethers.utils.parseEther("1"),
  minRetention: "66",
  votingTransferable: false,
  nvTransferable: true,
};

export const assembleLootTokenParams = ({
  daoName,
  lootSingleton,
  tokenSymbol,
}: {
  daoName: string;
  lootSingleton: `0x${string}`;
  tokenSymbol: string;
}) => {
  const lootParams = encodeValues(["string", "string"], [daoName, tokenSymbol]);

  return encodeValues(["address", "bytes"], [lootSingleton, lootParams]);
};

// Needs to be non transferable
export const assembleShareTokenParams = ({
  daoName,
  sharesSingleton,
  tokenSymbol,
}: {
  daoName: string;
  sharesSingleton: `0x${string}`;
  tokenSymbol: string;
}) => {
  const shareParams = encodeValues(["string", "string"], [daoName, tokenSymbol]);

  return encodeValues(["address", "bytes"], [sharesSingleton, shareParams]);
};

export const assembleShamanParams = ({
  shamanInitParams,
  shamanPermissions,
  shamanSingletons,
}: {
  shamanSingletons: Array<`0x${string}`>;
  shamanPermissions: Array<BigNumberish>;
  shamanInitParams: Array<string>;
}) => {
  return encodeValues(["address[]", "uint256[]", "bytes[]"], [shamanSingletons, shamanPermissions, shamanInitParams]);
};

export const governanceConfigTX = async ({
  votingPeriodInSeconds,
  gracePeriodInSeconds,
  newOffering,
  quorum,
  sponsorThreshold,
  minRetention,
}: SummonParams) => {
  const encodedValues = encodeValues(
    ["uint32", "uint32", "uint256", "uint256", "uint256", "uint256"],
    [votingPeriodInSeconds, gracePeriodInSeconds, newOffering, quorum, sponsorThreshold, minRetention],
  );
  const baalIface = new ethers.utils.Interface(["function setGovernanceConfig(bytes)"]);
  return baalIface.encodeFunctionData("setGovernanceConfig", [encodedValues]);
};

export const metadataConfigTX = async ({
  name,
  daoId,
  avatarImg,
  description,
  longDescription,
  tags,
  authorAddress,
  posterAddress,
}: MetadataConfigParams) => {
  const content = {
    name,
    daoId,
    table: "daoProfile",
    queryType: "list",
    description,
    longDescription,
    avatarImg, // TODO: is this the right field?
    title: `${name} tst`,
    // tags: ["YEET24", "Incarnation", paramTag || "topic", ...tags],
    tags,
    authorAddress,
  };

  const posterIface = new ethers.utils.Interface(["function post(string content, string tag)"]);
  const METADATA = posterIface.encodeFunctionData("post", [
    JSON.stringify(content),
    "daohaus.summoner.daoProfile", // POSTER_TAGS.summoner,
  ]);

  const baalIface = new ethers.utils.Interface(["function executeAsBaal(address _to, uint256 _value, bytes _data)"]);
  return baalIface.encodeFunctionData("executeAsBaal", [posterAddress, 0, METADATA]);
};

export const tokenConfigTX = async ({
  pauseNvToken,
  pauseVoteToken,
}: {
  pauseNvToken: boolean;
  pauseVoteToken: boolean;
}) => {
  const baalIface = new ethers.utils.Interface(["function setAdminConfig(bool pauseShares, bool pauseLoot)"]);
  return baalIface.encodeFunctionData("setAdminConfig", [pauseVoteToken, pauseNvToken]);
};

export const shamanZodiacModuleConfigTX = async ({
  avatarAddress,
  shamanZodiacModuleAddress,
}: {
  avatarAddress: `0x${string}`;
  shamanZodiacModuleAddress: `0x${string}`;
}) => {
  const safeIface = new ethers.utils.Interface([
    "function enableModule(address module)",
    "function execTransactionFromModule(address to, uint256 value, bytes memory data, uint8 operation)",
  ]);
  const ADD_MODULE = safeIface.encodeFunctionData("enableModule", [shamanZodiacModuleAddress]);

  const EXEC_TX_FROM_MODULE = safeIface.encodeFunctionData("execTransactionFromModule", [
    avatarAddress, // to
    "0", //value
    ADD_MODULE, // data
    "0", // operation
  ]);

  const baalIface = new ethers.utils.Interface(["function executeAsBaal(address _to, uint256 _value, bytes _data)"]);
  return baalIface.encodeFunctionData("executeAsBaal", [avatarAddress, 0, EXEC_TX_FROM_MODULE]);
};

export const assembleBaalInitActions = async ({
  lootConfig,
  metadataConfigParams,
  sharesConfig,
  summonParams,
}: {
  lootConfig: TokenConfig;
  metadataConfigParams: MetadataConfigParams;
  sharesConfig: TokenConfig;
  summonParams: SummonParams;
}) => {
  return [
    await governanceConfigTX(summonParams),
    await metadataConfigTX(metadataConfigParams),
    await tokenConfigTX({
      pauseNvToken: lootConfig.paused,
      pauseVoteToken: sharesConfig.paused,
    }),
    // tokenDistroTX(formValues, memberAddress),
    // this will not be indexed as is. move intro post to metadataConfigTX
    // introPostConfigTX(formValues, memberAddress, POSTER.toLowerCase(), chainId),
  ];
};

export const calculateBaalAddress = async ({
  saltNonce,
  yeet24Summoner,
}: {
  saltNonce: string;
  yeet24Summoner: string;
}) => {
  const hos = (await ethers.getContractAt("Yeet24HOS", yeet24Summoner)) as Yeet24HOS;
  const expectedDAOAddress = await hos.callStatic.calculateBaalAddress(saltNonce);

  return ethers.utils.getAddress(expectedDAOAddress);
};

export const generateShamanSaltNonce = ({
  baalAddress,
  index,
  initializeParams,
  saltNonce,
  shamanPermissions,
  shamanTemplate,
}: {
  baalAddress: string;
  index: string;
  shamanPermissions: string;
  shamanTemplate: string;
  initializeParams: string;
  saltNonce: string;
}) => {
  return ethers.utils.keccak256(
    encodeValues(
      ["address", "uint256", "address", "uint256", "bytes32", "uint256"],
      [baalAddress, index, shamanTemplate, shamanPermissions, ethers.utils.keccak256(initializeParams), saltNonce],
    ),
  );
};

export const calculateHOSShamanAddress = async ({
  hosSummoner,
  saltNonce,
  shamanSingleton,
}: {
  hosSummoner: string;
  saltNonce: string;
  shamanSingleton: string;
}) => {
  const hos = (await ethers.getContractAt("Yeet24HOS", hosSummoner)) as Yeet24HOS;
  const predictedShamanAddress = await hos.callStatic.predictDeterministicShamanAddress(shamanSingleton, saltNonce);
  return predictedShamanAddress;
};
