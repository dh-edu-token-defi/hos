import { deployments } from "hardhat";
import { Deployment, ProxyOptions } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { GnosisSafe, GnosisSafeProxyFactory, MultiSend, ShamanBase } from "../types";

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

export type NetworkRegistryProps = {
  deployedFromFixtures: {
    [name: string]: Deployment
  },
  safe: {
    safeProxyFactory: GnosisSafeProxyFactory;
    masterCopy: GnosisSafe;
    multisend: MultiSend;
  }
  shamans: {
    [name: string]: ShamanBase;
  }
};

export type ShamanSetup = NetworkRegistryProps & {
  users: {
    [key: string]: User;
  };
};

export const shamanFixture = deployments.createFixture<ShamanSetup, Opts>(
  async (hre: HardhatRuntimeEnvironment, opts?: Opts) => {
    const { ethers, getNamedAccounts, getUnnamedAccounts } = hre;
    const { deployer } = await getNamedAccounts();
    const [applicant, alice, bob, hausEcoFund, yeeterTeam] = await getUnnamedAccounts();

    const signer = await ethers.getSigner(deployer);

    // TODO:
    let deployedFromFixtures: {
      [name: string]: Deployment
    } = {};
    if (opts?.fixtureTags) {
      deployedFromFixtures = await deployments.fixture(opts.fixtureTags);
    }
    //////////////

    // Get Safe infra
    const safe = {
      safeProxyFactory: (await ethers.getContract("GnosisSafeProxyFactory", deployer)) as GnosisSafeProxyFactory,
      masterCopy: (await ethers.getContract("GnosisSafe", deployer)) as GnosisSafe,
      multisend: (await ethers.getContract("MultiSend", deployer)) as MultiSend,
    };

    let shamans: {
      [name: string]: ShamanBase;
    } = {};
    if (opts?.deployShamanContracts) {
      const deployedContracts = 
        await Promise.all(Object.keys(opts.deployShamanContracts).map(async (id: string) => {
          const deployed = await deployments.get(opts.deployShamanContracts[id].contractName);
          const contract = (await ethers.getContractAt(opts.deployShamanContracts[id].contract, deployed.address, signer)) as ShamanBase;
          return [id, contract];
        }));
      shamans = Object.fromEntries(deployedContracts);
    }

    return {
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
        }
      },
    };
  },
);
