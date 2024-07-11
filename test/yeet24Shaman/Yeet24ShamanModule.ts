import { Baal, BaalAndVaultSummoner, BaalSummoner, Poster, Shares } from "@daohaus/baal-contracts";
import { calculateSafeProxyAddress, getSaltNonce } from "@daohaus/baal-contracts/hardhat";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import {
  impersonateAccount,
  setBalance,
  stopImpersonatingAccount,
  time,
} from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { BigNumber, BigNumberish, Signer } from "ethers";
import { config, deployments, ethers, getUnnamedAccounts, network } from "hardhat";

import {
  EthYeeter,
  GnosisSafe,
  GnosisSafeProxyFactory,
  GovernorLoot,
  INonfungiblePositionManager,
  WETH,
  Yeet24HOS,
  Yeet24ShamanModule,
} from "../../types";
import { User, shamanFixture } from "../Shaman.fixture";
import { buildSetupSafeCalldata, deploySafe, executeSafeTx, getNetworkConfig } from "../utils";
import {
  DEFAULT_SUMMON_VALUES,
  calculateBaalAddress,
  calculateHOSShamanAddress,
  generateShamanSaltNonce,
} from "../utils/hos";
import { deployUniV3Infra } from "../utils/uniswapv3";
import { YEETER_SHAMAN_PERMISSIONS, YeeterParams, assembleYeeterShamanParams } from "../utils/yeeter";
import {
  YEET24_SHAMAN_NAME,
  YEET24_SHAMAN_PERMISSIONS,
  Yeet24Params,
  assembleYeet24ShamanParams,
  assembleYeet24SummonerArgs,
} from "./utils";

