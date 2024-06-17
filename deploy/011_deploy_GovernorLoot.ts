import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const deployFn: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, network } = hre;
  const { deployer } = await hre.getNamedAccounts();

  console.log("\nDeploying GovernorLoot singleton on network:", network.name);
  console.log("\nDeploying from address", deployer);

  const govLootDeployed = await deployments.deploy("GovernorLoot", {
    contract: "GovernorLoot",
    from: deployer,
    args: [],
    // proxy: {
    //     proxyContract: 'UUPS',
    //     methodName: 'initialize',
    // },
    log: true,
  });
  console.log("GovernorLoot deployment Tx ->", govLootDeployed.transactionHash);
};

export default deployFn;
deployFn.id = "011_deploy_GovernorLoot"; // id required to prevent reexecution
deployFn.tags = ["GovernorLoot"];
