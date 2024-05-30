// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import { Clones } from "@openzeppelin/contracts/proxy/Clones.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import { IBaal } from "@daohaus/baal-contracts/contracts/interfaces/IBaal.sol";
import { IBaalToken } from "@daohaus/baal-contracts/contracts/interfaces/IBaalToken.sol";

// TODO: use on upcoming release
// import "@daohaus/baal-contracts/contracts/interfaces/IBaalAndVaultSummoner.sol";
import { HOSBase, IBaalAndVaultSummoner, IBaalFixedToken, IShaman } from "./HOSBase.sol";
import { IBaalGovToken } from "../interfaces/IBaalGovToken.sol";

// import "hardhat/console.sol";

contract Yeet24HOS is HOSBase {
    IBaalAndVaultSummoner public baalVaultSummoner;

    function initialize(
        address _baalVaultSummoner,
        address _moduleProxyFactory,
        address[] memory _allowlistTemplates
    ) public override {
        // baalAndVaultSummoner
        require(_baalVaultSummoner != address(0), "zero address");
        baalVaultSummoner = IBaalAndVaultSummoner(_baalVaultSummoner); //vault summoner
        // standard baalSummoner
        address baalSummoner = baalVaultSummoner._baalSummoner();
        super.initialize(baalSummoner, _moduleProxyFactory, _allowlistTemplates);
        emit SetSummoner(_baalVaultSummoner);
    }

    /**
     * @dev summon a new baal contract with a newly created set of loot/shares tokens
     * uses baal and vault summoner to deploy baal and side vault
     * @param postInitActions actions ran in baal setup
     * @param lootToken address
     * @param sharesToken address
     * @param saltNonce unique nonce for baal summon
     * @return baal address
     * @return vault address
     */
    function summon(
        bytes[] memory postInitActions,
        address lootToken,
        address sharesToken,
        uint256 saltNonce
    ) internal override returns (address baal, address vault) {
        (baal, vault) = baalVaultSummoner.summonBaalAndVault(
            abi.encode(
                IBaalFixedToken(sharesToken).name(),
                IBaalFixedToken(sharesToken).symbol(),
                address(0), // safe (0 addr creates a new one)
                address(0), // forwarder (0 addr disables feature)
                lootToken,
                sharesToken
            ),
            postInitActions,
            saltNonce, // salt nonce
            bytes32(bytes("DHYeet24ShamanSummoner")), // referrer
            string.concat(IBaalFixedToken(lootToken).symbol(), " ", "Vault") // name
        );
    }

    /**
     * @dev deploySharesToken
     * @param initializationParams The parameters for deploying the token
     */
    function deployLootToken(
        bytes calldata initializationParams,
        address initialOwner
    ) internal override returns (address token) {
        token = super.deployToken(initializationParams);
        IBaalGovToken(token).transferOwnership(initialOwner);
    }

    /**
     * @dev deploySharesToken
     * @param initializationParams The parameters for deploying the token
     */
    function deploySharesToken(
        bytes calldata initializationParams,
        address initialOwner
    ) internal override returns (address token) {
        token = super.deployToken(initializationParams);
        IBaalGovToken(token).transferOwnership(initialOwner);
    }

    function deployShamans(
        address baalAddress,
        bytes[] memory postInitializationActions,
        bytes memory initializationShamanParams,
        uint256 saltNonce
    ) internal override returns (bytes[] memory actions, address[] memory shamanAddresses) {
        (actions, shamanAddresses) = super.deployShamans(
            baalAddress,
            postInitializationActions,
            initializationShamanParams,
            saltNonce
        );
    }

    /**
     * @dev sets up the already deployed claim shaman with init params
     * shaman init params (address _nftAddress, address _registry, address _tbaImp, uint256 _perNft, uint256 _sharesPerNft)
     * @param initializationShamanParams shaman init params
     * @param shamans IShamans
     * @param baal address
     * @param vault address
     */
    function postDeployShamanActions(
        bytes calldata initializationShamanParams,
        address /*lootToken*/,
        address /*sharesToken*/,
        address[] memory shamans,
        address baal,
        address vault
    ) internal override {
        // init shaman here
        // TODO: mismatch length check, it is not checking the length of initializationShamanParams
        // against the length of shamans
        // TODO: no need to check lengths if calling deployShamans prior to this function is assured
        (, , bytes[] memory initShamanDeployParams) = abi.decode(
            initializationShamanParams,
            (address, uint256, bytes[])
        );
        // shaman setup with dao address, vault address and initShamanParams
        for (uint256 i; i < shamans.length;) {
            IShaman(shamans[i]).setup(baal, vault, initShamanDeployParams[i]);
            unchecked {
                ++i;
            }
        }
    }

    function predictDeterministicShamanAddress(
        address implementation,
        uint256 salt
    ) external view returns (address predicted) {
        return Clones.predictDeterministicAddress(implementation, bytes32(salt), address(this));
    }
}
