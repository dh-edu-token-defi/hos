import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const deployFn: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, network } = hre;
  const { deployer } = await hre.getNamedAccounts();

  console.log("\nDeploying SimpleEthOnboarderShaman mock on network:", network.name);

  const shamanDeployed = await deployments.deploy("SimpleEthOnboarderShaman", {
    contract: "SimpleEthOnboarderShaman",
    from: deployer,
    args: [],
    // proxy: {
    //     proxyContract: 'UUPS',
    //     methodName: 'initialize',
    // },
    log: true,
  });
  console.log("SimpleEthOnboarderShaman deployment Tx ->", shamanDeployed.transactionHash);
};

export default deployFn;
deployFn.id = "000_deploy_Mocks_Onboarder"; // id required to prevent reexecution
deployFn.tags = ["MocksOnboarder"];
