import { Baal, BaalAndVaultSummoner, BaalSummoner, Loot, Poster, Shares } from "@daohaus/baal-contracts";
import { calculateSafeProxyAddress, getSaltNonce } from "@daohaus/baal-contracts/hardhat";
import { expect } from "chai";
import { Signer } from "ethers";
import { deployments, ethers, network } from "hardhat";

import { ExampleShaman, GnosisSafe, GnosisSafeProxyFactory, Yeet24HOS } from "../../types";
import { User, shamanFixture } from "../Shaman.fixture";
import { getNetworkConfig } from "../utils";
import {
  DEFAULT_SUMMON_VALUES,
  calculateBaalAddress,
  calculateHOSShamanAddress,
  generateShamanSaltNonce,
} from "../utils/hos";
import { SHAMAN_NAME, SHAMAN_PERMISSIONS, assembleYeet24SummonerArgs } from "./utils";

describe("ExampleShaman", function () {
  let shares: Shares;
  let loot: Loot;
  let poster: Poster;
  let safeProxyFactory: GnosisSafeProxyFactory;
  let safeMastercopy: GnosisSafe;
  // let multisend: MultiSend;

  let baalSummoner: BaalSummoner;
  let summoner: Yeet24HOS;
  let shamanSingleton: string;

  const defaultBaalMetadata = {
    name: "HOSDAO",
    description: "HOS Dao",
    longDescription: "",
    avatarImg: "", // TODO: is this the right field?
    title: "Hardhat HOS DAO",
    tags: ["YEET24", "Incarnation", "topic"],
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
    const networkConfig = getNetworkConfig();
    const infraFixtureTags =
      network.name === "hardhat" && !networkConfig.forking ? ["Infra", "BaalSummoner", "BaalAndVaultSummoner"] : [];
    const fixtureTags = [...infraFixtureTags, "ExampleShaman"];
    const setup = await shamanFixture({
      deployShamanContracts: {
        exampleShaman: {
          contract: "ExampleShaman",
          contractName: "ExampleShaman",
        },
      },
      fixtureTags,
    });
    // const shamans = setup.shamans;
    users = setup.users;

    safeProxyFactory = setup.safe.safeProxyFactory;
    safeMastercopy = setup.safe.masterCopy;
    // multisend = setup.safe.multisend;

    const hosDeployed = await deployments.get("Yeet24HOS");
    const lootDeployed = await deployments.get("Loot");

    shamanSingleton = (await deployments.get("ExampleShaman")).address;

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
    loot = (await ethers.getContractAt("Loot", lootDeployed.address)) as Loot;
    poster = setup.baalContracts.poster;

    // Build Shaman params
  });

  describe("ExampleShaman behavior", function () {
    const saltNonce = getSaltNonce();
    let avatar: GnosisSafe;
    let baal: Baal;
    let signer: Signer;
    let exampleShaman: ExampleShaman;
    // let sharesToken: Shares;
    // let lootToken: Loot;

    let summonBlockNo: number;

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

      const exampleShamanSalt = generateShamanSaltNonce({
        baalAddress: predictedBaalAddress,
        index: "0",
        initializeParams: "0x", // NOTICE: no params
        saltNonce,
        shamanPermissions: SHAMAN_PERMISSIONS,
        shamanTemplate: shamanSingleton,
      });
      // console.log("exampleShamanSalt", exampleShamanSalt);

      const predictedShamanAddress = await calculateHOSShamanAddress({
        saltNonce: exampleShamanSalt,
        shamanSingleton: shamanSingleton,
        hosSummoner: summoner.address,
      });
      // console.log("predictedShamanAddress", predictedShamanAddress);

      const summonParams = await assembleYeet24SummonerArgs({
        avatarAddress: predictedAvatarAddress,
        daoName: "Yeet24",
        lootConfig: {
          singleton: loot.address as `0x${string}`,
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
        shamanZodiacModuleAddress: predictedShamanAddress,
        sharesConfig: {
          singleton: shares.address as `0x${string}`,
          tokenSymbol: "SMEME",
          paused: true,
        },
        summonParams: DEFAULT_SUMMON_VALUES,
        shamanInitParams: "0x", // NOTICE: no params
        shamanSingleton,
      });
      const tx = await summoner.summonBaalFromReferrer(
        summonParams[0] as string,
        summonParams[1] as string,
        summonParams[2] as string,
        summonParams[3] as string[],
        summonParams[4] as string,
      );
      summonBlockNo = tx.blockNumber || 0;
      avatar = (await ethers.getContractAt("GnosisSafe", predictedAvatarAddress, signer)) as GnosisSafe;
      baal = (await ethers.getContractAt("Baal", predictedBaalAddress, signer)) as Baal;
      exampleShaman = (await ethers.getContractAt("ExampleShaman", predictedShamanAddress, signer)) as ExampleShaman;
      // lootToken = (await ethers.getContractAt("Loot", await baal.lootToken(), signer)) as Loot;
      // sharesToken = (await ethers.getContractAt("Shares", await baal.sharesToken(), signer)) as Shares;
    });

    it("Should have everything setup", async () => {
      // console.log("admin", await exampleShaman.adminShamanId());
      // console.log("governor", await exampleShaman.governorShamanId());
      // console.log("manager", await exampleShaman.managerShamanId());
      // console.log("zodiac", await exampleShaman.zodiacModuleId());
      // console.log("shaman", await exampleShaman.shamanId(), "\n\n");

      // Shaman interface
      expect(await exampleShaman.supportsInterface("0xd2296f8d")).to.be.true;

      // Admin interface
      expect(await baal.isAdmin(exampleShaman.address)).to.be.true;
      expect(await exampleShaman.supportsInterface("0xb3b0786d")).to.be.true;

      // Manager interface
      expect(await baal.isManager(exampleShaman.address)).to.be.true;
      expect(await exampleShaman.supportsInterface("0xf7c8b398")).to.be.true;

      // Governor interface
      expect(await baal.isGovernor(exampleShaman.address)).to.be.true;
      expect(await exampleShaman.supportsInterface("0x09238d57")).to.be.true;

      // ZodiacModule interface
      expect(await avatar.isModuleEnabled(exampleShaman.address)).to.be.true;
      expect(await exampleShaman.supportsInterface("0x8195a8d8")).to.be.true;

      expect(await exampleShaman.name()).to.be.equal(SHAMAN_NAME);
    });

    it("Should be initialized with tx block number", async () => {
      expect(await exampleShaman.blockNo()).to.be.equal(summonBlockNo);
    });
  });
});
