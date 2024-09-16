// NOTICE: hardhat-foundry must be disabled when running pnpm coverage
// import "@nomicfoundation/hardhat-foundry";
import "@nomicfoundation/hardhat-toolbox";
import { config as dotenvConfig } from "dotenv";
import "hardhat-contract-sizer";
import "hardhat-deploy";
import type { HardhatUserConfig } from "hardhat/config";
import type { NetworkUserConfig } from "hardhat/types";
import { resolve } from "path";

import "./tasks/accounts";

// import "./tasks/greet";
// import "./tasks/taskDeploy";

const dotenvConfigPath: string = process.env.DOTENV_CONFIG_PATH || "./.env";
dotenvConfig({ path: resolve(__dirname, dotenvConfigPath) });

// Ensure that we have all the environment variables we need.
const mnemonic: string = process.env.MNEMONIC || "";
if (!mnemonic) {
  throw new Error("Please set your MNEMONIC in a .env file");
}
const mnemonicBuildBear = process.env.MNEMONIC_BUILDBEAR || mnemonic;

const infuraApiKey: string | undefined = process.env.INFURA_API_KEY;
if (!infuraApiKey) {
  throw new Error("Please set your INFURA_API_KEY in a .env file");
}

const chainIds = {
  ganache: 1337,
  hardhat: 31337,
  mainnet: 1,
  sepolia: 11155111,
  gnosis: 100,
  "arbitrum-mainnet": 42161,
  "arbitrum-sepolia": 421614,
  "optimism-mainnet": 10,
  "optimism-sepolia": 11155420,
  "polygon-mainnet": 137,
  "base-mainnet": 8453,
};

const explorerApiKey = (networkName: keyof typeof chainIds) => {
  const fromEnv = () => {
    switch (networkName) {
      case "mainnet":
      case "sepolia":
        return process.env.ETHERSCAN_APIKEY;
      case "gnosis":
        return process.env.GNOSISSCAN_APIKEY;
      case "polygon-mainnet":
        return process.env.POLYGONSCAN_APIKEY;
      case "optimism-mainnet":
      case "optimism-sepolia":
        return process.env.OPTIMISTICSCAN_APIKEY;
      case "arbitrum-mainnet":
      case "arbitrum-sepolia":
        return process.env.ARBISCAN_APIKEY;
      case "base-mainnet":
        return process.env.BASESCAN_API_KEY;
      default:
        break;
    }
  };
  return fromEnv() || "";
};

const getNodeURI = (networkName: keyof typeof chainIds) => {
  switch (networkName) {
    case "arbitrum-mainnet":
      return "https://rpc.ankr.com/arbitrum";
    case "arbitrum-sepolia":
      return "https://sepolia-rollup.arbitrum.io/rpc";
    case "optimism-mainnet":
      return "https://rpc.ankr.com/optimism";
    case "optimism-sepolia":
      return "https://sepolia.optimism.io";
    case "polygon-mainnet":
      return "https://rpc.ankr.com/polygon";
    case "gnosis":
      return "https://rpc.gnosischain.com";
    case "base-mainnet":
      return "https://mainnet.base.org";
    default:
      return "https://" + networkName + ".infura.io/v3/" + infuraApiKey;
  }
};

