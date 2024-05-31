import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const deployFn: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, network } = hre;
  const { deployer } = await hre.getNamedAccounts();

  console.log("\nDeploying YeetNftEscrowShamanModule singleton on network:", network.name);
  console.log("\nDeploying from address", deployer);

  const nftShamanDeployed = await deployments.deploy("YeetNftEscrowShamanModule", {
    contract: "YeetNftEscrowShamanModule",
    from: deployer,
    args: [],
    // proxy: {
    //     proxyContract: 'UUPS',
    //     methodName: 'initialize',
    // },
    log: true,
  });
  console.log("YeetNftEscrowShamanModule deployment Tx ->", nftShamanDeployed.transactionHash);
};

export default deployFn;
deployFn.id = "016_deploy_YeetNftEscrowShamanModule"; // id required to prevent reexecution
deployFn.tags = ["YeetNftEscrowShamanModule"];
