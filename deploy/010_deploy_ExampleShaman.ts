import { BaalAndVaultSummoner, BaalSummoner, getSetupAddresses } from "@daohaus/baal-contracts";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { deploymentConfig } from "../constants";
import { getNetworkConfig } from "../test/utils";

const deployFn: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, ethers, getChainId, network } = hre;
  const { deployer } = await hre.getNamedAccounts();

  const networkConfig = getNetworkConfig();

  console.log("\nDeploying ExampleShaman singleton on network:", network.name);
  console.log("\nDeploying from address", deployer);

  const shaman4Deployed = await deployments.deploy("ExampleShaman", {
    contract: "ExampleShaman",
    from: deployer,
    args: [],
    // proxy: {
    //     proxyContract: 'UUPS',
    //     methodName: 'initialize',
    // },
    log: true,
  });
  console.log("ExampleShaman deployment Tx ->", shaman4Deployed.transactionHash);

  // -------------

  console.log("\nDeploying Yeet24Summoner on network:", network.name, "forked?", !!networkConfig.forking?.enabled);

  const forkedNetwork = network.name === "buildbear" || networkConfig.forking?.enabled;
  // NOTICE: default to Optimism private fork
  const chainId = forkedNetwork ? "10" : await getChainId();
  const setupAddresses = await getSetupAddresses(
    chainId,
    {
      ...network,
      name: forkedNetwork ? "forked" : network.name,
    },
    deployments,
  );
  console.log("setupAddresses", setupAddresses);
  const addresses = deploymentConfig[chainId];

  if (forkedNetwork) {
    if (!addresses?.baalSummoner) throw Error("No address found for BaalSummoner");
    console.log(`Re-using contracts on ${network.name}:${chainId}`);
  }

  const testNetworks = ["buildbear", "hardhat"];

  const bvSummonerAddress =
    network.name === "hardhat" && !forkedNetwork
      ? (await deployments.get("BaalAndVaultSummoner")).address
      : addresses.bvSummoner;

  const bvSummoner = (await ethers.getContractAt(
    "BaalAndVaultSummoner",
    bvSummonerAddress,
    deployer,
  )) as BaalAndVaultSummoner;
  const baalSummoner = (await ethers.getContractAt(
    "BaalSummoner",
    await bvSummoner._baalSummoner(),
    deployer,
  )) as BaalSummoner;

  // NOTICE: Need to fetch moduleProxyFactory from summoner as setupAddresses currently differ in a few networks (e.g. optimisms)
  const currentModuleProxyFactoryAddress = ethers.utils.getAddress(
    (await ethers.provider.getStorageAt(baalSummoner.address, "0xd1")).substring(26),
  );
  const moduleProxyFactoryAddress =
    currentModuleProxyFactoryAddress !== ethers.constants.AddressZero
      ? currentModuleProxyFactoryAddress
      : setupAddresses.moduleProxyFactory;

  console.log("BVSummoner -> ModuleProxyFactory", moduleProxyFactoryAddress);

  const sharesToken =
    network.name === "hardhat" && !forkedNetwork ? (await deployments.get("Shares")).address : addresses.sharesToken;

  const lootToken = testNetworks.includes(network.name) ? (await deployments.get("Loot")).address : addresses.lootToken;

  const hosSummonerDeployed = await deployments.deploy("Yeet24HOS", {
    contract: "Yeet24HOS",
    from: deployer,
    args: [],
    proxy: {
      proxyContract: "UUPS",
      execute: {
        methodName: "initialize",
        args: [
          bvSummonerAddress,
          moduleProxyFactoryAddress,
          [shaman4Deployed.address, sharesToken, lootToken],
          "DHYeet24ShamanSummoner.5",
        ],
      },
    },
    log: true,
  });
  console.log("Yeet24HOS deployment Tx ->", hosSummonerDeployed.transactionHash);
};

export default deployFn;
deployFn.id = "010_deploy_ExampleShaman"; // id required to prevent reexecution
deployFn.tags = ["ExampleShaman"];