describe("Yeet24ShamanModule", function () {
  let shares: Shares;
  let govLoot: GovernorLoot;
  let poster: Poster;
  let safeProxyFactory: GnosisSafeProxyFactory;
  let safeMastercopy: GnosisSafe;
  // let multisend: MultiSend;
  let weth: WETH;

  let nonFungiblePositionManager: INonfungiblePositionManager;

  let boostRewardsPoolSafe: GnosisSafe;

  let baalSummoner: BaalSummoner;
  let summoner: Yeet24HOS;
  let yeet24Singleton: string;
  let yeeterSingleton: string;

  const defaultBaalMetadata = {
    name: "HOSDAO",
    description: "HOS Dao",
    longDescription: "",
    avatarImg: "", // TODO: is this the right field?
    title: "Hardhat HOS DAO",
    tags: ["YEET24", "Incarnation", "topic"],
  };

  const defaultYeeterShamanParams = {
    isShares: true,
    feeAmounts: ["5000", "5000"], // .5% fees
    goal: ethers.utils.parseEther("1"),
    lootPerYeet: "100",
    minTribute: ethers.utils.parseEther("0.1"),
    multiplier: "100",
  };
  let yeeterShamanParams: YeeterParams;

  const defaultYeet24ShamanParams = {
    poolFee: BigNumber.from("10000"),
  };

  let yeet24ShamanParams: Yeet24Params;

  // const proposal: ProposalType = {
  //   flag: 0,
  //   data: "0x",
  //   details: "test proposal",
  //   expiration: 0,
  //   baalGas: 0,
  // };

  let users: { [key: string]: User };

  const yeet24Abi = [
    "event UniswapPositionCreated(address indexed pool, uint256 indexed positionId, uint160 sqrtPriceX96, uint128 liquidity, uint256 amount0, uint256 amount1)",
  ];
  const ifaceYeet24 = new ethers.utils.Interface(yeet24Abi);

  this.beforeAll(async function () {
    // // NOTICE: reset network
    // await network.provider.request({
    //   method: "hardhat_reset",
    //   params: [],
    // });
    // await reset(); // TODO:
  });

  beforeEach(async function () {
    const networkConfig = getNetworkConfig();
    const infraFixtureTags =
      network.name === "hardhat" && !networkConfig.forking ? ["Infra", "BaalSummoner", "BaalAndVaultSummoner"] : [];
    const fixtureTags = [...infraFixtureTags, "GovernorLoot", "Yeeter2", "Yeet24ShamanModule", "Yeet24HOS"];
    const setup = await shamanFixture({
      deployShamanContracts: {
        yeet24ShamanModule: {
          contract: "Yeet24ShamanModule",
          contractName: "Yeet24ShamanModule",
        },
      },
      fixtureTags,
    });
    // const shamans = setup.shamans;
    users = setup.users;

    safeProxyFactory = setup.safe.safeProxyFactory;
    safeMastercopy = setup.safe.masterCopy;
    // multisend = setup.safe.multisend;

    // // MUST run after fixture due to how chain snapshot works on hardhat
    // const setupBaal = await baalSetup({
    //   daoSettings: defaultDAOSettings,
    //   fixtureTags: ["BaalAndVaultSummoner"]
    // });
    // baal = setupBaal.Baal;
    // daoSafe = setupBaal.GnosisSafe;
    // sharesToken = setupBaal.Shares;
    // multisend = setupBaal.MultiSend;

    const hosDeployed = await deployments.get("Yeet24HOS");
    const govLootDeployed = await deployments.get("GovernorLoot");

    yeet24Singleton = (await deployments.get("Yeet24ShamanModule")).address;
    yeeterSingleton = (await deployments.get("EthYeeter")).address;

    const signer = await ethers.getSigner(users.owner.address);

    // get summoner contracts
    summoner = (await ethers.getContractAt("Yeet24HOS", hosDeployed.address, signer)) as Yeet24HOS;
    const bvSummoner = (await ethers.getContractAt(
      "BaalAndVaultSummoner",
      await summoner.baalVaultSummoner(),
    )) as BaalAndVaultSummoner;
    baalSummoner = (await ethers.getContractAt("BaalSummoner", await bvSummoner._baalSummoner())) as BaalSummoner;

    // NOTICE: override safe config to get actual Safe infra used by Baal
    const currentSafeMastercopyAddress = await baalSummoner.gnosisSingleton();
    safeMastercopy = (await ethers.getContractAt("GnosisSafe", currentSafeMastercopyAddress)) as GnosisSafe;
    const currentSafeProxyFactoryAddress = ethers.utils.getAddress(
      (await ethers.provider.getStorageAt(baalSummoner.address, "0xd0")).substring(26),
    );
    if (currentSafeProxyFactoryAddress !== ethers.constants.AddressZero) {
      safeProxyFactory = (await ethers.getContractAt(
        "GnosisSafeProxyFactory",
        currentSafeProxyFactoryAddress,
      )) as GnosisSafeProxyFactory;
    }

    shares = setup.baalContracts.sharesSingleton;
    govLoot = (await ethers.getContractAt("GovernorLoot", govLootDeployed.address)) as GovernorLoot;
    poster = setup.baalContracts.poster;

    // deploy UniV3 infra
    const { nftpManager, WETH } = await deployUniV3Infra();
    // console.log("UniV3", nftpManager.address, WETH.address);

    // Create a Pool Rewards Pool Safe
    const safeSaltNonce = getSaltNonce();
    const safeSetupCalldata = buildSetupSafeCalldata({
      owners: [users.owner.address],
      threshold: 1,
      to: ethers.constants.AddressZero,
      data: "0x",
      fallbackHandler: setup.safe.fallbackHandler.address,
      payment: BigNumber.from(0),
      paymentReceiver: ethers.constants.AddressZero,
      paymentToken: ethers.constants.AddressZero,
    });

    boostRewardsPoolSafe = await deploySafe({
      initializerCalldata: safeSetupCalldata,
      safeProxyFactory,
      saltNonce: safeSaltNonce,
      singletonAddress: safeMastercopy.address,
    });

    // Fund Rewards pool
    const rewardsPool = ethers.utils.parseEther("1");
    const fundTx = await signer.sendTransaction({
      to: boostRewardsPoolSafe.address,
      value: rewardsPool,
    });
    await fundTx.wait();

    // Build Shaman params
    yeeterShamanParams = {
      ...defaultYeeterShamanParams,
      feeRecipients: [users.hausEcoFund.address as `0x${string}`, users.yeeterTeam.address as `0x${string}`], // yeeter team, daohaus eco fund
      startTimeInSeconds: await time.latest(),
      // five days since initialDate. See hardhat network config
      endTimeInSeconds: new Date("2024-06-05T00:00:00.000-05:00").getTime() / 1000,
    };

    yeet24ShamanParams = {
      ...defaultYeet24ShamanParams,
      boostRewardsPoolAddress: ethers.constants.AddressZero, // NOTICE: no rewards pool by default
      endTimeInSeconds: yeeterShamanParams.endTimeInSeconds, // should match yeeter
      goal: yeeterShamanParams.goal, // should match yeeter
      nonFungiblePositionManager: nftpManager.address as `0x${string}`,
      weth9: WETH.address as `0x${string}`,
    };

    console.log(
      "yeet24ShamanParams endTime",
      await time.latest(),
      yeet24ShamanParams.endTimeInSeconds,
      Number(yeet24ShamanParams.endTimeInSeconds) > (await time.latest()),
    );

    weth = (await ethers.getContractAt("WETH", WETH.address, signer)) as WETH;
    const wethDepositTx = await weth.deposit({ value: ethers.utils.parseEther("10") });
    await wethDepositTx.wait();

    nonFungiblePositionManager = (await ethers.getContractAt(
      "INonfungiblePositionManager",
      nftpManager.address,
    )) as INonfungiblePositionManager;

    // ========================

    // const chainId = await getChainId();
    // const addresses = await getSetupAddresses(chainId, network, deployments);

    // ========================

    ///////////////////////////////////////////

    // // NOTICE: Fund the DAO Safe so it can pay for relayer fees
    // await signer.sendTransaction({
    //   to: daoSafe.address,
    //   data: "0x",
    //   value: parseEther("1"),
    // });
    // expect(await ethers.provider.getBalance(daoSafe.address)).to.be.equal(parseEther("1"));

    // // NOTICE: DAO Submit proposal to accept control
    // const acceptControlEncoded = l1NetworkRegistry.interface.encodeFunctionData("acceptSplitControl");
    // encodedAction = encodeMultiAction(
    //   multisend,
    //   [acceptControlEncoded],
    //   [l1NetworkRegistry.address],
    //   [BigNumber.from(0)],
    //   [0],
    // );
    // const tx_accept_control = await submitAndProcessProposal({
    //   baal,
    //   encodedAction,
    //   proposal,
    //   daoSettings: defaultDAOSettings,
    // });
    // await tx_accept_control.wait();
    // await expect(tx_accept_control)
    //   .to.emit(l1SplitMain, "ControlTransfer")
    //   .withArgs(l1SplitAddress, users.owner.address, l1RegistryAddress);

    // // NOTICE: DAO action proposal to add replica to main registry
    // const networkRegistry = {
    //   domainId: replicaDomainId,
    //   registryAddress: l2NetworkRegistry.address,
    //   delegate: ethers.constants.AddressZero,
    // };
    // const updateNetworkEncoded = l1NetworkRegistry.interface.encodeFunctionData("updateNetworkRegistry", [
    //   replicaChainId,
    //   networkRegistry,
    // ]);

    // // NOTICE: DAO action proposal to accept Split Control at Replica
    // const chainIds = [replicaChainId];
    // const relayerFees = [defaultRelayerFee];
    // const totalValue = relayerFees.reduce((a: BigNumber, b: BigNumber) => a.add(b), BigNumber.from(0));
    // const acceptNetworkEncoded = l1NetworkRegistry.interface.encodeFunctionData("acceptNetworkSplitControl", [
    //   chainIds,
    //   relayerFees,
    // ]);

    // // NOTICE: batch both proposal actions
    // encodedAction = encodeMultiAction(
    //   multisend,
    //   [updateNetworkEncoded, acceptNetworkEncoded],
    //   [l1NetworkRegistry.address, l1NetworkRegistry.address],
    //   [BigNumber.from(0), totalValue],
    //   [0, 0],
    // );
    // const tx = await submitAndProcessProposal({
    //   baal,
    //   encodedAction,
    //   proposal,
    //   daoSettings: defaultDAOSettings,
    // });
    // await tx.wait();
    // const action = l2NetworkRegistry.interface.getSighash("acceptSplitControl");
    // await expect(tx)
    //   .to.emit(l1NetworkRegistry, "NetworkRegistryUpdated")
    //   .withArgs(replicaChainId, networkRegistry.registryAddress, networkRegistry.domainId, networkRegistry.delegate);
    // await expect(tx)
    //   .to.emit(l2NetworkRegistry, "SyncActionPerformed")
    //   .withArgs(anyValue, parentDomainId, action, true, l1NetworkRegistry.address);
  });

  it("Should have a Boost Rewards Pool setup", async () => {
    expect(await boostRewardsPoolSafe.isOwner(users.owner.address)).to.be.true;
    expect(await ethers.provider.getBalance(boostRewardsPoolSafe.address)).to.be.equal(ethers.utils.parseEther("1"));
  });

  describe("Yeet24ShamanModule + HOS", function () {
    // const batchSize = 95;
    const saltNonce = getSaltNonce();
    let predictedBaalAddress: string;
    let predictedAvatarAddress: string;
    let predictedYeet24ShamanAddress: string;

    let summonParams: Array<string | string[]>;

    beforeEach(async function () {
      predictedBaalAddress = await calculateBaalAddress({
        yeet24Summoner: summoner.address,
        saltNonce,
      });
      console.log("predictedBaalAddress", predictedBaalAddress);

      predictedAvatarAddress = await calculateSafeProxyAddress({
        gnosisSafeProxyFactory: safeProxyFactory,
        masterCopyAddress: safeMastercopy.address,
        saltNonce,
      });
      console.log("predictedAvatarAddress", predictedAvatarAddress);

      const yeet24ShamanSalt = generateShamanSaltNonce({
        baalAddress: predictedBaalAddress,
        index: "0",
        initializeParams: assembleYeet24ShamanParams(yeet24ShamanParams),
        saltNonce,
        shamanPermissions: YEET24_SHAMAN_PERMISSIONS,
        shamanTemplate: yeet24Singleton,
      });
      // console.log("yeet24ShamanSalt", yeet24ShamanSalt);

      predictedYeet24ShamanAddress = await calculateHOSShamanAddress({
        saltNonce: yeet24ShamanSalt,
        shamanSingleton: yeet24Singleton,
        hosSummoner: summoner.address,
      });
      console.log("predictedYeet24ShamanAddress", predictedYeet24ShamanAddress);

      summonParams = await assembleYeet24SummonerArgs({
        avatarAddress: predictedAvatarAddress,
        daoName: "Yeet24",
        lootConfig: {
          singleton: govLoot.address as `0x${string}`,
          tokenSymbol: "LMEME",
          paused: true,
        },
        metadataConfigParams: {
          ...defaultBaalMetadata,
          daoId: predictedBaalAddress as `0x${string}`,
          authorAddress: users.owner.address as `0x${string}`,
          posterAddress: poster.address,
        },
        saltNonce,
        shamanZodiacModuleAddress: predictedYeet24ShamanAddress,
        sharesConfig: {
          singleton: shares.address as `0x${string}`,
          tokenSymbol: "SMEME",
          paused: true,
        },
        summonParams: DEFAULT_SUMMON_VALUES,
        yeet24Params: yeet24ShamanParams,
        yeet24Singleton,
        yeeterParams: yeeterShamanParams,
        yeeterSingleton,
      });

      //   // Syncing a batch of members
      //   const newMembers = sampleSplit.map((memberSplit: SampleSplit) => memberSplit.address);
      //   const activityMultipliers = sampleSplit.map((memberSplit: SampleSplit) => memberSplit.activityMultiplier);
      //   const startDates = sampleSplit.map((memberSplit: SampleSplit) => memberSplit.startDateSeconds);
      //   const chainIds = [replicaChainId];
      //   const relayerFees = [defaultRelayerFee];
      //   const totalValue = relayerFees.reduce((a: BigNumber, b: BigNumber) => a.add(b), BigNumber.from(0));

      //   // NOTICE: set the block timestamp to a month before cutoff date
      //   await time.setNextBlockTimestamp(
      //     Date.parse("2023-06-01T00:00:00.000-05:00") / 1000 -
      //       defaultDAOSettings.VOTING_PERIOD_IN_SECONDS * 2 - // voting + grace period before execution
      //       3, // 3 actions / second - submit proposal -> vote -> execute
      //   );

      //   // NOTICE: Register a new batch of members via the DAO
      //   const newBatchEncoded = l1NetworkRegistry.interface.encodeFunctionData("syncBatchNewMembers", [
      //     newMembers,
      //     activityMultipliers,
      //     startDates,
      //     chainIds,
      //     relayerFees,
      //   ]);
      //   // NOTICE: mintShares to new members. Just a subset at it will hit the block gas limit
      //   const mintSharesEncoded = baal.interface.encodeFunctionData("mintShares", [
      //     newMembers.slice(0, batchSize),
      //     newMembers.map(() => parseEther("1")).slice(0, batchSize),
      //   ]);
      //   const encodedAction = encodeMultiAction(
      //     multisend,
      //     [mintSharesEncoded, newBatchEncoded],
      //     [baal.address, l1NetworkRegistry.address],
      //     [BigNumber.from(0), totalValue],
      //     [0, 0],
      //   );
      //   const tx_batch = await submitAndProcessProposal({
      //     baal,
      //     encodedAction,
      //     proposal,
      //     daoSettings: defaultDAOSettings,
      //   });
      //   const action = l2NetworkRegistry.interface.getSighash("batchNewMembers(address[],uint32[],uint32[])");
      //   await expect(tx_batch)
      //     .to.emit(l2NetworkRegistry, "SyncActionPerformed")
      //     .withArgs(anyValue, parentDomainId, action, true, l1NetworkRegistry.address);

      //   // NOTICE: mintShares to the rest of new members on a separate proposal
      //   const mintShares2Encoded = baal.interface.encodeFunctionData("mintShares", [
      //     newMembers.slice(batchSize),
      //     newMembers.map(() => parseEther("1")).slice(batchSize),
      //   ]);
      //   const tx_batch2 = await submitAndProcessProposal({
      //     baal,
      //     encodedAction: encodeMultiAction(multisend, [mintShares2Encoded], [baal.address], [BigNumber.from(0)], [0]),
      //     proposal,
      //     daoSettings: defaultDAOSettings,
      //   });
      //   await expect(tx_batch2).to.emit(baal, "ProcessProposal").withArgs(anyValue, true, false);
      //   // const blockNo = await time.latestBlock();
      //   // console.log('block timestamp', (await ethers.provider.getBlock(blockNo)).timestamp);
    });

    it("Should be able to setup a DAO with Yeeter24 shaman modules", async () => {
      const summonTx = await summoner.summonBaalFromReferrer(
        summonParams[0] as string,
        summonParams[1] as string,
        summonParams[2] as string,
        summonParams[3] as string[],
        summonParams[4] as string,
      );

      await expect(summonTx)
        .to.emit(baalSummoner, "DeployBaalSafe")
        .withArgs(predictedAvatarAddress, predictedBaalAddress);
      await expect(summonTx)
        .to.emit(baalSummoner, "SummonBaal")
        .withArgs(predictedBaalAddress, anyValue, anyValue, predictedAvatarAddress, ethers.constants.AddressZero, "1");
      const avatarContract = (await ethers.getContractAt("GnosisSafe", predictedAvatarAddress)) as GnosisSafe;
      const baalContract = (await ethers.getContractAt("Baal", predictedBaalAddress)) as Baal;

      await expect(summonTx)
        .to.emit(baalContract, "ShamanSet")
        .withArgs(predictedYeet24ShamanAddress, YEET24_SHAMAN_PERMISSIONS);
      await expect(summonTx).to.emit(avatarContract, "EnabledModule").withArgs(predictedYeet24ShamanAddress);

      const yeet24Shaman = (await ethers.getContractAt(
        "Yeet24ShamanModule",
        predictedYeet24ShamanAddress,
      )) as Yeet24ShamanModule;
      // Setup(address indexed baal, address indexed vault, uint256 threshold, uint256 expiration, uint256 poolFee);
      await expect(summonTx)
        .to.emit(yeet24Shaman, "Setup")
        .withArgs(
          predictedBaalAddress,
          predictedAvatarAddress,
          yeet24ShamanParams.goal,
          yeet24ShamanParams.endTimeInSeconds,
          yeet24ShamanParams.poolFee,
          yeet24ShamanParams.boostRewardsPoolAddress,
        );
    });

    it("Should be able to predict yeeter shaman address", async () => {
      const yeeterShamanSalt = generateShamanSaltNonce({
        baalAddress: predictedBaalAddress,
        index: "1",
        initializeParams: assembleYeeterShamanParams(yeeterShamanParams),
        saltNonce,
        shamanPermissions: YEETER_SHAMAN_PERMISSIONS,
        shamanTemplate: yeeterSingleton,
      });
      // console.log("yeeterShamanSalt", yeeterShamanSalt);

      const predictedYeeterShamanAddress = await calculateHOSShamanAddress({
        saltNonce: yeeterShamanSalt,
        shamanSingleton: yeeterSingleton,
        hosSummoner: summoner.address,
      });
      // console.log("predictedYeeterShamanAddress", predictedYeeterShamanAddress);

      const summonTx = await summoner.summonBaalFromReferrer(
        summonParams[0] as string,
        summonParams[1] as string,
        summonParams[2] as string,
        summonParams[3] as string[],
        summonParams[4] as string,
      );
      const baalContract = (await ethers.getContractAt("Baal", predictedBaalAddress)) as Baal;
      await expect(summonTx)
        .to.emit(baalContract, "ShamanSet")
        .withArgs(predictedYeeterShamanAddress, YEETER_SHAMAN_PERMISSIONS);
      // TODO: yeeter setup event?
    });

    // it("Should sync update seconds active and update splits prior distribution", async () => {
    //   let encodedAction: string;
    //   let action: string;
    //   const memberList = sampleSplit.map((memberSplit: SampleSplit) => memberSplit.address);
    //   const chainIds = [replicaChainId];
    //   const relayerFees = [defaultRelayerFee];
    //   const totalValue = relayerFees.reduce((a: BigNumber, b: BigNumber) => a.add(b), BigNumber.from(0));
    //   const splitDistributorFee = splitConfig.distributorFee;

    //   // Jump the cut-off date
    //   await time.setNextBlockTimestamp(
    //     CUTOFF_DATE -
    //       defaultDAOSettings.VOTING_PERIOD_IN_SECONDS * 2 - // voting + grace period before execution
    //       3, // 3 actions / second - submit proposal -> vote -> execute
    //   );

    //   // NOtICE: DAO updates seconds active across registries
    //   const updateSecsEncoded = l1NetworkRegistry.interface.encodeFunctionData("syncUpdateSecondsActive", [
    //     chainIds,
    //     relayerFees,
    //   ]);
    //   encodedAction = encodeMultiAction(multisend, [updateSecsEncoded], [l1NetworkRegistry.address], [totalValue], [0]);
    //   const tx_update_secs = await submitAndProcessProposal({
    //     baal,
    //     encodedAction,
    //     proposal,
    //     daoSettings: defaultDAOSettings,
    //   });
    //   action = l2NetworkRegistry.interface.getSighash("updateSecondsActive");
    //   await expect(tx_update_secs)
    //     .to.emit(l2NetworkRegistry, "SyncActionPerformed")
    //     .withArgs(anyValue, parentDomainId, action, true, l1NetworkRegistry.address);

    //   // member list must be sorted
    //   memberList.sort((a: string, b: string) => (a.toLowerCase() > b.toLowerCase() ? 1 : -1));

    //   // Validate member's activity
    //   const expectedSecondsActive = memberList.map((member: string) => {
    //     const split = sampleSplit.find((split: SampleSplit) => split.address === member);
    //     return split ? (split.secondsActive * split.activityMultiplier) / 100 : 0;
    //   });
    //   const l1SecondsActive = await Promise.all(
    //     memberList.map(
    //       async (memberAddress: string) => (await l1NetworkRegistry.getMember(memberAddress)).secondsActive,
    //     ),
    //   );
    //   const l2SecondsActive = await Promise.all(
    //     memberList.map(
    //       async (memberAddress: string) => (await l2NetworkRegistry.getMember(memberAddress)).secondsActive,
    //     ),
    //   );
    //   expect(expectedSecondsActive).to.eql(l1SecondsActive);
    //   expect(expectedSecondsActive).to.eql(l2SecondsActive);

    //   // NOTICE: DAO updates 0xSplit across registries
    //   const updateSplitsEncoded = l1NetworkRegistry.interface.encodeFunctionData("syncUpdateSplits", [
    //     memberList,
    //     splitDistributorFee,
    //     chainIds,
    //     relayerFees,
    //   ]);
    //   encodedAction = encodeMultiAction(
    //     multisend,
    //     [updateSplitsEncoded],
    //     [l1NetworkRegistry.address],
    //     [totalValue],
    //     [0],
    //   );
    //   const tx_update_splits = await submitAndProcessProposal({
    //     baal,
    //     encodedAction,
    //     proposal,
    //     daoSettings: defaultDAOSettings,
    //   });
    //   action = l2NetworkRegistry.interface.getSighash("updateSplits");
    //   await expect(tx_update_splits)
    //     .to.emit(l2NetworkRegistry, "SyncActionPerformed")
    //     .withArgs(anyValue, parentDomainId, action, true, l1NetworkRegistry.address);

    //   // Fetch split data from registries
    //   const l1Splits = await l1NetworkRegistry.calculate(memberList);
    //   const l2Splits = await l2NetworkRegistry.calculate(memberList);

    //   // Verify latest 0xSplit hash
    //   const l1SplitHash = hashSplit(l1Splits._receivers, l1Splits._percentAllocations, splitDistributorFee);
    //   const l2SplitHash = hashSplit(l2Splits._receivers, l2Splits._percentAllocations, splitDistributorFee);

    //   expect(await l1SplitMain.getHash(l1SplitAddress)).to.be.equal(l1SplitHash);
    //   expect(await l2Registry.splitMain.getHash(l2SplitAddress)).to.be.equal(l2SplitHash);

    //   // Validate qualified receivers
    //   const expectedRecipients = memberList
    //     .map((member: string) => sampleSplit.find((split: SampleSplit) => split.address === member))
    //     // NOTICE: get active recipients only
    //     .filter((split?: SampleSplit) => (split ? (split.secondsActive * split.activityMultiplier) / 100 : 0) > 0)
    //     .map((split?: SampleSplit) => split?.address);

    //   expect(expectedRecipients).to.eql(l1Splits._receivers);
    //   expect(expectedRecipients).to.eql(l2Splits._receivers);

    //   // Validate member's percent allocation
    //   const calcContributions = await Promise.all(
    //     l1Splits._receivers.map(async (member: string) => await l1NetworkRegistry["calculateContributionOf"](member)),
    //   );
    //   const totalContributions = await l1NetworkRegistry.calculateTotalContributions();

    //   const expectedAllocations = calcContributions.map((c: BigNumber) =>
    //     c.mul(PERCENTAGE_SCALE).div(totalContributions).toNumber(),
    //   );
    //   const runningTotal = expectedAllocations.reduce((a: number, b: number) => a + b, 0);
    //   // NOTICE: dust (remainder) should be added to the member with the lowest allocation
    //   if (BigNumber.from(runningTotal).lt(PERCENTAGE_SCALE)) {
    //     const contribAsNumber: number[] = calcContributions.map((c) => c.toNumber());
    //     const minValue = Math.min(...contribAsNumber);
    //     const minIndex = contribAsNumber.indexOf(minValue);
    //     expectedAllocations[minIndex] = expectedAllocations[minIndex] + PERCENTAGE_SCALE.sub(runningTotal).toNumber();
    //   }

    //   expect(expectedAllocations).to.eql(l1Splits._percentAllocations);
    //   expect(expectedAllocations).to.eql(l2Splits._percentAllocations);

    //   // Trigger 0xSplit distribution (permissionless) acros networks
    //   const distributeL1Tx = await l1SplitMain.distributeERC20(
    //     l1SplitAddress,
    //     l1Token.address,
    //     l1Splits._receivers,
    //     l1Splits._percentAllocations,
    //     splitDistributorFee,
    //     ethers.constants.AddressZero,
    //   );

    //   await distributeL1Tx.wait();

    //   await expect(distributeL1Tx)
    //     .to.emit(l1SplitMain, "DistributeERC20")
    //     .withArgs(
    //       l1SplitAddress,
    //       l1Token.address,
    //       initialSplitDeposit.sub(BigNumber.from(1)), // NOTICE: subtract dust balance
    //       ethers.constants.AddressZero,
    //     );

    //   const distributeL2Tx = await l2Registry.splitMain.distributeERC20(
    //     l2SplitAddress,
    //     l2Registry.token.address,
    //     l2Splits._receivers,
    //     l2Splits._percentAllocations,
    //     splitDistributorFee,
    //     ethers.constants.AddressZero,
    //   );

    //   await distributeL2Tx.wait();
    //   await expect(distributeL2Tx)
    //     .to.emit(l2Registry.splitMain, "DistributeERC20")
    //     .withArgs(
    //       l2SplitAddress,
    //       l2Registry.token.address,
    //       initialSplitDeposit.sub(BigNumber.from(1)), // NOTICE: subtract dust balance
    //       ethers.constants.AddressZero,
    //     );

    //   // Validate member's balance
    //   const expectedBalances = await Promise.all(
    //     l1Splits._percentAllocations.map((allocation: number) =>
    //       initialSplitDeposit.mul(allocation).div(PERCENTAGE_SCALE),
    //     ),
    //   );
    //   const l1Balances = await Promise.all(
    //     l1Splits._receivers.map(
    //       async (memberAddress: string) => await l1SplitMain.getERC20Balance(memberAddress, l1Token.address),
    //     ),
    //   );
    //   const l2Balances = await Promise.all(
    //     l1Splits._receivers.map(
    //       async (memberAddress: string) =>
    //         await l2Registry.splitMain.getERC20Balance(memberAddress, l2Registry.token.address),
    //     ),
    //   );

    //   expect(expectedBalances).to.eql(l1Balances);
    //   expect(expectedBalances).to.eql(l2Balances);
    // });

    // it("Should sync update all prior distribution", async () => {
    //   const memberList = sampleSplit.map((memberSplit: SampleSplit) => memberSplit.address);
    //   const chainIds = [replicaChainId];
    //   const relayerFees = [defaultRelayerFee];
    //   const totalValue = relayerFees.reduce((a: BigNumber, b: BigNumber) => a.add(b), BigNumber.from(0));
    //   const splitDistributorFee = splitConfig.distributorFee;

    //   // Jump the cut-off date
    //   await time.setNextBlockTimestamp(
    //     CUTOFF_DATE -
    //       defaultDAOSettings.VOTING_PERIOD_IN_SECONDS * 2 - // voting + grace period before execution
    //       3, // 3 actions / second - submit proposal -> vote -> execute
    //   );

    //   // member list must be sorted
    //   memberList.sort((a: string, b: string) => (a.toLowerCase() > b.toLowerCase() ? 1 : -1));

    //   // Update seconds active across registries
    //   // const txSplits = await l1NetworkRegistry.syncUpdateAll(memberList, splitDistributorFee, chainIds, relayerFees, { value: totalValue });
    //   // await txSplits.wait();
    //   const updateAllEncoded = l1NetworkRegistry.interface.encodeFunctionData("syncUpdateAll", [
    //     memberList,
    //     splitDistributorFee,
    //     chainIds,
    //     relayerFees,
    //   ]);
    //   const encodedAction = encodeMultiAction(
    //     multisend,
    //     [updateAllEncoded],
    //     [l1NetworkRegistry.address],
    //     [totalValue],
    //     [0],
    //   );
    //   const tx_update_all = await submitAndProcessProposal({
    //     baal,
    //     encodedAction,
    //     proposal,
    //     daoSettings: defaultDAOSettings,
    //   });
    //   const action = l2NetworkRegistry.interface.getSighash("updateAll");
    //   await expect(tx_update_all)
    //     .to.emit(l2NetworkRegistry, "SyncActionPerformed")
    //     .withArgs(anyValue, parentDomainId, action, true, l1NetworkRegistry.address);

    //   // Validate member's activity
    //   const expectedSecondsActive = memberList.map((member: string) => {
    //     const split = sampleSplit.find((split: SampleSplit) => split.address === member);
    //     return split ? (split.secondsActive * split.activityMultiplier) / 100 : 0;
    //   });
    //   const l1SecondsActive = await Promise.all(
    //     memberList.map(
    //       async (memberAddress: string) => (await l1NetworkRegistry.getMember(memberAddress)).secondsActive,
    //     ),
    //   );
    //   const l2SecondsActive = await Promise.all(
    //     memberList.map(
    //       async (memberAddress: string) => (await l2NetworkRegistry.getMember(memberAddress)).secondsActive,
    //     ),
    //   );
    //   expect(expectedSecondsActive).to.eql(l1SecondsActive);
    //   expect(expectedSecondsActive).to.eql(l2SecondsActive);

    //   // Fetch split data from registries
    //   const l1Splits = await l1NetworkRegistry.calculate(memberList);
    //   const l2Splits = await l2NetworkRegistry.calculate(memberList);

    //   // Verify latest 0xSplit hash
    //   const l1SplitHash = hashSplit(l1Splits._receivers, l1Splits._percentAllocations, splitDistributorFee);
    //   const l2SplitHash = hashSplit(l2Splits._receivers, l2Splits._percentAllocations, splitDistributorFee);

    //   expect(await l1SplitMain.getHash(l1SplitAddress)).to.be.equal(l1SplitHash);
    //   expect(await l2Registry.splitMain.getHash(l2SplitAddress)).to.be.equal(l2SplitHash);

    //   // Validate qualified receivers
    //   const expectedRecipients = memberList
    //     .map((member: string) => sampleSplit.find((split: SampleSplit) => split.address === member))
    //     // NOTICE: get active recipients only
    //     .filter((split?: SampleSplit) => (split ? (split.secondsActive * split.activityMultiplier) / 100 : 0) > 0)
    //     .map((split?: SampleSplit) => split?.address);

    //   expect(expectedRecipients).to.eql(l1Splits._receivers);
    //   expect(expectedRecipients).to.eql(l2Splits._receivers);

    //   // Validate member's percent allocation
    //   const calcContributions = await Promise.all(
    //     l1Splits._receivers.map(async (member: string) => await l1NetworkRegistry["calculateContributionOf"](member)),
    //   );
    //   const totalContributions = await l1NetworkRegistry.calculateTotalContributions();

    //   const expectedAllocations = calcContributions.map((c: BigNumber) =>
    //     c.mul(PERCENTAGE_SCALE).div(totalContributions).toNumber(),
    //   );
    //   const runningTotal = expectedAllocations.reduce((a: number, b: number) => a + b, 0);
    //   // NOTICE: dust (remainder) should be added to the member with the lowest allocation
    //   if (BigNumber.from(runningTotal).lt(PERCENTAGE_SCALE)) {
    //     const contribAsNumber: number[] = calcContributions.map((c) => c.toNumber());
    //     const minValue = Math.min(...contribAsNumber);
    //     const minIndex = contribAsNumber.indexOf(minValue);
    //     expectedAllocations[minIndex] = expectedAllocations[minIndex] + PERCENTAGE_SCALE.sub(runningTotal).toNumber();
    //   }

    //   expect(expectedAllocations).to.eql(l1Splits._percentAllocations);
    //   expect(expectedAllocations).to.eql(l2Splits._percentAllocations);

    //   // Trigger 0xSplit distribution (permissionless) acros networks
    //   const distributeL1Tx = await l1SplitMain.distributeERC20(
    //     l1SplitAddress,
    //     l1Token.address,
    //     l1Splits._receivers,
    //     l1Splits._percentAllocations,
    //     splitDistributorFee,
    //     ethers.constants.AddressZero,
    //   );

    //   await distributeL1Tx.wait();

    //   await expect(distributeL1Tx)
    //     .to.emit(l1SplitMain, "DistributeERC20")
    //     .withArgs(
    //       l1SplitAddress,
    //       l1Token.address,
    //       initialSplitDeposit.sub(BigNumber.from(1)), // NOTICE: subtract dust balance
    //       ethers.constants.AddressZero,
    //     );

    //   const distributeL2Tx = await l2Registry.splitMain.distributeERC20(
    //     l2SplitAddress,
    //     l2Registry.token.address,
    //     l2Splits._receivers,
    //     l2Splits._percentAllocations,
    //     splitDistributorFee,
    //     ethers.constants.AddressZero,
    //   );

    //   await distributeL2Tx.wait();
    //   await expect(distributeL2Tx)
    //     .to.emit(l2Registry.splitMain, "DistributeERC20")
    //     .withArgs(
    //       l2SplitAddress,
    //       l2Registry.token.address,
    //       initialSplitDeposit.sub(BigNumber.from(1)), // NOTICE: subtract dust balance
    //       ethers.constants.AddressZero,
    //     );

    //   // Validate member's balance
    //   const expectedBalances = await Promise.all(
    //     l1Splits._percentAllocations.map((allocation: number) =>
    //       initialSplitDeposit.mul(allocation).div(PERCENTAGE_SCALE),
    //     ),
    //   );
    //   const l1Balances = await Promise.all(
    //     l1Splits._receivers.map(
    //       async (memberAddress: string) => await l1SplitMain.getERC20Balance(memberAddress, l1Token.address),
    //     ),
    //   );
    //   const l2Balances = await Promise.all(
    //     l1Splits._receivers.map(
    //       async (memberAddress: string) =>
    //         await l2Registry.splitMain.getERC20Balance(memberAddress, l2Registry.token.address),
    //     ),
    //   );

    //   expect(expectedBalances).to.eql(l1Balances);
    //   expect(expectedBalances).to.eql(l2Balances);
    // });
  });

  describe("Yeet24ShamanModule behavior", function () {
    const saltNonce = getSaltNonce();
    let totalFees: BigNumberish = 0;
    let avatar: GnosisSafe;
    let baal: Baal;
    let signer: Signer;
    let yeet24Shaman: Yeet24ShamanModule;
    let yeeterShaman: EthYeeter;
    let sharesToken: Shares;
    let govLootToken: GovernorLoot;

    beforeEach(async () => {
      signer = await ethers.getSigner(users.owner.address);

      const predictedBaalAddress = await calculateBaalAddress({
        yeet24Summoner: summoner.address,
        saltNonce,
      });
      // console.log("predictedBaalAddress", predictedBaalAddress);

      const predictedAvatarAddress = await calculateSafeProxyAddress({
        gnosisSafeProxyFactory: safeProxyFactory,
        masterCopyAddress: safeMastercopy.address,
        saltNonce,
      });
      // console.log("predictedAvatarAddress", predictedAvatarAddress);

      const yeet24ShamanSalt = generateShamanSaltNonce({
        baalAddress: predictedBaalAddress,
        index: "0",
        initializeParams: assembleYeet24ShamanParams(yeet24ShamanParams),
        saltNonce,
        shamanPermissions: YEET24_SHAMAN_PERMISSIONS,
        shamanTemplate: yeet24Singleton,
      });
      // console.log("yeet24ShamanSalt", yeet24ShamanSalt);

      const predictedYeet24ShamanAddress = await calculateHOSShamanAddress({
        saltNonce: yeet24ShamanSalt,
        shamanSingleton: yeet24Singleton,
        hosSummoner: summoner.address,
      });
      // console.log("predictedYeet24ShamanAddress", predictedYeet24ShamanAddress);

      const yeeterShamanSalt = generateShamanSaltNonce({
        baalAddress: predictedBaalAddress,
        index: "1",
        initializeParams: assembleYeeterShamanParams(yeeterShamanParams),
        saltNonce,
        shamanPermissions: YEETER_SHAMAN_PERMISSIONS,
        shamanTemplate: yeeterSingleton,
      });
      // console.log("yeeterShamanSalt", yeeterShamanSalt);

      const predictedYeeterShamanAddress = await calculateHOSShamanAddress({
        saltNonce: yeeterShamanSalt,
        shamanSingleton: yeeterSingleton,
        hosSummoner: summoner.address,
      });
      // console.log("predictedYeeterShamanAddress", predictedYeeterShamanAddress);

      totalFees = yeeterShamanParams.feeAmounts.reduce((a, b) => Number(a) + Number(b), 0);

      const summonParams = await assembleYeet24SummonerArgs({
        avatarAddress: predictedAvatarAddress,
        daoName: "Yeet24",
        lootConfig: {
          singleton: govLoot.address as `0x${string}`,
          tokenSymbol: "LMEME",
          paused: true,
        },
        metadataConfigParams: {
          ...defaultBaalMetadata,
          daoId: predictedBaalAddress as `0x${string}`,
          authorAddress: users.owner.address as `0x${string}`,
          posterAddress: poster.address,
        },
        saltNonce,
        shamanZodiacModuleAddress: predictedYeet24ShamanAddress,
        sharesConfig: {
          singleton: shares.address as `0x${string}`,
          tokenSymbol: "SMEME",
          paused: true,
        },
        summonParams: DEFAULT_SUMMON_VALUES,
        yeet24Params: yeet24ShamanParams,
        yeet24Singleton,
        yeeterParams: yeeterShamanParams,
        yeeterSingleton,
      });
      await summoner.summonBaalFromReferrer(
        summonParams[0] as string,
        summonParams[1] as string,
        summonParams[2] as string,
        summonParams[3] as string[],
        summonParams[4] as string,
      );
      avatar = (await ethers.getContractAt("GnosisSafe", predictedAvatarAddress, signer)) as GnosisSafe;
      baal = (await ethers.getContractAt("Baal", predictedBaalAddress, signer)) as Baal;
      yeet24Shaman = (await ethers.getContractAt(
        "Yeet24ShamanModule",
        predictedYeet24ShamanAddress,
        signer,
      )) as Yeet24ShamanModule;
      yeeterShaman = (await ethers.getContractAt("EthYeeter", predictedYeeterShamanAddress, signer)) as EthYeeter;
      govLootToken = (await ethers.getContractAt("GovernorLoot", await baal.lootToken(), signer)) as GovernorLoot;
      sharesToken = (await ethers.getContractAt("Shares", await baal.sharesToken(), signer)) as Shares;
    });

    it("Should have everything setup", async () => {
      // Yeet24 config params
      expect(await yeet24Shaman.executed()).to.be.false;
      expect(await yeet24Shaman.goal()).to.be.equal(yeet24ShamanParams.goal);
      expect(await yeet24Shaman.goalAchieved()).to.be.false;
      expect(await yeet24Shaman.endTime()).to.be.equal(yeet24ShamanParams.endTimeInSeconds);
      expect(await yeet24Shaman.poolFee()).to.be.equal(yeet24ShamanParams.poolFee);
      expect(await yeet24Shaman.nonfungiblePositionManager()).to.be.equal(
        yeet24ShamanParams.nonFungiblePositionManager,
      );
      expect(await yeet24Shaman.weth()).to.be.equal(yeet24ShamanParams.weth9);
      expect(await yeet24Shaman.boostRewardsPool()).to.be.equal(ethers.constants.AddressZero);

      // UniV3 Pool
      expect(await yeet24Shaman.pool()).to.be.equal(ethers.constants.AddressZero);
      expect(await yeet24Shaman.positionId()).to.be.equal(BigNumber.from(0));

      // ShamanBase
      expect(await yeet24Shaman.baal()).to.be.equal(baal.address);
      expect(await yeet24Shaman.name()).to.be.equal(YEET24_SHAMAN_NAME);
      expect(await yeet24Shaman.vault()).to.be.equal(avatar.address);

      // Shaman interface
      expect(await yeet24Shaman.supportsInterface("0xd2296f8d")).to.be.true; // IShaman

      // Admin interface
      expect(await baal.isAdmin(yeet24Shaman.address)).to.be.true;
      expect(await yeet24Shaman.supportsInterface("0xb3b0786d")).to.be.true;

      // Manager interface
      expect(await baal.isManager(yeet24Shaman.address)).to.be.true;
      expect(await yeet24Shaman.supportsInterface("0xf7c8b398")).to.be.true;

      // Governor interface
      expect(await baal.isGovernor(yeet24Shaman.address)).to.be.false;
      expect(await yeet24Shaman.supportsInterface("0x09238d57")).to.be.false;

      // ZodiacModule
      expect(await yeet24Shaman.avatar()).to.be.equal(avatar.address);
      expect(await yeet24Shaman.target()).to.be.equal(avatar.address);
      expect(await yeet24Shaman.owner()).to.be.equal(avatar.address);
      expect(await yeet24Shaman.moduleEnabled()).to.be.true;
      expect(await avatar.isModuleEnabled(yeet24Shaman.address)).to.be.true;
      expect(await yeet24Shaman.supportsInterface("0x8195a8d8")).to.be.true;

      // Yeeter config params
      expect(await yeeterShaman.baal()).to.be.equal(baal.address);
      expect(await yeeterShaman.vault()).to.be.equal(avatar.address);
      expect(await yeeterShaman.startTime()).to.be.equal(yeeterShamanParams.startTimeInSeconds);
      expect(await yeeterShaman.endTime()).to.be.equal(yeeterShamanParams.endTimeInSeconds);
      expect(await yeeterShaman.minTribute()).to.be.equal(yeeterShamanParams.minTribute);
      expect(await yeeterShaman.goal()).to.be.equal(yeeterShamanParams.goal);
      expect(await yeet24Shaman.goalAchieved()).to.be.false;
      expect(await yeeterShaman.multiplier()).to.be.equal(yeeterShamanParams.multiplier);
      expect(await yeeterShaman.feeRecipients(0)).to.be.equal(yeeterShamanParams.feeRecipients[0]);
      expect(await yeeterShaman.feeRecipients(1)).to.be.equal(yeeterShamanParams.feeRecipients[1]);
      expect(await yeeterShaman.feeAmounts(0)).to.be.equal(yeeterShamanParams.feeAmounts[0]);
      expect(await yeeterShaman.feeAmounts(1)).to.be.equal(yeeterShamanParams.feeAmounts[1]);
      expect(await yeeterShaman.isShares()).to.be.equal(yeeterShamanParams.isShares);
      expect(await baal.isAdmin(yeeterShaman.address)).to.be.false;
      expect(await baal.isManager(yeeterShaman.address)).to.be.true;
      expect(await baal.isGovernor(yeeterShaman.address)).to.be.false;
      // TODO: EthYeeter does not inherits the base contracts
      // expect(await yeeterShaman.supportsInterface("0xf7c8b398")).to.be.true;
    });

    it("Should not be able to call role-based functions", async () => {
      await expect(yeet24Shaman.setAdminConfig(true, true)).to.be.revertedWithCustomError(
        yeet24Shaman,
        "AdminShaman__NoAdminRole",
      );
      await expect(
        yeet24Shaman.mintLoot([yeet24Shaman.address], [ethers.utils.parseEther("1")]),
      ).to.be.revertedWithCustomError(yeet24Shaman, "ManagerShaman__NoManagerRole");
      await expect(
        yeet24Shaman.mintShares([yeet24Shaman.address], [ethers.utils.parseEther("1")]),
      ).to.be.revertedWithCustomError(yeet24Shaman, "ManagerShaman__NoManagerRole");
      await expect(
        yeet24Shaman.burnLoot([yeet24Shaman.address], [ethers.utils.parseEther("1")]),
      ).to.be.revertedWithCustomError(yeet24Shaman, "ManagerShaman__NoManagerRole");
      await expect(
        yeet24Shaman.burnShares([yeet24Shaman.address], [ethers.utils.parseEther("1")]),
      ).to.be.revertedWithCustomError(yeet24Shaman, "ManagerShaman__NoManagerRole");
    });

    // TODO: yeeter un-happy paths

    it("Should not be able to execute admin function if not vault", async () => {
      await expect(
        yeet24Shaman.createPoolAndMintPosition(sharesToken.address, weth.address, "0", "0"),
      ).to.be.revertedWithCustomError(yeet24Shaman, "Yeet24ShamanModule__BaalVaultOnly");
      await expect(yeet24Shaman.withdrawShamanBalance()).to.be.revertedWithCustomError(
        yeet24Shaman,
        "Yeet24ShamanModule__BaalVaultOnly",
      );
    });

    it("Should accept yeets during active period", async () => {
      const signer = await ethers.getSigner(users.alice.address);
      const yeeterBalanceBefore = await ethers.provider.getBalance(avatar.address);
      const tx = await signer.sendTransaction({
        to: yeeterShaman.address,
        value: yeeterShamanParams.minTribute,
        data: "0x",
      });
      const isShares = await yeeterShaman.isShares();
      const mintedTokens = tx.value.mul(yeeterShamanParams.multiplier);

      // OnReceived(msg.sender, msg.value, _shares, address(baal), vault, message)
      await expect(tx)
        .to.emit(yeeterShaman, "OnReceived")
        .withArgs(signer.address, tx.value, mintedTokens, baal.address, avatar.address, "");
      if (isShares) {
        await expect(tx)
          .to.emit(sharesToken, "Transfer")
          .withArgs(ethers.constants.AddressZero, signer.address, mintedTokens);
        expect(await sharesToken.balanceOf(signer.address)).to.be.equal(mintedTokens);
      } else {
        await expect(tx)
          .to.emit(govLootToken, "Transfer")
          .withArgs(ethers.constants.AddressZero, signer.address, mintedTokens);
        expect(await govLootToken.balanceOf(signer.address)).to.be.equal(mintedTokens);
      }
      const feesCut = tx.value.div(1e6).mul(totalFees);
      const receivedAmount = tx.value.sub(feesCut);
      expect(await yeeterShaman.balance()).to.be.equal(yeeterBalanceBefore.add(tx.value));
      expect(await ethers.provider.getBalance(avatar.address)).to.be.equal(yeeterBalanceBefore.add(receivedAmount));
      expect(await ethers.provider.getBalance(yeeterShaman.address)).to.be.equal(BigNumber.from(0));
    });

    it("Should not be able to execute if yeeter campaign has not finished", async () => {
      console.log(
        "Time state",
        await time.latest(),
        (await yeet24Shaman.endTime()).toString(),
        (await yeet24Shaman.endTime()).gt(await time.latest()),
      );
      await expect(yeet24Shaman.execute()).to.be.revertedWithCustomError(
        yeet24Shaman,
        "Yeet24ShamanModule__YeetNotFinished",
      );
    });

    it("Should fail execution if yeeter campaign has not met threshold", async () => {
      console.log(
        "Time state",
        await time.latest(),
        (await yeet24Shaman.endTime()).toString(),
        (await yeet24Shaman.endTime()).gt(await time.latest()),
      );
      const currentYeetBalance = await ethers.provider.getBalance(yeeterShaman.address);
      const currentYeet24Balance = await ethers.provider.getBalance(yeet24Shaman.address);
      const transferSuccess = currentYeet24Balance.gt(0);

      expect(await yeet24Shaman.goalAchieved()).to.be.false;

      await time.setNextBlockTimestamp(BigNumber.from(yeet24ShamanParams.endTimeInSeconds).add(1));
      const tx = await yeet24Shaman.execute();
      await expect(tx)
        .to.emit(yeet24Shaman, "ExecutionFailed")
        .withArgs(currentYeetBalance, currentYeet24Balance, transferSuccess);
      expect(await yeet24Shaman.executed()).to.be.true;
      expect(await yeet24Shaman.goalAchieved()).to.be.false;
      expect(await yeet24Shaman.balance()).to.be.equal(0);
    });

    it("Should not be able to withdraw any balance if it has not been executed", async () => {
      let signer = await ethers.getSigner(users.owner.address);
      const tx = await signer.sendTransaction({
        to: yeet24Shaman.address,
        value: ethers.utils.parseEther("1"),
      });
      await tx.wait();

      ///// impersonating Baal Vault
      await setBalance(avatar.address, ethers.utils.parseEther("1"));
      await impersonateAccount(avatar.address);
      signer = await ethers.getSigner(avatar.address);
      await expect(yeet24Shaman.connect(signer).withdrawShamanBalance())
        .to.be.revertedWithCustomError(yeet24Shaman, "Yeet24ShamanModule__TransferFailed")
        .withArgs("0x");
      await stopImpersonatingAccount(avatar.address);
    });

    it("Should be able to withdraw balance if it has been executed", async () => {
      const rewards = ethers.utils.parseEther("1");
      let signer = await ethers.getSigner(users.owner.address);
      const txFund = await signer.sendTransaction({
        to: yeet24Shaman.address,
        value: rewards,
      });
      await txFund.wait();

      await time.setNextBlockTimestamp(BigNumber.from(yeet24ShamanParams.endTimeInSeconds).add(1));
      const tx = await yeet24Shaman.execute();
      await tx.wait();

      ///// impersonating Baal Vault
      await setBalance(avatar.address, ethers.utils.parseEther("1"));
      await impersonateAccount(avatar.address);
      signer = await ethers.getSigner(avatar.address);
      await expect(yeet24Shaman.connect(signer).withdrawShamanBalance())
        .emit(yeet24Shaman, "ShamanBalanceWithdrawn")
        .withArgs(rewards);
      await stopImpersonatingAccount(avatar.address);
    });

    it("Should be able to mint and create position", async () => {
      // mock yeet24 weth and sharesToken balance
      const sharesToMint = ethers.utils.parseEther("35");
      const wethBalance = ethers.utils.parseEther("0.01");
      expect(await sharesToken.balanceOf(yeet24Shaman.address)).to.be.equal(0);
      expect(await weth.balanceOf(yeet24Shaman.address)).to.be.equal(0);

      // yeet24 gets some WETH
      const txWethTransfer = await weth.transfer(yeet24Shaman.address, wethBalance);
      await txWethTransfer.wait();
      expect(await weth.balanceOf(yeet24Shaman.address)).to.be.equal(wethBalance);

      ///// impersonating Yeet24ShamanModule as Manager shaman
      await setBalance(yeet24Shaman.address, ethers.utils.parseEther("1"));
      await impersonateAccount(yeet24Shaman.address);
      let signer = await ethers.getSigner(yeet24Shaman.address);

      // yeet24 gets some shares
      const txMintShares = await baal.connect(signer).mintShares([yeet24Shaman.address], [sharesToMint]);
      await txMintShares.wait();
      expect(await sharesToken.balanceOf(yeet24Shaman.address)).to.be.equal(sharesToMint);

      // turn Baal shares transferrable
      const txAdminConfig = await baal.connect(signer).setAdminConfig(false, true);
      await txAdminConfig.wait();

      await stopImpersonatingAccount(yeet24Shaman.address);
      ///// stop impersonating

      ///// impersonating Baal Vault
      await setBalance(avatar.address, ethers.utils.parseEther("1"));
      await impersonateAccount(avatar.address);
      signer = await ethers.getSigner(avatar.address);

      const tx = await yeet24Shaman
        .connect(signer)
        .createPoolAndMintPosition(sharesToken.address, weth.address, sharesToMint, wethBalance);

      // UniswapPositionCreated(pool, tokenId, sqrtPriceX96, liquidity, amount0, amount1)
      await expect(tx).to.emit(yeet24Shaman, "UniswapPositionCreated");

      await stopImpersonatingAccount(avatar.address);
      ///// stop impersonating

      // Any remainder should be burned
      expect(await sharesToken.balanceOf(avatar.address)).to.be.equal(0);
      expect(await sharesToken.balanceOf(yeet24Shaman.address)).to.be.equal(0);
    });

    it("Should be able to execute if yeeter campaign finished and met threshold", async () => {
      console.log(
        "Time state",
        await time.latest(),
        (await yeet24Shaman.endTime()).toString(),
        (await yeet24Shaman.endTime()).gt(await time.latest()),
      );
      let signer = await ethers.getSigner(users.alice.address);
      let yeet_tx = await signer.sendTransaction({
        to: yeeterShaman.address,
        value: yeeterShamanParams.goal,
        data: "0x",
      });
      await yeet_tx.wait();
      signer = await ethers.getSigner(users.bob.address);
      yeet_tx = await signer.sendTransaction({
        to: yeeterShaman.address,
        value: yeeterShamanParams.goal,
        data: "0x",
      });
      await yeet_tx.wait();

      await time.setNextBlockTimestamp(BigNumber.from(yeet24ShamanParams.endTimeInSeconds).add(1));

      const sharesSupplyBefore = await sharesToken.totalSupply();
      expect(sharesSupplyBefore).to.be.greaterThan(0);

      const boostRewards = await ethers.provider.getBalance(yeet24Shaman.address);
      expect(boostRewards).to.be.equal(0); // no boost rewards

      // Calculate effective eth collected after yeet campaign
      const totalYeeted = await ethers.provider.getBalance(avatar.address);
      const collectedAmount = totalYeeted.add(boostRewards);

      const tx = await yeet24Shaman.execute();
      const receipt = await tx.wait();

      await expect(tx)
        .to.emit(yeet24Shaman, "Executed")
        .withArgs(await baal.sharesToken(), sharesSupplyBefore, collectedAmount, boostRewards);
      // ManagerShaman action: mint 100% shares to this contract. this doubles the total shares
      await expect(tx)
        .to.emit(sharesToken, "Transfer")
        .withArgs(ethers.constants.AddressZero, yeet24Shaman.address, sharesSupplyBefore);

      const positionLog = ifaceYeet24.parseLog(
        receipt.logs.filter(
          (l) =>
            l.address === yeet24Shaman.address &&
            l.topics[0] === "0xa99a6875308aea6e18b918455ff8cd4633862a798bb7a5e9f21fd78b5a1189f2",
        )[0],
      );
      expect(await sharesToken.totalSupply()).to.be.equal(
        sharesSupplyBefore.add(
          BigNumber.from(sharesToken.address < weth.address ? positionLog.args.amount0 : positionLog.args.amount1),
        ),
      );

      // minted shares are used to mint UniV3 position
      expect(await sharesToken.balanceOf(yeet24Shaman.address)).to.be.equal(0);

      // AdminShaman action: Make shares/loot transferrable
      await expect(tx).to.emit(baal, "SharesPaused").withArgs(false);
      expect(await sharesToken.paused()).to.be.false;
      await expect(tx).to.emit(baal, "LootPaused").withArgs(false);
      expect(await govLootToken.paused()).to.be.false;

      // Shaman action: if any boostRewards (e.g. fees + extra boostRewardsPool deposits) are available,
      // forward balance to the vault in charge of minting the pool initial liquidity position
      expect(totalYeeted.sub(boostRewards)).to.be.equal(totalYeeted); // no boost rewards

      // ZodiacModuleShaman action: execute multiSend to
      //  - wrap ETH collected in vault
      await expect(tx).to.emit(weth, "Deposit").withArgs(avatar.address, collectedAmount);
      //  - transfer WETH from vault to shaman
      await expect(tx).to.emit(weth, "Transfer").withArgs(avatar.address, yeet24Shaman.address, collectedAmount);
      // transferred weth is used to mint UniV3 position
      expect(await weth.balanceOf(yeet24Shaman.address)).to.be.equal(0);
      //  - call shaman.createPoolAndMintPosition
      await expect(tx).to.emit(yeet24Shaman, "UniswapPositionCreated");

      // state checks
      expect(await yeet24Shaman.executed()).to.be.true;
      expect(await yeet24Shaman.goalAchieved()).to.be.true;
      expect(await yeet24Shaman.pool()).to.not.be.equal(ethers.constants.AddressZero);
      expect(await yeet24Shaman.balance()).to.be.equal(collectedAmount);
      const positionId = await yeet24Shaman.positionId();
      expect(positionId).to.be.gt(0);
      // TODO: check token refunds after position is minted
      //
      expect(await nonFungiblePositionManager.ownerOf(positionId)).to.be.equal(avatar.address);
    });
  });

  describe("Yeet24ShamanModule + BoostRewardsPool behavior", function () {
    const saltNonce = getSaltNonce();
    let totalFees: BigNumberish = 0;
    let avatar: GnosisSafe;
    let baal: Baal;
    let signer: Signer;
    let yeet24Shaman: Yeet24ShamanModule;
    let yeeterShaman: EthYeeter;
    let sharesToken: Shares;
    let govLootToken: GovernorLoot;

    const boostFees = "5000"; // 0.5% fee

    const usersToYeet = 5;
    let yeetedValue: BigNumber;

    beforeEach(async () => {
      signer = await ethers.getSigner(users.owner.address);

      const predictedBaalAddress = await calculateBaalAddress({
        yeet24Summoner: summoner.address,
        saltNonce,
      });
      // console.log("predictedBaalAddress", predictedBaalAddress);

      const predictedAvatarAddress = await calculateSafeProxyAddress({
        gnosisSafeProxyFactory: safeProxyFactory,
        masterCopyAddress: safeMastercopy.address,
        saltNonce,
      });
      // console.log("predictedAvatarAddress", predictedAvatarAddress);

      const customYeet24ShamanParams = {
        ...yeet24ShamanParams,
        boostRewardsPoolAddress: boostRewardsPoolSafe.address as `0x${string}`, // NOTICE: plug-in boostRewardsPool
      };

      const yeet24ShamanSalt = generateShamanSaltNonce({
        baalAddress: predictedBaalAddress,
        index: "0",
        initializeParams: assembleYeet24ShamanParams(customYeet24ShamanParams),
        saltNonce,
        shamanPermissions: YEET24_SHAMAN_PERMISSIONS,
        shamanTemplate: yeet24Singleton,
      });
      // console.log("yeet24ShamanSalt", yeet24ShamanSalt);

      const predictedYeet24ShamanAddress = await calculateHOSShamanAddress({
        saltNonce: yeet24ShamanSalt,
        shamanSingleton: yeet24Singleton,
        hosSummoner: summoner.address,
      });
      // console.log("predictedYeet24ShamanAddress", predictedYeet24ShamanAddress);

      const feeAmounts = [...yeeterShamanParams.feeAmounts, boostFees];

      const customYeeterShamanParams = {
        ...yeeterShamanParams,
        feeRecipients: [...yeeterShamanParams.feeRecipients, predictedYeet24ShamanAddress as `0x${string}`],
        feeAmounts,
      };

      const yeeterShamanSalt = generateShamanSaltNonce({
        baalAddress: predictedBaalAddress,
        index: "1",
        initializeParams: assembleYeeterShamanParams(customYeeterShamanParams),
        saltNonce,
        shamanPermissions: YEETER_SHAMAN_PERMISSIONS,
        shamanTemplate: yeeterSingleton,
      });
      // console.log("yeeterShamanSalt", yeeterShamanSalt);

      const predictedYeeterShamanAddress = await calculateHOSShamanAddress({
        saltNonce: yeeterShamanSalt,
        shamanSingleton: yeeterSingleton,
        hosSummoner: summoner.address,
      });
      // console.log("predictedYeeterShamanAddress", predictedYeeterShamanAddress);

      totalFees = feeAmounts.reduce((a, b) => Number(a) + Number(b), 0);

      const summonParams = await assembleYeet24SummonerArgs({
        avatarAddress: predictedAvatarAddress,
        daoName: "Yeet24",
        lootConfig: {
          singleton: govLoot.address as `0x${string}`,
          tokenSymbol: "LMEME",
          paused: true,
        },
        metadataConfigParams: {
          ...defaultBaalMetadata,
          daoId: predictedBaalAddress as `0x${string}`,
          authorAddress: users.owner.address as `0x${string}`,
          posterAddress: poster.address,
        },
        saltNonce,
        shamanZodiacModuleAddress: predictedYeet24ShamanAddress,
        sharesConfig: {
          singleton: shares.address as `0x${string}`,
          tokenSymbol: "SMEME",
          paused: true,
        },
        summonParams: DEFAULT_SUMMON_VALUES,
        yeet24Params: customYeet24ShamanParams,
        yeet24Singleton,
        yeeterParams: customYeeterShamanParams,
        yeeterSingleton,
      });
      await summoner.summonBaalFromReferrer(
        summonParams[0] as string,
        summonParams[1] as string,
        summonParams[2] as string,
        summonParams[3] as string[],
        summonParams[4] as string,
      );
      avatar = (await ethers.getContractAt("GnosisSafe", predictedAvatarAddress, signer)) as GnosisSafe;
      baal = (await ethers.getContractAt("Baal", predictedBaalAddress, signer)) as Baal;
      yeet24Shaman = (await ethers.getContractAt(
        "Yeet24ShamanModule",
        predictedYeet24ShamanAddress,
        signer,
      )) as Yeet24ShamanModule;
      yeeterShaman = (await ethers.getContractAt("EthYeeter", predictedYeeterShamanAddress, signer)) as EthYeeter;
      govLootToken = (await ethers.getContractAt("GovernorLoot", await baal.lootToken(), signer)) as GovernorLoot;
      sharesToken = (await ethers.getContractAt("Shares", await baal.sharesToken(), signer)) as Shares;

      // yeet some funds
      //////////////////////
      const index = 5;
      const yeetUsers = (await getUnnamedAccounts()).slice(index, index + usersToYeet);
      for (let i = 0; i < yeetUsers.length; i++) {
        const user = await ethers.getSigner(yeetUsers[i]);
        const tx = await user.sendTransaction({
          to: yeeterShaman.address,
          value: yeeterShamanParams.minTribute,
          data: "0x",
        });
        await tx.wait();
      }
      yeetedValue = BigNumber.from(yeeterShamanParams.minTribute).mul(BigNumber.from(yeetUsers.length));
    });

    it("Should have everything setup", async () => {
      // Yeet24 config params
      expect(await yeet24Shaman.boostRewardsPool()).to.be.equal(boostRewardsPoolSafe.address);

      // Yeeter config params
      expect(await yeeterShaman.feeRecipients(0)).to.be.equal(yeeterShamanParams.feeRecipients[0]);
      expect(await yeeterShaman.feeRecipients(1)).to.be.equal(yeeterShamanParams.feeRecipients[1]);
      expect(await yeeterShaman.feeRecipients(2)).to.be.equal(yeet24Shaman.address);
      expect(await yeeterShaman.feeAmounts(0)).to.be.equal(yeeterShamanParams.feeAmounts[0]);
      expect(await yeeterShaman.feeAmounts(1)).to.be.equal(yeeterShamanParams.feeAmounts[1]);
      expect(await yeeterShaman.feeAmounts(2)).to.be.equal("5000");

      // Yeeter state
      const feesCut = yeetedValue.div(1e6).mul(totalFees);
      const boostRewardsFromFees = yeetedValue.div(1e6).mul(boostFees);
      const receivedAmount = yeetedValue.sub(feesCut);
      expect(await yeeterShaman.balance()).to.be.equal(yeetedValue);
      expect(await ethers.provider.getBalance(avatar.address)).to.be.equal(receivedAmount);
      expect(await ethers.provider.getBalance(yeet24Shaman.address)).to.be.equal(boostRewardsFromFees);
    });

    it("Should be able to receive boosting funds from a rewards pool", async () => {
      const poolBalanceBefore = await ethers.provider.getBalance(boostRewardsPoolSafe.address);
      const yeet24BalanceBefore = await ethers.provider.getBalance(yeet24Shaman.address);
      const accounts = config.networks.hardhat.accounts as any;
      const index = 0; // first wallet, increment for next wallets
      const wallet1 = ethers.Wallet.fromMnemonic(accounts.mnemonic, accounts.path + `/${index}`);
      expect(wallet1.address).to.be.equal(users.owner.address);

      const tx = await executeSafeTx({
        safe: boostRewardsPoolSafe,
        to: yeet24Shaman.address,
        value: poolBalanceBefore,
        signers: [wallet1.connect(ethers.provider)],
      });

      expect(await ethers.provider.getBalance(boostRewardsPoolSafe.address)).to.be.equal(0);
      expect(await ethers.provider.getBalance(yeet24Shaman.address)).to.be.equal(
        yeet24BalanceBefore.add(poolBalanceBefore),
      );

      await expect(tx)
        .to.emit(yeet24Shaman, "BoostRewardsDeposited")
        .withArgs(boostRewardsPoolSafe.address, poolBalanceBefore);
    });

    it("Should fail to meet goal and forward boosted fund fees to to the boost rewards pool", async () => {
      const feesCut = yeetedValue.div(1e6).mul(totalFees);
      const receivedAmount = yeetedValue.sub(feesCut);
      const boostRewardsFromFees = yeetedValue.div(1e6).mul(boostFees);
      const rewardsPoolBalanceBefore = await ethers.provider.getBalance(boostRewardsPoolSafe.address);

      await time.setNextBlockTimestamp(BigNumber.from(yeet24ShamanParams.endTimeInSeconds).add(1));

      expect(await ethers.provider.getBalance(avatar.address)).to.be.lessThan(yeet24ShamanParams.goal);

      const tx = await yeet24Shaman.execute();

      // ExecutionFailed(yeethBalance, boostRewards, transferSuccess);
      await expect(tx).to.emit(yeet24Shaman, "ExecutionFailed").withArgs(receivedAmount, boostRewardsFromFees, true);
      expect(await yeet24Shaman.executed()).to.be.true;
      expect(await yeet24Shaman.goalAchieved()).to.be.false;
      expect(await yeet24Shaman.balance()).to.be.equal(0);
      expect(await ethers.provider.getBalance(boostRewardsPoolSafe.address)).to.be.equal(
        rewardsPoolBalanceBefore.add(boostRewardsFromFees),
      );
      expect(await ethers.provider.getBalance(yeet24Shaman.address)).to.be.equal(0);
    });

    it("Should execute successfully and create pool position with boosted funds", async () => {
      // yeet some more funds to get to the goal
      //////////////////////
      const index = 10;
      const yeetUsers = (await getUnnamedAccounts()).slice(index, index + usersToYeet + 1); // one user extra to get to the goal - fees
      for (let i = 0; i < yeetUsers.length; i++) {
        const user = await ethers.getSigner(yeetUsers[i]);
        const tx = await user.sendTransaction({
          to: yeeterShaman.address,
          value: yeeterShamanParams.minTribute,
          data: "0x",
        });
        await tx.wait();
      }
      const yeetBalance = yeetedValue.add(
        BigNumber.from(yeeterShamanParams.minTribute).mul(BigNumber.from(yeetUsers.length)),
      );

      // add some boost rewards from pool
      //////////////////////
      const boostFunds = await ethers.provider.getBalance(boostRewardsPoolSafe.address);
      const accounts = config.networks.hardhat.accounts as any;
      const wallet1 = ethers.Wallet.fromMnemonic(accounts.mnemonic, accounts.path + "/0");

      const poolTx = await executeSafeTx({
        safe: boostRewardsPoolSafe,
        to: yeet24Shaman.address,
        value: boostFunds,
        signers: [wallet1.connect(ethers.provider)],
      });
      await poolTx.wait();

      // calculate amounts
      //////////////////////
      const boostRewardsFromFees = yeetBalance.div(1e6).mul(boostFees);
      const boostRewards = boostRewardsFromFees.add(boostFunds); // NOTICE: add boost rewards from pool

      const feesCut = yeetBalance.div(1e6).mul(totalFees);
      const receivedAmount = yeetBalance.sub(feesCut).add(boostRewards); // NOTICE: yeetBalance + boostRewards

      const rewardsPoolBalanceBefore = await ethers.provider.getBalance(boostRewardsPoolSafe.address);
      const sharesSupplyBefore = await sharesToken.totalSupply();

      // console.log("Calculated funds", yeetBalance.toString(), feesCut.toString(), boostRewards.toString(), receivedAmount.toString());
      // console.log("Goal", yeet24ShamanParams.goal.toString());
      // console.log("vault balance", (await ethers.provider.getBalance(avatar.address)).toString());
      // console.log("yeet24 balance", (await ethers.provider.getBalance(yeet24Shaman.address)).toString());
      // console.log("rewardsPool balance", rewardsPoolBalanceBefore.toString());
      // console.log("yeet goal", await yeeterShaman.goalAchieved());
      // console.log("yeet24 goal", await yeet24Shaman.goalAchieved());

      await time.setNextBlockTimestamp(BigNumber.from(yeet24ShamanParams.endTimeInSeconds).add(1));

      expect(await ethers.provider.getBalance(avatar.address)).to.be.greaterThanOrEqual(yeet24ShamanParams.goal);

      const tx = await yeet24Shaman.execute();
      const receipt = await tx.wait();

      // ExecutionFailed(yeethBalance, boostRewards, transferSuccess);
      await expect(tx)
        .to.emit(yeet24Shaman, "Executed")
        .withArgs(await baal.sharesToken(), sharesSupplyBefore, receivedAmount, boostRewards);
      // ManagerShaman action: mint 100% shares to this contract. this doubles the total shares
      await expect(tx)
        .to.emit(sharesToken, "Transfer")
        .withArgs(ethers.constants.AddressZero, yeet24Shaman.address, sharesSupplyBefore);

      const positionLog = ifaceYeet24.parseLog(
        receipt.logs.filter(
          (l) =>
            l.address === yeet24Shaman.address &&
            l.topics[0] === "0xa99a6875308aea6e18b918455ff8cd4633862a798bb7a5e9f21fd78b5a1189f2",
        )[0],
      );
      expect(await sharesToken.totalSupply()).to.be.equal(
        sharesSupplyBefore.add(
          BigNumber.from(sharesToken.address < weth.address ? positionLog.args.amount0 : positionLog.args.amount1),
        ),
      );

      // minted shares are used to mint UniV3 position
      expect(await sharesToken.balanceOf(yeet24Shaman.address)).to.be.equal(0);

      // AdminShaman action: Make shares/loot transferrable
      await expect(tx).to.emit(baal, "SharesPaused").withArgs(false);
      expect(await sharesToken.paused()).to.be.false;
      await expect(tx).to.emit(baal, "LootPaused").withArgs(false);
      expect(await govLootToken.paused()).to.be.false;

      // Shaman action: if any boostRewards (e.g. fees + extra boostRewardsPool deposits) are available,
      // forward balance to the vault in charge of minting the pool initial liquidity position
      expect(await ethers.provider.getBalance(yeet24Shaman.address)).to.be.equal(0);
      expect(await ethers.provider.getBalance(boostRewardsPoolSafe.address)).to.be.equal(rewardsPoolBalanceBefore); // nothing is transferred back to the pool

      // ZodiacModuleShaman action: execute multiSend to
      //  - wrap ETH collected in vault
      await expect(tx).to.emit(weth, "Deposit").withArgs(avatar.address, receivedAmount);
      //  - transfer WETH from vault to shaman
      await expect(tx).to.emit(weth, "Transfer").withArgs(avatar.address, yeet24Shaman.address, receivedAmount);
      // transferred weth is used to mint UniV3 position
      expect(await weth.balanceOf(yeet24Shaman.address)).to.be.equal(0);
      //  - call shaman.createPoolAndMintPosition
      await expect(tx).to.emit(yeet24Shaman, "UniswapPositionCreated");

      // state checks
      expect(await yeet24Shaman.executed()).to.be.true;
      expect(await yeet24Shaman.goalAchieved()).to.be.true;
      expect(await yeet24Shaman.pool()).to.not.be.equal(ethers.constants.AddressZero);
      expect(await yeet24Shaman.balance()).to.be.equal(receivedAmount);
      const positionId = await yeet24Shaman.positionId();
      expect(positionId).to.be.gt(0);
      // TODO: check token refunds after position is minted
      //
      expect(await nonFungiblePositionManager.ownerOf(positionId)).to.be.equal(avatar.address);
    });
  });
});
