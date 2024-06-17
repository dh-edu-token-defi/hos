import { Baal, BaalAndVaultSummoner, BaalSummoner, MultiSend, Poster, Shares } from "@daohaus/baal-contracts";
import { ProposalType, calculateSafeProxyAddress, getSaltNonce } from "@daohaus/baal-contracts/hardhat";
import { expect } from "chai";
import { BigNumber, BigNumberish, Signer } from "ethers";
import { deployments, ethers, getNamedAccounts, getUnnamedAccounts, network } from "hardhat";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { impersonateAccount, reset, setBalance, stopImpersonatingAccount, time } from "@nomicfoundation/hardhat-network-helpers";

import { YEET24_SHAMAN_PERMISSIONS, Yeet24Params, assembleYeet24ShamanParams, assembleYeet24SummonerArgs } from "./utils";
import { User, shamanFixture } from "../Shaman.fixture";
import { calculateBaalAddress, calculateHOSShamanAddress, DEFAULT_SUMMON_VALUES, generateShamanSaltNonce } from "../utils/hos";
import { deployUniV3Infra } from "../utils/uniswapv3";
import { assembleYeeterShamanParams, YEETER_SHAMAN_PERMISSIONS, YeeterParams } from "../utils/yeeter";

import { EthYeeter, GnosisSafe, GnosisSafeProxyFactory, GovernorLoot, INonfungiblePositionManager, WETH, Yeet24HOS, Yeet24ShamanModule } from "../../types";

