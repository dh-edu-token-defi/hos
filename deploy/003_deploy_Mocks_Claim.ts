import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const deployFn: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, network } = hre;
  const { deployer } = await hre.getNamedAccounts();

  console.log("\nDeploying NFT6551ClaimerShaman mock on network:", network.name);

  const shamanDeployed = await deployments.deploy("NFT6551ClaimerShaman", {
    contract: "NFT6551ClaimerShaman",
    from: deployer,
    args: [],
    // proxy: {
    //     proxyContract: 'UUPS',
    //     methodName: 'initialize',
    // },
    log: true,
  });
  console.log("NFT6551ClaimerShaman deployment Tx ->", shamanDeployed.transactionHash);
};

export default deployFn;
deployFn.id = "003_deploy_Mocks_Claim"; // id required to prevent reexecution
deployFn.tags = ["MocksClaim"];
