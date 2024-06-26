import { ethers, network } from "hardhat";
import { NetworkConfig } from "hardhat/types";

const abiCoder = ethers.utils.defaultAbiCoder;

export const encodeValues = (types: Array<string>, values: Array<any>) => {
    return abiCoder.encode(types, values);
};

export type CustomNetworkConfig = NetworkConfig & {forking?: {enabled: boolean}};

export const getNetworkConfig = () => network.config as CustomNetworkConfig;

export * from "./baal";
export * from "./hos";
export * from "./safe";
export * from "./uniswapv3";
export * from "./yeeter";
