import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const deployFn: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, network } = hre;
  const { deployer } = await hre.getNamedAccounts();

  console.log("\nDeploying Yeet24ShamanModule singleton on network:", network.name);
  console.log("\nDeploying from address", deployer);

  const nftShamanDeployed = await deployments.deploy("Yeet24ShamanModule", {
    contract: "Yeet24ShamanModule",
    from: deployer,
    args: [],
    // proxy: {
    //     proxyContract: 'UUPS',
    //     methodName: 'initialize',
    // },
    log: true,
  });
  console.log("Yeet24ShamanModule deployment Tx ->", nftShamanDeployed.transactionHash);
};

export default deployFn;
deployFn.id = "013_deploy_Yeet24ShamanModule"; // id required to prevent reexecution
deployFn.tags = ["Yeet24ShamanModule"];
