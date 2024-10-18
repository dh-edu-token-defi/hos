import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

// import { getNetworkConfig } from "../test/utils";

const deployFn: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { getChainId, deployments, ethers, network } = hre;
  const { deployer } = await hre.getNamedAccounts();

  console.log("deployer", deployer);

  // const networkConfig = getNetworkConfig();

  console.log("\nDeploying Yeet24ClaimModule on network:", network.name);

  const maxReward = "300000000000000000"; // TODO: parametrize
  const rewardPercent = "15"; // TODO: parametrize
  let initialOwner = "0xCED608Aa29bB92185D9b6340Adcbfa263DAe075b"; // TODO: parametrize
  let yeet24HOSAddress = "0xde65e8b424438b361d8f4a8896f92956510b08dc"; // TODO: parametrize
  if (network.name === "hardhat") {
    initialOwner = deployer;
    yeet24HOSAddress = (await deployments.get("Yeet24HOS")).address;
  }

  // shaman template id keccak256(abi.encode("Yeet24ShamanModule"))
  const encodedData = ethers.utils.defaultAbiCoder.encode(["string"], ["Yeet24ShamanModule"]);
  const shamanTemplateId = ethers.utils.keccak256(encodedData);
  
  const params = [initialOwner, yeet24HOSAddress, shamanTemplateId, maxReward, rewardPercent];

  console.log("Yeet24ShamanModule params", params);

  const initParams = ethers.utils.defaultAbiCoder.encode(
    ["address", "address", "bytes32", "uint256", "uint256"],
    params,
  );

  const yeet24ClaimModuleDeployed = await deployments.deploy("Yeet24ClaimModule", {
    contract: "Yeet24ClaimModule",
    from: deployer,
    args: [],
    proxy: {
      proxyContract: "UUPS",
      execute: {
        methodName: "initialize",
        args: [initParams],
      },
    },
    log: true,
  });
  console.log("Yeet24ClaimModule deployment Tx ->", yeet24ClaimModuleDeployed.transactionHash);
};

export default deployFn;
deployFn.id = "016_deploy_Yeet24ClaimModule"; // id required to prevent reexecution
deployFn.tags = ["Factories", "Yeet24ClaimModule"];
