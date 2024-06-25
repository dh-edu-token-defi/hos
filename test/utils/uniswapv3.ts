import { deployments, ethers, getChainId, getNamedAccounts, network } from "hardhat";

import {
  abi as FACTORY_ABI,
  bytecode as FACTORY_BYTECODE,
} from "@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json";

import {
  abi as NFTD_LIBRARY_ABI,
  bytecode as NFTD_LIBRARY_BYTECODE,
} from "@uniswap/v3-periphery/artifacts/contracts/libraries/NFTDescriptor.sol/NFTDescriptor.json";
import {
  abi as NFTP_MANAGER_ABI,
  bytecode as NFTP_MANAGER_BYTECODE,
} from "@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json";
import {
  abi as NFTP_DESCRIPTOR_ABI,
  bytecode as NFTP_DESCRIPTOR_BYTECODE,
} from "@uniswap/v3-periphery/artifacts/contracts/NonfungibleTokenPositionDescriptor.sol/NonfungibleTokenPositionDescriptor.json";

import { WETH } from "../../types";
import { deploymentConfig } from "../../constants";
import { getNetworkConfig } from ".";

export const deployUniV3Infra = async () => {
  const networkConfig = getNetworkConfig();
  const forkedNetwork = network.name === 'buildbear' || networkConfig.forking?.enabled;
  const chainId =  forkedNetwork ? "10" : await getChainId();
  const { deployer } = await getNamedAccounts();

  const addresses = deploymentConfig[chainId];

  const signer = await deployments.getSigner(deployer);

  // console.log("Getting UniV3 contracts for network:", network.name);

  if (network.name === 'hardhat' && !forkedNetwork) {
    const wethDeployed = await deployments.deploy("WETH", {
      contract: "WETH",

      from: deployer,
      args: [],
      // proxy: {
      //     proxyContract: 'UUPS',
      //     methodName: 'initialize',
      // },
      log: true,
    });
    const WETH = (await ethers.getContractAt("WETH", wethDeployed.address, signer)) as WETH;


    const factory = new ethers.ContractFactory(FACTORY_ABI, FACTORY_BYTECODE, signer);
    const factoryContract = await factory.deploy();
    // console.log("factoryContract", factoryContract.address);

    const nftDescriptorLibFactory = new ethers.ContractFactory(NFTD_LIBRARY_ABI, NFTD_LIBRARY_BYTECODE, signer);
    const nftDesriptorLibrary = await nftDescriptorLibFactory.deploy();
    // console.log("nftDesriptorLibrary", nftDesriptorLibrary.address);

    const libraryPlaceholder = `${ethers.utils.id("contracts/libraries/NFTDescriptor.sol:NFTDescriptor").substring(2, 2 + 34)}`;

    // console.log("libraryPlaceholder", libraryPlaceholder);

    const nftpDescriptorFactory = new ethers.ContractFactory(
      NFTP_DESCRIPTOR_ABI,
      NFTP_DESCRIPTOR_BYTECODE.replace(/__\$[a-fA-F0-9]+\$__/, nftDesriptorLibrary.address.substring(2)),
      signer
    );
    const nftpDescriptor = await nftpDescriptorFactory.deploy(wethDeployed.address, "0x4554480000000000000000000000000000000000000000000000000000000000");
    // console.log("nftpDescriptor", nftpDescriptor.address);

    const nftpManagerFactory = new ethers.ContractFactory(NFTP_MANAGER_ABI, NFTP_MANAGER_BYTECODE, signer);
    const nftpManager = await nftpManagerFactory.deploy(factoryContract.address, wethDeployed.address, nftpDescriptor.address);

    // console.log("UniV3Contracts", factoryContract.address, nftpDescriptor.address, nftpManager.address);
    return {
      nftpManager,
      WETH,
    };
  }
  if (!addresses.univ3NftPositionManager || !addresses.weth)
      throw new Error(`Missing UniV3 and WETH setup addresses for network: ${network.name}`);
  return {
    nftpManager: await ethers.getContractAt("INonfungiblePositionManager", addresses.univ3NftPositionManager, signer),
    WETH: (await ethers.getContractAt("WETH", addresses.weth, signer)) as WETH,
  }
};
