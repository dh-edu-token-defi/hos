import { BaalAndVaultSummoner, BaalSummoner, getSetupAddresses } from "@daohaus/baal-contracts";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { deploymentConfig } from "../constants";
import { getNetworkConfig } from "../test/utils";

const deployFn: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { getChainId, deployments, ethers, network } = hre;
  const { deployer } = await hre.getNamedAccounts();

  console.log("deployer", deployer);

  const networkConfig = getNetworkConfig();

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

  const yeet24ShamanModule = testNetworks.includes(network.name)
    ? (await deployments.get("Yeet24ShamanModule")).address
    : addresses.yeet24ShamanModule;

  const yeeter = testNetworks.includes(network.name) ? (await deployments.get("EthYeeter")).address : addresses.yeeter;

  const sharesToken =
    network.name === "hardhat" && !forkedNetwork ? (await deployments.get("Shares")).address : addresses.sharesToken;

  const lootToken = testNetworks.includes(network.name)
    ? (await deployments.get("GovernorLoot")).address
    : addresses.lootToken;

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
          [yeet24ShamanModule, yeeter, sharesToken, lootToken],
          "DHYeet24ShamanSummoner.4",
        ],
      },
    },
    log: true,
  });
  console.log("Yeet24HOS deployment Tx ->", hosSummonerDeployed.transactionHash);

  if (!testNetworks.includes(network.name) && addresses?.owner && addresses.owner !== deployer) {
    console.log("Yeet24HOS transferOwnership to", addresses.owner);
    const tx = await deployments.execute(
      "Yeet24HOS",
      {
        from: deployer,
      },
      "transferOwnership",
      addresses.owner,
    );
    console.log("BaalAndVaultSummoner transferOwnership Tx ->", tx.transactionHash);
  }
};

export default deployFn;
deployFn.id = "014_deploy_Yeet24HOS"; // id required to prevent reexecution
deployFn.tags = ["Factories", "Yeet24HOS"];