function getChainConfig(chain: keyof typeof chainIds): NetworkUserConfig {
  const jsonRpcUrl = getNodeURI(chain);
  return {
    accounts: process.env.ACCOUNT_PK
      ? [process.env.ACCOUNT_PK]
      : {
          count: 10,
          mnemonic,
          path: "m/44'/60'/0'/0",
        },
    chainId: chainIds[chain],
    url: jsonRpcUrl,
    verify: {
      etherscan: {
        apiKey: explorerApiKey(chain),
      },
    },
  };
}

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  namedAccounts: {
    deployer: 0,
  },
  gasReporter: {
    currency: "USD",
    enabled: process.env.REPORT_GAS === "true" ? true : false,
    excludeContracts: [],
    src: "./contracts",
  },
  networks: {
    hardhat: {
      accounts: {
        mnemonic,
      },
      chainId: chainIds.hardhat,
      forking: process.env.HARDHAT_FORK_NETWORK
        ? {
            url: getNodeURI(process.env.HARDHAT_FORK_NETWORK as keyof typeof chainIds),
            blockNumber: process.env.HARDHAT_FORK_BLOCKNUMBER
              ? parseInt(process.env.HARDHAT_FORK_BLOCKNUMBER)
              : undefined,
          }
        : undefined,
      initialDate: "2024-06-01T00:00:00.000-05:00",
    },
    buildbear: {
      url: "https://rpc.buildbear.io/desperate-katebishop-722b67d0",
      accounts: {
        mnemonic: mnemonicBuildBear,
      },
    },
    // ganache: {
    //   accounts: {
    //     mnemonic,
    //   },
    //   chainId: chainIds.ganache,
    //   url: "http://localhost:8545",
    // },
    arbitrum: getChainConfig("arbitrum-mainnet"),
    arbitrumSepolia: getChainConfig("arbitrum-sepolia"),
    mainnet: getChainConfig("mainnet"),
    sepolia: getChainConfig("sepolia"),
    optimism: getChainConfig("optimism-mainnet"),
    optimismSepolia: getChainConfig("optimism-sepolia"),
    "polygon-mainnet": getChainConfig("polygon-mainnet"),
    base: getChainConfig("base-mainnet"),
  },
  paths: {
    artifacts: "./artifacts",
    cache: "./cache",
    sources: "./contracts",
    tests: "./test",
  },
  // contractSizer: {
  //   alphaSort: true,
  //   disambiguatePaths: false,
  //   runOnCompile: true,
  //   strict: false,
  //   only: ["Yeet24HOS", "Yeet24ShamanModule", "EthYeeter"],
  // },
  solidity: {
    compilers: [
      {
        version: "0.7.5",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.8.7",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.8.10",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.8.13",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.8.19",
        settings: {
          metadata: {
            // Not including the metadata hash
            // https://github.com/paulrberg/hardhat-template/issues/31
            bytecodeHash: "none",
          },
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.8.20",
        settings: {
          metadata: {
            // Not including the metadata hash
            // https://github.com/paulrberg/hardhat-template/issues/31
            bytecodeHash: "none",
          },
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  mocha: {
    timeout: 120000,
  },
  typechain: {
    outDir: "types",
    target: "ethers-v5",
  },
  etherscan: {
    apiKey: {
      buildbear: "verifyContract",
      mainnet: explorerApiKey("mainnet"),
      sepolia: explorerApiKey("sepolia"),
      optimisticEthereum: explorerApiKey("optimism-mainnet"),
      // optimisticSepolia: explorerApiKey("optimism-sepolia"),
      arbitrumOne: explorerApiKey("arbitrum-mainnet"),
      // arbitrumSepolia: explorerApiKey("arbitrum-sepolia"),
      polygon: explorerApiKey("polygon-mainnet"),
      base: explorerApiKey("base-mainnet"),
    },
    customChains: [
      {
        network: "base",
        chainId: 8453,
        urls: {
          apiURL: "https://api.basescan.org/api",
          browserURL: "https://basescan.org",
        },
      },
      {
        network: "buildbear",
        chainId: 18229,
        urls: {
          apiURL: "https://rpc.buildbear.io/verify/etherscan/desperate-katebishop-722b67d0",
          browserURL: "https://explorer.buildbear.io/desperate-katebishop-722b67d0",
        },
      },
    ],
  },
  external: {
    contracts: [
      {
        artifacts: "node_modules/@daohaus/baal-contracts/export/artifacts",
        deploy: "node_modules/@daohaus/baal-contracts/export/deploy",
      },
    ],
  },
};

export default config;
