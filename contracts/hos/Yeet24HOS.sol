// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Clones } from "@openzeppelin/contracts/proxy/Clones.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import { IBaal } from "@daohaus/baal-contracts/contracts/interfaces/IBaal.sol";
import { IBaalToken } from "@daohaus/baal-contracts/contracts/interfaces/IBaalToken.sol";

// TODO: use on upcoming release
// import "@daohaus/baal-contracts/contracts/interfaces/IBaalAndVaultSummoner.sol";
import { HOSBase, IBaalAndVaultSummoner, IBaalFixedToken, IShaman } from "./HOSBase.sol";
import { IBaalGovToken } from "../interfaces/IBaalGovToken.sol";

// import "hardhat/console.sol";

error Yeet24HOS__ParamSizeMismatch();

contract Yeet24HOS is HOSBase {
    IBaalAndVaultSummoner public baalVaultSummoner;

    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _baalVaultSummoner,
        address _moduleProxyFactory,
        address[] memory _allowlistTemplates,
        string memory _referrerId
    ) public override initializer {
        // baalAndVaultSummoner
        require(_baalVaultSummoner != address(0), "zero address");
        baalVaultSummoner = IBaalAndVaultSummoner(_baalVaultSummoner); //vault summoner
        // standard baalSummoner
        address baalSummoner = baalVaultSummoner._baalSummoner();
        super.initialize(baalSummoner, _moduleProxyFactory, _allowlistTemplates, _referrerId);
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
            referrerId, // referrer e.g. "DHYeet24ShamanSummoner.3"
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
     * @param initializationShamanParams shaman init params
     * @param shamans IShamans
     * @param baal address
     */
    function postDeployShamanActions(
        bytes calldata initializationShamanParams,
        address /*lootToken*/,
        address /*sharesToken*/,
        address[] memory shamans,
        address baal,
        address /*vault*/
    ) internal override {
        uint256 totalParams = shamans.length;
        (, , bytes[] memory initShamanDeployParams) = abi.decode(
            initializationShamanParams,
            (address, uint256, bytes[])
        );
        if (initShamanDeployParams.length != totalParams) revert Yeet24HOS__ParamSizeMismatch();
        address vault = IBaal(baal).avatar(); // fetch baal main treasury
        // shaman setup with dao address, vault address and initShamanParams
        for (uint256 i; i < totalParams; ) {
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

    // solhint-disable-next-line state-visibility, var-name-mixedcase
    uint256[49] __gap_y24;
}
