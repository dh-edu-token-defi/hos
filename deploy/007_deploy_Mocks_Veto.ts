import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const deployFn: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, network } = hre;
  const { deployer } = await hre.getNamedAccounts();

  console.log("\nDeploying CommunityVetoShaman mock on network:", network.name);

  const shamanDeployed = await deployments.deploy("CommunityVetoShaman", {
    contract: "CommunityVetoShaman",
    from: deployer,
    args: [],
    // proxy: {
    //     proxyContract: 'UUPS',
    //     methodName: 'initialize',
    // },
    log: true,
  });
  console.log("CommunityVetoShaman deployment Tx ->", shamanDeployed.transactionHash);
};

export default deployFn;
deployFn.id = "007_deploy_Mocks_Veto"; // id required to prevent reexecution
deployFn.tags = ["MocksVeto"];
