import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const deployFn: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, network } = hre;
  const { deployer } = await hre.getNamedAccounts();

  console.log("\nDeploying DhToken singleton on network:", network.name);
  console.log("\nDeploying from address", deployer);

  const govLootDeployed = await deployments.deploy("DhToken", {
    contract: "DhToken",
    from: deployer,
    args: [],
    // proxy: {
    //   proxyContract: "UUPS",
    //   // execute: {
    //   //   methodName: "setUp",
    //   //   args: ["DhToken", "DHTOKEN"],
    //   // },
    // },
    log: true,
  });
  console.log("DhToken deployment Tx ->", govLootDeployed.transactionHash);
};

export default deployFn;
deployFn.id = "011_deploy_DhToken"; // id required to prevent reexecution
deployFn.tags = ["DhToken"];
