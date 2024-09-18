import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { getNetworkConfig } from "../test/utils";

const deployFn: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { getChainId, deployments, ethers, network } = hre;
  const { deployer } = await hre.getNamedAccounts();

  console.log("deployer", deployer);

  const networkConfig = getNetworkConfig();

  console.log("\nDeploying Yeet24Summoner on network:", network.name);

  const hosSummonerDeployed = await deployments.deploy("Yeet24HOS", {
    contract: "Yeet24HOS",
    from: deployer,
    args: [],
    log: true,
  });
  console.log("Yeet24HOS deployment Tx ->", hosSummonerDeployed.transactionHash);
  console.log("Now owner can upgrade to this new implementation");
};

export default deployFn;
deployFn.id = "014_deploy_upgrade_Yeet24HOS"; // id required to prevent reexecution
deployFn.tags = ["Factories", "Yeet24HOS", "Upgrade"];
