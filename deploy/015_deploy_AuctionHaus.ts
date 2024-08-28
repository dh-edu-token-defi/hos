import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const deployFn: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, network } = hre;
  const { deployer } = await hre.getNamedAccounts();

  console.log("\nDeploying AuctionHausShamanModule singleton on network:", network.name);
  console.log("\nDeploying from address", deployer);

  const auctionHausDeployed = await deployments.deploy("AuctionHausShamanModule", {
    contract: "AuctionHausShamanModule",
    from: deployer,
    args: [],
    // proxy: {
    //     proxyContract: 'UUPS',
    //     methodName: 'initialize',
    // },
    log: true,
  });
  console.log("auctionHausShamanModule deployment Tx ->", auctionHausDeployed.transactionHash);
};

export default deployFn;
deployFn.id = "015_deploy_AuctionHausShamanModule"; // id required to prevent reexecution
deployFn.tags = ["AuctionHausShamanModule"];