describe("Yeet24ShamanModule", function () {
  let shares: Shares;
  let govLoot: GovernorLoot;
  let poster: Poster;
  let safeProxyFactory: GnosisSafeProxyFactory;
  let safeMastercopy: GnosisSafe;
  let multisend: MultiSend;
  let weth: WETH;

  let nonFungiblePositionManager: INonfungiblePositionManager;

  let baalSummoner: BaalSummoner;
  let summoner: Yeet24HOS;
  let yeet24Singleton: string;
  let yeeterSingleton: string;

  const defaultBaalMetadata = { 
    name: 'HOSDAO',
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

  const YEET24SHAMAN_NAME = "Yeet24ShamanModule";

  const defaultYeet24ShamanParams = {
    poolFee: BigNumber.from("10000"),
  };

  let yeet24ShamanParams: Yeet24Params;

  const proposal: ProposalType = {
    flag: 0,
    data: "0x",
    details: "test proposal",
    expiration: 0,
    baalGas: 0,
  };

  let users: { [key: string]: User };

  this.beforeAll(async function () {
    // // NOTICE: reset network
    // await network.provider.request({
    //   method: "hardhat_reset",
    //   params: [],
    // });
    // await reset(); // TODO:
  });

  beforeEach(async function () {
    const setup = await shamanFixture({
        deployShamanContracts: {
            yeet24ShamanModule: {
                contract: "Yeet24ShamanModule",
                contractName: "Yeet24ShamanModule",
            },
        },
        fixtureTags: [
            "Infra",
            "BaalSummoner",
            "BaalAndVaultSummoner",
            "GovernorLoot",
            "Yeeter2",
            "Yeet24ShamanModule",
            "Yeet24HOS"
        ],
    });
    const shamans = setup.shamans;
    users = setup.users;

    safeProxyFactory = setup.safe.safeProxyFactory;
    safeMastercopy = setup.safe.masterCopy;
    multisend = setup.safe.multisend;


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
    const sharesDeployed = await deployments.get("Shares");
    const posterDeployed = await deployments.get("Poster");

    yeet24Singleton = (await deployments.get("Yeet24ShamanModule")).address;
    yeeterSingleton = (await deployments.get("EthYeeter")).address;

    // console.log("SETUP", Object.keys(shamans), hosDeployed.address, govLootDeployed.address);

    const signer = await ethers.getSigner(users.owner.address);

    // get summoner contracts
    summoner = (await ethers.getContractAt("Yeet24HOS", hosDeployed.address, signer)) as Yeet24HOS;
    const bvSummoner = (await ethers.getContractAt("BaalAndVaultSummoner", await summoner.baalVaultSummoner())) as BaalAndVaultSummoner;
    baalSummoner = (await ethers.getContractAt("BaalSummoner", await bvSummoner._baalSummoner())) as BaalSummoner;
    shares = (await ethers.getContractAt("Shares", sharesDeployed.address)) as Shares;
    govLoot = (await ethers.getContractAt("GovernorLoot", govLootDeployed.address)) as GovernorLoot;
    poster = (await ethers.getContractAt("Poster", posterDeployed.address)) as Poster;

    // deploy UniV3 infra
    const {
        nftpManager,
        WETH,
    } = await deployUniV3Infra();
    // console.log("UniV3", nftpManager.address, WETH.address);

    yeeterShamanParams = {
      ...defaultYeeterShamanParams,
      feeRecipients: [
        users.hausEcoFund.address as `0x${string}`,
        users.yeeterTeam.address as `0x${string}`,
      ], // yeeter team, daohaus eco fund
      startTimeInSeconds: await time.latest(),
      // five days since initialDate. See hardhat network config
      endTimeInSeconds: new Date("2024-06-05T00:00:00.000-05:00").getTime() / 1000, 
    };

    yeet24ShamanParams = {
      ...defaultYeet24ShamanParams,
      endTimeInSeconds: yeeterShamanParams.endTimeInSeconds, // should match yeeter
      goal: yeeterShamanParams.goal, // should match yeeter
      nonFungiblePositionManager: nftpManager.address as `0x${string}`,
      weth9: WETH.address as `0x${string}`,
    };

    console.log(
      "yeet24ShamanParams endTime",
      await time.latest(),
      yeet24ShamanParams.endTimeInSeconds,
      Number(yeet24ShamanParams.endTimeInSeconds) > await time.latest()
    );

    weth = (await ethers.getContractAt("WETH", WETH.address, signer)) as WETH;
    const wethDepositTx = await weth.deposit({ value: ethers.utils.parseEther("10") });
    await wethDepositTx.wait();

    nonFungiblePositionManager = (await ethers.getContractAt("INonfungiblePositionManager", nftpManager.address)) as INonfungiblePositionManager;

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

      await expect(summonTx).to.emit(baalSummoner, "DeployBaalSafe").withArgs(
        predictedAvatarAddress,
        predictedBaalAddress,
      );
      await expect(summonTx).to.emit(baalSummoner, "SummonBaal").withArgs(
        predictedBaalAddress,
        anyValue,
        anyValue,
        predictedAvatarAddress,
        ethers.constants.AddressZero,
        "1"
      );
      const avatarContract = (await ethers.getContractAt("GnosisSafe", predictedAvatarAddress)) as GnosisSafe;
      const baalContract = (await ethers.getContractAt("Baal", predictedBaalAddress)) as Baal;

      await expect(summonTx).to.emit(baalContract, "ShamanSet").withArgs(predictedYeet24ShamanAddress, YEET24_SHAMAN_PERMISSIONS);      
      await expect(summonTx).to.emit(avatarContract, "EnabledModule").withArgs(predictedYeet24ShamanAddress);

      const yeet24Shaman = (await ethers.getContractAt("Yeet24ShamanModule", predictedYeet24ShamanAddress)) as Yeet24ShamanModule;
      // Setup(address indexed baal, address indexed vault, uint256 threshold, uint256 expiration, uint256 poolFee);
      await expect(summonTx).to.emit(yeet24Shaman, "Setup").withArgs(
        predictedBaalAddress,
        predictedAvatarAddress,
        yeet24ShamanParams.goal,
        yeet24ShamanParams.endTimeInSeconds,
        yeet24ShamanParams.poolFee
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
      await expect(summonTx).to.emit(baalContract, "ShamanSet").withArgs(predictedYeeterShamanAddress, YEETER_SHAMAN_PERMISSIONS);
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

    beforeEach(async() => {
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
      yeet24Shaman = (await ethers.getContractAt("Yeet24ShamanModule", predictedYeet24ShamanAddress, signer)) as Yeet24ShamanModule;
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
      expect(await yeet24Shaman.poolFee()).to.be.equal(yeet24ShamanParams.poolFee)
      expect(await yeet24Shaman.nonfungiblePositionManager()).to.be.equal(yeet24ShamanParams.nonFungiblePositionManager);
      expect(await yeet24Shaman.weth()).to.be.equal(yeet24ShamanParams.weth9);

      // UniV3 Pool
      expect(await yeet24Shaman.pool()).to.be.equal(ethers.constants.AddressZero);
      expect(await yeet24Shaman.positionId()).to.be.equal(BigNumber.from(0));

      // ShamanBase
      expect(await yeet24Shaman.baal()).to.be.equal(baal.address);
      expect(await yeet24Shaman.name()).to.be.equal(YEET24SHAMAN_NAME);
      expect(await yeet24Shaman.vault()).to.be.equal(avatar.address);
      expect(await baal.isAdmin(yeet24Shaman.address)).to.be.true;
      expect(await baal.isManager(yeet24Shaman.address)).to.be.true;

      // ZodiacModule
      expect(await yeet24Shaman.avatar()).to.be.equal(avatar.address);
      expect(await yeet24Shaman.target()).to.be.equal(avatar.address);
      expect(await yeet24Shaman.owner()).to.be.equal(avatar.address);
      expect(await yeet24Shaman.moduleEnabled()).to.be.true;
      expect(await avatar.isModuleEnabled(yeet24Shaman.address)).to.be.true;

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
      expect(await baal.isManager(yeeterShaman.address)).to.be.true;
    });

    // TODO: yeeter un-happy paths

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
      await expect(tx).to.emit(yeeterShaman, "OnReceived").withArgs(
        signer.address,
        tx.value,
        mintedTokens,
        baal.address,
        avatar.address,
        ""
      );
      if (isShares) {
        expect(tx).to.emit(shares, "Transfer").withArgs(ethers.constants.AddressZero, signer.address, mintedTokens);
        expect(await sharesToken.balanceOf(signer.address)).to.be.equal(mintedTokens);
      } else {
        expect(tx).to.emit(govLootToken, "Transfer").withArgs(ethers.constants.AddressZero, signer.address, mintedTokens);
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
        (await yeet24Shaman.endTime()).gt(await time.latest())
      );
      await expect(yeet24Shaman.execute()).to.be.revertedWithCustomError(yeet24Shaman, "Yeet24ShamanModule__YeetNotFinished");
    });

    it("Should not be able to execute if yeeter campaign has not met threshold", async () => {
      console.log(
        "Time state",
        await time.latest(),
        (await yeet24Shaman.endTime()).toString(),
        (await yeet24Shaman.endTime()).gt(await time.latest())
      );
      await time.setNextBlockTimestamp(BigNumber.from(yeet24ShamanParams.endTimeInSeconds).add(1));
      await expect(yeet24Shaman.execute()).to.be.revertedWithCustomError(yeet24Shaman, "Yeet24ShamanModule__ThresholdNotMet");
    });

    it("Should be able to mint and create position", async () => {
      // mock yeet24 weth and sharesToken balance
      const sharesToMint = ethers.utils.parseEther("10");
      const wethBalance = ethers.utils.parseEther("1");
      expect (await sharesToken.balanceOf(yeet24Shaman.address)).to.be.equal(0);
      expect (await weth.balanceOf(yeet24Shaman.address)).to.be.equal(0);
      
      // yeet24 gets some WETH
      const txWethTransfer = await weth.transfer(yeet24Shaman.address, wethBalance);
      await txWethTransfer.wait();
      expect (await weth.balanceOf(yeet24Shaman.address)).to.be.equal(wethBalance);

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

      const tx = await yeet24Shaman.connect(signer).createPoolAndMintPosition(
        sharesToken.address,
        weth.address,
        sharesToMint,
        wethBalance
      );

      // UniswapPositionCreated(pool, tokenId, sqrtPriceX96, liquidity, amount0, amount1)
      await expect(tx).to.emit(yeet24Shaman, "UniswapPositionCreated");

      await stopImpersonatingAccount(avatar.address);
      ///// stop impersonating
    });

    it("Should be able to execute if yeeter campaign finished and meet threshold", async () => {
      console.log(
        "Time state",
        await time.latest(),
        (await yeet24Shaman.endTime()).toString(),
        (await yeet24Shaman.endTime()).gt(await time.latest())
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

      const tx = yeet24Shaman.execute();

      // Calculate effective eth collected after yeet campaign
      const totalYeeted =  BigNumber.from(yeeterShamanParams.goal).mul(2);
      const feesCut = totalYeeted.div(1e6).mul(totalFees);
      const collectedAmount = totalYeeted.sub(feesCut);

      await expect(tx).to.emit(yeet24Shaman, "Executed").withArgs(
        await baal.sharesToken(),
        sharesSupplyBefore,
        collectedAmount,
      );
      // ManagerShaman action: mint 100% shares to this contract. this doubles the total shares
      await expect(tx).to.emit(sharesToken, "Transfer").withArgs(
        ethers.constants.AddressZero,
        yeet24Shaman.address,
        sharesSupplyBefore
      );
      expect(await sharesToken.totalSupply()).to.be.equal(sharesSupplyBefore.mul(2));
      // minted shares are used to mint UniV3 position
      expect(await sharesToken.balanceOf(yeet24Shaman.address)).to.be.equal(0);

      // AdminShaman action: Make shares/loot transferrable
      await expect(tx).to.emit(baal, "SharesPaused").withArgs(false);
      expect(await sharesToken.paused()).to.be.false;
      await expect(tx).to.emit(baal, "LootPaused").withArgs(false);
      expect(await govLootToken.paused()).to.be.false;

      // ZodiacModuleShaman action: execute multiSend to
      //  - wrap ETH collected in vault
      await expect(tx).to.emit(weth, "Deposit").withArgs(avatar.address, collectedAmount);
      //  - transfer WETH from vault to shaman
      await expect(tx).to.emit(weth, "Transfer").withArgs(
        avatar.address,
        yeet24Shaman.address,
        collectedAmount
      );
      // transferred weth is used to mint UniV3 position
      expect(await weth.balanceOf(yeet24Shaman.address)).to.be.equal(0);
      //  - call shaman.createPoolAndMintPosition
      await expect(tx).to.emit(yeet24Shaman, "UniswapPositionCreated");
      expect(await yeet24Shaman.pool()).to.not.be.equal(ethers.constants.AddressZero);
      const positionId = await yeet24Shaman.positionId();
      expect(positionId).to.be.gt(0);
      // TODO: check token refunds after position is minted
      //
      expect(await nonFungiblePositionManager.ownerOf(positionId)).to.be.equal(avatar.address);
    });

  });
});
