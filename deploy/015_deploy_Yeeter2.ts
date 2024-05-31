import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const deployFn: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, network } = hre;
  const { deployer } = await hre.getNamedAccounts();

  console.log("\nDeploying Yeeter2 singleton on network:", network.name);
  console.log("\nDeploying from address", deployer);

  const nftShamanDeployed = await deployments.deploy("EthYeeter", {
    contract: "EthYeeter",
    from: deployer,
    args: [],
    // proxy: {
    //     proxyContract: 'UUPS',
    //     methodName: 'initialize',
    // },
    log: true,
  });
  console.log("EthYeeter deployment Tx ->", nftShamanDeployed.transactionHash);
};

export default deployFn;
deployFn.id = "015_deploy_Yeeter2"; // id required to prevent reexecution
deployFn.tags = ["Yeeter2"];
