import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const deployFn: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, network } = hre;
  const { deployer } = await hre.getNamedAccounts();

  console.log("\nDeploying ERC6551Reg mock on network:", network.name);

  const shamanDeployed = await deployments.deploy("ERC6551Registry", {
    contract: "ERC6551Registry",
    from: deployer,
    args: [],
    // proxy: {
    //     proxyContract: 'UUPS',
    //     methodName: 'initialize',
    // },
    log: true,
  });
  console.log("ERC6551Registry deployment Tx ->", shamanDeployed.transactionHash);
};

export default deployFn;
deployFn.id = "004_deploy_Mocks_TbaReg"; // id required to prevent reexecution
deployFn.tags = ["MocksTbaReg"];
