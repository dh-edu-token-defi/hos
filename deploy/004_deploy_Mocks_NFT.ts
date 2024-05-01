import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { deploymentConfig } from "../constants";

const deployFn: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { getChainId, deployments, network } = hre;
  const { deployer } = await hre.getNamedAccounts();
  const chainId = await getChainId();
  const addresses = deploymentConfig[chainId];

  console.log("\nDeploying MintableNFT mock on network:", network.name);

  const shamanDeployed = await deployments.deploy("MintableNFT", {
    contract: "MintableNFT",
    from: deployer,
    args: [],
    // proxy: {
    //     proxyContract: 'UUPS',
    //     methodName: 'initialize',
    // },
    log: true,
  });
  console.log("MintableNFT deployment Tx ->", shamanDeployed.transactionHash);

  const owner = addresses?.owner || deployer;
  console.log("MintableNFT transferOwnership to", owner);
  const txOwnership = await hre.deployments.execute(
    "MintableNFT",
    {
      from: deployer,
    },
    "transferOwnership",
    owner,
  );
  console.log("MintableNFT transferOwnership Tx ->", txOwnership.transactionHash);
};

export default deployFn;
deployFn.id = "004_deploy_Mocks_NFT"; // id required to prevent reexecution
deployFn.tags = ["MocksNFT"];
