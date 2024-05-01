import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const deployFn: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, network } = hre;
  const { deployer } = await hre.getNamedAccounts();

  console.log("\nDeploying FixedLoot singleton on network:", network.name);

  const fixedLootDeployed = await deployments.deploy("FixedLoot", {
    contract: "FixedLoot",
    from: deployer,
    args: [],
    // proxy: {
    //     proxyContract: 'UUPS',
    //     methodName: 'initialize',
    // },
    log: true,
  });
  console.log("FixedLoot deployment Tx ->", fixedLootDeployed.transactionHash);
};

export default deployFn;
deployFn.id = "002_deploy_FixedLoot"; // id required to prevent reexecution
deployFn.tags = ["Factories", "FixedLoot"];
