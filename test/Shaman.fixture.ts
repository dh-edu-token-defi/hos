import { DEPLOYMENT_ADDRESSES, Loot, Poster, Shares, getSetupAddresses } from "@daohaus/baal-contracts";
import { deployments } from "hardhat";
import { Deployment, ProxyOptions } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { CompatibilityFallbackHandler, GnosisSafe, GnosisSafeProxyFactory, MultiSend, ShamanBase } from "../types";
import { getNetworkConfig } from "./utils";

export type ContractSetup = {
  contract: string;
  contractName: string;
  args?: Array<any>;
  proxy?: ProxyOptions;
};

export type Opts = {
  fixtureTags?: Array<string>;
  deployShamanContracts: {
    [name: string]: ContractSetup;
  };
};

export type User = {
  address: string;
};

export type BaalInfra = {
  lootSingleton: Loot;
  poster: Poster;
  sharesSingleton: Shares;
  // tributeMinion: TributeMinion;
};

export type SafeInfra = {
  fallbackHandler: CompatibilityFallbackHandler;
  safeProxyFactory: GnosisSafeProxyFactory;
  masterCopy: GnosisSafe;
  multisend: MultiSend;
};

export type NetworkRegistryProps = {
  baalContracts: BaalInfra;
  deployedFromFixtures: {
    [name: string]: Deployment;
  };
  safe: SafeInfra;
  shamans: {
    [name: string]: ShamanBase;
  };
};

export type ShamanSetup = NetworkRegistryProps & {
  users: {
    [key: string]: User;
  };
};

export const shamanFixture = deployments.createFixture<ShamanSetup, Opts>(
  async (hre: HardhatRuntimeEnvironment, opts?: Opts) => {
    const { ethers, getChainId, getNamedAccounts, getUnnamedAccounts, network } = hre;
    const { deployer } = await getNamedAccounts();
    const [applicant, alice, bob, hausEcoFund, yeeterTeam] = await getUnnamedAccounts();

    const chainId = await getChainId();

    const networkConfig = getNetworkConfig();
    // console.log("NETWORK ******", network.name, networkConfig.forking?.enabled);

    const signer = await ethers.getSigner(deployer);

    // TODO:
    let deployedFromFixtures: {
      [name: string]: Deployment;
    } = {};
    if (opts?.fixtureTags) {
      deployedFromFixtures = await deployments.fixture(opts.fixtureTags);
    }
    //////////////

    const forkedNetwork = network.name === "buildbear" || networkConfig.forking?.enabled;

    // Get setup addresses
    // NOTICE: default to Optimism private fork
    const setupChainId = forkedNetwork ? "10" : chainId;
    const setupAddresses = await getSetupAddresses(
      setupChainId,
      {
        ...network,
        name: forkedNetwork ? "forked" : network.name,
      },
      deployments,
    );

    // Get Safe infra
    let safe: SafeInfra = {
      fallbackHandler: (await ethers.getContractAt(
        "CompatibilityFallbackHandler",
        setupAddresses.gnosisFallbackLibrary,
        deployer,
      )) as CompatibilityFallbackHandler,
      safeProxyFactory: (await ethers.getContractAt(
        "GnosisSafeProxyFactory",
        setupAddresses.gnosisSafeProxyFactory,
        deployer,
      )) as GnosisSafeProxyFactory,
      masterCopy: (await ethers.getContractAt("GnosisSafe", setupAddresses.gnosisSingleton, deployer)) as GnosisSafe,
      multisend: (await ethers.getContractAt(
        "MultiSend",
        setupAddresses.gnosisMultisendLibrary,
        deployer,
      )) as MultiSend,
    };

    let baalContracts: BaalInfra;
    if (forkedNetwork) {
      // NOTICE: default to Optimism private fork
      const baalSetupAddresses = DEPLOYMENT_ADDRESSES[0].v103.optimisticEthereum;
      baalContracts = {
        lootSingleton: (await ethers.getContractAt(
          "Loot",
          baalSetupAddresses.addresses.lootSingleton,
          deployer,
        )) as Loot,
        poster: (await ethers.getContractAt("Poster", setupAddresses.poster, deployer)) as Poster,
        sharesSingleton: (await ethers.getContractAt(
          "Shares",
          baalSetupAddresses.addresses.sharesSingleton,
          deployer,
        )) as Shares,
      };
    } else {
      baalContracts = {
        lootSingleton: (await ethers.getContract("Loot", deployer)) as Loot,
        poster: (await ethers.getContractAt("Poster", setupAddresses.poster, deployer)) as Poster,
        sharesSingleton: (await ethers.getContract("Shares", deployer)) as Shares,
      };
    }

    let shamans: {
      [name: string]: ShamanBase;
    } = {};
    if (opts?.deployShamanContracts) {
      const deployedContracts = await Promise.all(
        Object.keys(opts.deployShamanContracts).map(async (id: string) => {
          const deployed = await deployments.get(opts.deployShamanContracts[id].contractName);
          const contract = (await ethers.getContractAt(
            opts.deployShamanContracts[id].contract,
            deployed.address,
            signer,
          )) as ShamanBase;
          return [id, contract];
        }),
      );
      shamans = Object.fromEntries(deployedContracts);
    }

    return {
      baalContracts,
      deployedFromFixtures,
      safe,
      shamans,
      users: {
        owner: {
          address: deployer,
        },
        applicant: {
          address: applicant,
        },
        alice: {
          address: alice,
        },
        bob: {
          address: bob,
        },
        hausEcoFund: {
          address: hausEcoFund,
        },
        yeeterTeam: {
          address: yeeterTeam,
        },
      },
    };
  },
);
