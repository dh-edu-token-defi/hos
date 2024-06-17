import { ethers } from "hardhat";

const abiCoder = ethers.utils.defaultAbiCoder;

export const encodeValues = (types: Array<string>, values: Array<any>) => {
    return abiCoder.encode(types, values);
};

export * from "./baal";
export * from "./hos";
export * from "./safe";
export * from "./uniswapv3";
export * from "./yeeter";
