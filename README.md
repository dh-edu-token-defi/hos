# baal-tokens

Intent: Playground to experiment with different summoner, token and shaman configurations

It uses a HOS (Higher Order Summoner) that wraps our indexed summoners from the baal repo

Initial tests are configured and examples of using the base summoner or the baal and vault summoner.

## HOS (Higher Order Summoner):
BaseHOS: Abstract that handles summonBaalFromReferrer which takes encoded bytes to setup tokens (loot/shares) and multiple shamans.

**FixedLootHOS**: summoner is an example of deploying a baal, side vault, a custom token (Fixed loot)

**OnboarderHOS**: Summoner is an example of using the base sumoner (no side vault) and deploying a standard loot/shares token with a
example of a simple onboarding shaman (eth to shares or loot)

## initial examples

### Shamans:

Shaman init params encoding:
```js
const initializationShamanParams = abiCoder.encode(
    ["address[]", "uint256[]", "bytes[]"],
    [shamanConfig.singletonAddress, shamanConfig.permissions, shamanConfig.setupParams],
  );
```

**ClaimShaman**: a claim shaman that allows NFT holders to claim shares/loot to a ERC6551 TBA (Token Bound Account)
```sol
(address _nftAddress, address _registry, address _tbaImp, uint256 _lootPerNft, uint256 _sharesPerNft) = abi
            .decode(_initParams, (address, address, address, uint256, uint256));
```

**OnboarderShaman**: yeet Eth for shares or loot 
```sol
(uint256 _expiry, uint256 _multiply, uint256 _minTribute, bool _isShares) = abi.decode(
            _initParams,
            (uint256, uint256, uint256, bool)
        );
```

**Community Veto**: Loot holders "stake" against a proposal while in voting, if it hits some threshold it can be cancelled. Kinda a less nuclear rq option. Uses the governor loot token.
```sol
uint256 _thresholdPercent = abi.decode(_initParams, (uint256));
```

### tokens

token init parameters encoding:
```js
const sharesParams = abiCoder.encode(["string", "string"], [sharesConfig.name, sharesConfig.symbol]);
  const initializationShareTokenParams = abiCoder.encode(
    ["address", "bytes"],
    [sharesConfig.singletonAddress, sharesParams],
  );
```

**FixedLoot**: A loot token with a fixed supply that is minted upfront between 2+ addresses
```sol
(
            string memory name_,
            string memory symbol_,
            address[] memory initialHolders,
            uint256[] memory initialAmounts
        ) = abi.decode(params, (string, string, address[], uint256[]));
```

**GovernorLoot**: allows snapshot to be called by baal or governor shaman

---

#### below is the hardhat starter docs
# Hardhat Template [![Open in Gitpod][gitpod-badge]][gitpod] [![Github Actions][gha-badge]][gha] [![Hardhat][hardhat-badge]][hardhat] [![License: MIT][license-badge]][license]

[gitpod]: https://gitpod.io/#https://github.com/paulrberg/hardhat-template
[gitpod-badge]: https://img.shields.io/badge/Gitpod-Open%20in%20Gitpod-FFB45B?logo=gitpod
[gha]: https://github.com/paulrberg/hardhat-template/actions
[gha-badge]: https://github.com/paulrberg/hardhat-template/actions/workflows/ci.yml/badge.svg
[hardhat]: https://hardhat.org/
[hardhat-badge]: https://img.shields.io/badge/Built%20with-Hardhat-FFDB1C.svg
[license]: https://opensource.org/licenses/MIT
[license-badge]: https://img.shields.io/badge/License-MIT-blue.svg

A Hardhat-based template for developing Solidity smart contracts, with sensible defaults.

