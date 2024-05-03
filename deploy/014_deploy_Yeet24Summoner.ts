import { getSetupAddresses } from "@daohaus/baal-contracts";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { deploymentConfig } from "../constants";

const deployFn: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { getChainId, deployments, network } = hre;
  const { deployer } = await hre.getNamedAccounts();

  console.log("\nDeploying Yeet24ShamanModule factory on network:", network.name);

  const chainId = await getChainId();
  const setupAddresses = await getSetupAddresses(chainId, network, deployments);
  console.log("setupAddresses", setupAddresses);
  const addresses = deploymentConfig[chainId];

  if (network.name !== "hardhat") {
    if (!addresses?.baalSummoner) throw Error("No address found for BaalSummoner");
    console.log(`Re-using contracts on ${network.name}:`);
    console.log("BaalSummoner", addresses.baalSummoner);
  }

  const bvSummonerAddress =
    network.name === "hardhat" ? (await deployments.get("BaalAndVaultSummoner")).address : addresses.bvSummoner;

  const yeet24ShamanModule =
    network.name === "hardhat" ? (await deployments.get("Yeet24ShamanModule")).address : addresses.yeet24ShamanModule;

  const yeeter = network.name === "hardhat" ? (await deployments.get("Yeeter")).address : addresses.yeeter;

  const sharesToken =
    network.name === "hardhat" ? (await deployments.get("SharesToken")).address : addresses.sharesToken;

  const lootToken = network.name === "hardhat" ? (await deployments.get("LootToken")).address : addresses.lootToken;

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
          setupAddresses.moduleProxyFactory,
          [yeet24ShamanModule, yeeter, sharesToken, lootToken],
        ],
      },
    },
    log: true,
  });
  console.log("Yeet24HOS deployment Tx ->", hosSummonerDeployed.transactionHash);

  if (network.name !== "hardhat" && addresses?.owner && addresses.owner !== deployer) {
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
