import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const deployFn: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, network } = hre;
  const { deployer } = await hre.getNamedAccounts();

  console.log("\nDeploying Yeet24LockerModule singleton on network:", network.name);
  console.log("\nDeploying from address", deployer);

  const yeet24Deployed = await deployments.deploy("Yeet24LockerModule", {
    contract: "Yeet24LockerModule",
    from: deployer,
    args: [],
    // proxy: {
    //     proxyContract: 'UUPS',
    //     methodName: 'initialize',
    // },
    log: true,
  });
  console.log("Yeet24LockerModule deployment Tx ->", yeet24Deployed.transactionHash);
};

export default deployFn;
deployFn.id = "017_deploy_Yeet24LockerModule"; // id required to prevent reexecution
deployFn.tags = ["Yeet24LockerModule"];