- [Hardhat](https://github.com/nomiclabs/hardhat): compile, run and test smart contracts
- [TypeChain](https://github.com/ethereum-ts/TypeChain): generate TypeScript bindings for smart contracts
- [Ethers](https://github.com/ethers-io/ethers.js/): renowned Ethereum library and wallet implementation
- [Solhint](https://github.com/protofire/solhint): code linter
- [Solcover](https://github.com/sc-forks/solidity-coverage): code coverage
- [Prettier Plugin Solidity](https://github.com/prettier-solidity/prettier-plugin-solidity): code formatter

## Getting Started

Click the [`Use this template`](https://github.com/paulrberg/hardhat-template/generate) button at the top of the page to
create a new repository with this repo as the initial state.

## Features

This template builds upon the frameworks and libraries mentioned above, so for details about their specific features,
please consult their respective documentations.

For example, for Hardhat, you can refer to the [Hardhat Tutorial](https://hardhat.org/tutorial) and the
[Hardhat Docs](https://hardhat.org/docs). You might be in particular interested in reading the
[Testing Contracts](https://hardhat.org/tutorial/testing-contracts) section.

### Sensible Defaults

This template comes with sensible default configurations in the following files:

```text
├── .editorconfig
├── .eslintignore
├── .eslintrc.yml
├── .gitignore
├── .prettierignore
├── .prettierrc.yml
├── .solcover.js
├── .solhint.json
└── hardhat.config.ts
```

### VSCode Integration

This template is IDE agnostic, but for the best user experience, you may want to use it in VSCode alongside Nomic
Foundation's [Solidity extension](https://marketplace.visualstudio.com/items?itemName=NomicFoundation.hardhat-solidity).

### GitHub Actions

This template comes with GitHub Actions pre-configured. Your contracts will be linted and tested on every push and pull
request made to the `main` branch.

Note though that to make this work, you must use your `INFURA_API_KEY` and your `MNEMONIC` as GitHub secrets.

You can edit the CI script in [.github/workflows/ci.yml](./.github/workflows/ci.yml).

## Usage

### Pre Requisites

Before being able to run any command, you need to create a `.env` file and set a BIP-39 compatible mnemonic as an
environment variable. You can follow the example in `.env.example`. If you don't already have a mnemonic, you can use
this [website](https://iancoleman.io/bip39/) to generate one.

Then, proceed with installing dependencies:

```sh
$ pnpm install
```

### Compile

Compile the smart contracts with Hardhat:

```sh
$ pnpm compile
```

### TypeChain

Compile the smart contracts and generate TypeChain bindings:

```sh
$ pnpm typechain
```

### Test

Run the tests with Hardhat:

```sh
$ pnpm test
```

### Lint Solidity

Lint the Solidity code:

```sh
$ pnpm lint:sol
```

### Lint TypeScript

Lint the TypeScript code:

```sh
$ pnpm lint:ts
```

### Coverage

Generate the code coverage report:

```sh
$ pnpm coverage
```

### Report Gas

See the gas usage per unit test and average gas per method call:

```sh
$ REPORT_GAS=true pnpm test
```

### Clean

Delete the smart contract artifacts, the coverage reports and the Hardhat cache:

```sh
$ pnpm clean
```

### Local Deployment

```sh
$ pnpm hardhat deploy --tags Infra,BaalSummoner,BaalAndVaultSummoner,GovernorLoot,Yeeter2,Yeet24ShamanModule,Yeet24HOS
```

### Deploy

Deploy the contracts to Hardhat Network:

```sh
$ pnpm deploy:contracts
```

### Tasks

#### Deploy Greeter

Deploy a new instance of the Greeter contract via a task:

```sh
$ pnpm task:deployGreeter --network ganache --greeting "Bonjour, le monde!"
```

#### Set Greeting

Run the `setGreeting` task on the Ganache network:

```sh
$ pnpm task:setGreeting --network ganache --greeting "Bonjour, le monde!" --account 3
```

## Tips

### Syntax Highlighting

If you use VSCode, you can get Solidity syntax highlighting with the
[hardhat-solidity](https://marketplace.visualstudio.com/items?itemName=NomicFoundation.hardhat-solidity) extension.

## Using GitPod

[GitPod](https://www.gitpod.io/) is an open-source developer platform for remote development.

To view the coverage report generated by `pnpm coverage`, just click `Go Live` from the status bar to turn the server
on/off.

## Local development with Ganache

### Install Ganache

```sh
$ npm i -g ganache
```

### Run a Development Blockchain

```sh
$ ganache -s test
```

> The `-s test` passes a seed to the local chain and makes it deterministic

Make sure to set the mnemonic in your `.env` file to that of the instance running with Ganache.

## License

This project is licensed under MIT.
# hos
