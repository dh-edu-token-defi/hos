// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { Clones } from "@openzeppelin/contracts/proxy/Clones.sol";

import { IBaal } from "@daohaus/baal-contracts/contracts/interfaces/IBaal.sol";
import { IBaalSummoner } from "@daohaus/baal-contracts/contracts/interfaces/IBaalSummoner.sol";
import { IBaalToken } from "@daohaus/baal-contracts/contracts/interfaces/IBaalToken.sol";

// TODO: use on upcoming release
// import "@daohaus/baal-contracts/contracts/interfaces/IBaalAndVaultSummoner.sol";
import { IBaalFixedToken } from "../interfaces/IBaalFixedToken.sol";
import { IBaalAndVaultSummoner } from "../interfaces/IBaalAndVaultSummoner.sol";
import { IShaman } from "../interfaces/IShaman.sol";

contract HOSBase is Initializable, OwnableUpgradeable, UUPSUpgradeable {
    IBaalSummoner public baalSummoner;
    address public moduleProxyFactory;
    mapping(address => bool) public allowlistTemplates;
    bytes32 public referrerId;
    mapping(address shamanAddress => bytes32 shamanId) public deployedShamans;

    event SetSummoner(address summoner);

    event DeployBaalToken(address tokenAddress);

    event HOSReferrerId(bytes32 _referrerId);

    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _baalSummoner,
        address _moduleProxyFactory,
        address[] memory _allowlistTemplates,
        string memory _referrerId
    ) public virtual initializer {
        __Ownable_init(_msgSender());
        __UUPSUpgradeable_init();
        baalSummoner = IBaalSummoner(_baalSummoner);
        moduleProxyFactory = _moduleProxyFactory;
        for (uint256 i; i < _allowlistTemplates.length; ) {
            allowlistTemplates[_allowlistTemplates[i]] = true;
            unchecked {
                ++i;
            }
        }
        referrerId = bytes32(bytes(_referrerId));
        emit HOSReferrerId(referrerId);
    }

    function isTemplateInAllowlist(address template) internal view returns (bool) {
        // todo: add a tag tohelp indexing
        // emit event somewhere
        return allowlistTemplates[template];
    }

    function registerShaman(address shamanAddress, bytes32 shamanId) public {
        require(deployedShamans[_msgSender()] != bytes32(0), "HOS: !deployedShaman");
        deployedShamans[shamanAddress] = shamanId;
    }

    // add setters for allowlistTemplates
    function setAllowlistTemplate(address _template, bool allowed) public onlyOwner {
        allowlistTemplates[_template] = allowed;
    }

    function setReferrerId(string memory _referrerId) external onlyOwner {
        referrerId = bytes32(bytes(_referrerId));
        emit HOSReferrerId(referrerId);
    }

    function calculateBaalAddress(uint256 _saltNonce) public view returns (address) {
        bytes memory _initializer = abi.encodeWithSignature("avatar()");
        bytes32 _salt = keccak256(abi.encodePacked(keccak256(_initializer), _saltNonce));
        bytes memory bytecode = abi.encodePacked(
            hex"602d8060093d393df3363d3d373d3d3d363d73",
            baalSummoner.template(),
            hex"5af43d82803e903d91602b57fd5bf3"
        );
        bytes32 predictedHash = keccak256(
            abi.encodePacked(bytes1(0xff), moduleProxyFactory, _salt, keccak256(bytecode))
        );

        return address(uint160(uint(predictedHash)));
    }

    /**
     * @dev Summon a new Baal contract with a new set of tokens, optional vault and shaman
     * @param initializationLootTokenParams The parameters for deploying the token
     * @param initializationShareTokenParams The parameters for deploying the token
     * @param initializationShamanParams  The parameters for deploying the shaman
     * @param postInitializationActions The actions to be performed after the initialization
     */
    function summonBaalFromReferrer(
        bytes calldata initializationLootTokenParams,
        bytes calldata initializationShareTokenParams,
        bytes calldata initializationShamanParams, // maybe break out baal init params and shaman init params
        bytes[] memory postInitializationActions,
        uint256 saltNonce
    ) external virtual returns (address) {
        address predictedBaalAddress = calculateBaalAddress(saltNonce);
        //
        address lootToken = deployLootToken(initializationLootTokenParams, predictedBaalAddress);

        address sharesToken = deploySharesToken(initializationShareTokenParams, predictedBaalAddress);

        (bytes[] memory amendedPostInitActions, address[] memory shamans) = deployShamans(
            predictedBaalAddress,
            postInitializationActions,
            initializationShamanParams,
            saltNonce
        );

        // summon baal with new tokens
        (address baal, address vault) = summon(amendedPostInitActions, lootToken, sharesToken, saltNonce);

        // console.log("baal >>", baal, predictedBaalAddress);
        // post deploy hooks
        postDeployShamanActions(initializationShamanParams, lootToken, sharesToken, shamans, baal, vault);

        return baal;
    }

    /**
     * @dev Summon a new Baal contract with a new set of tokens
     * @param postInitActions The actions to be performed after the initialization
     * @param lootToken The address of the loot token
     * @param sharesToken The address of the shares token
     * @param saltNounce The salt nonce for the summon
     */
    function summon(
        bytes[] memory postInitActions,
        address lootToken,
        address sharesToken,
        uint256 saltNounce
    ) internal virtual returns (address baal, address vault) {}

    /**
     * @dev postDeployShamanActions by default tokens are transfered to baal
     * @param initializationShamanParams The parameters for deploying the token
     * @param lootToken The address of the loot token
     * @param sharesToken The address of the shares token
     * @param shamans The address of the shaman
     * @param baal The address of the baal
     * @param vault The address of the vault
     */
    function postDeployShamanActions(
        bytes calldata initializationShamanParams,
        address lootToken,
        address sharesToken,
        address[] memory shamans,
        address baal,
        address vault
    ) internal virtual {}

    /**
     * @dev deployLootToken
     * @param initializationParams The parameters for deploying the token
     */
    function deployLootToken(
        bytes calldata initializationParams,
        address initialOwner
    ) internal virtual returns (address token) {
        token = deployToken(initializationParams);
        IBaalToken(token).transferOwnership(initialOwner);
    }

    /**
     * @dev deploySharesToken
     * @param initializationParams The parameters for deploying the token
     */
    function deploySharesToken(
        bytes calldata initializationParams,
        address initialOwner
    ) internal virtual returns (address token) {
        token = deployToken(initializationParams);
        IBaalToken(token).transferOwnership(initialOwner);
    }

    /**
     * @dev deployToken
     * @param initializationParams The parameters for deploying the token
     */
    function deployToken(bytes calldata initializationParams) internal virtual returns (address token) {
        (address template, bytes memory initDeployParams) = abi.decode(initializationParams, (address, bytes));
        require(template != address(0), "HOS: template address is zero");
        require(isTemplateInAllowlist(template), "HOS: template not in allowlist");

        (string memory name, string memory symbol) = abi.decode(initDeployParams, (string, string));

        // ERC1967 could be upgradable
        token = address(
            new ERC1967Proxy(template, abi.encodeWithSelector(IBaalToken(template).setUp.selector, name, symbol))
        );

        emit DeployBaalToken(token);
    }

    /**
     * @dev deployShamans
     * the setShaman action is added to the postInitializationActions
     * shaman is not fully setup here, only the address is set
     * @param baalAddress The address of the baal
     * @param postInitializationActions The actions to be performed after the initialization
     * @param initializationShamanParams Initialization shaman params used in post deploy init
     * @param saltNonce salt nonce
     */
    function deployShamans(
        address baalAddress,
        bytes[] memory postInitializationActions,
        bytes memory initializationShamanParams,
        uint256 saltNonce
    ) internal virtual returns (bytes[] memory, address[] memory) {
        // summon shaman

        (
            address[] memory shamanTemplates,
            uint256[] memory shamanPermissions,
            bytes[] memory initShamanDeployParams
        ) = abi.decode(initializationShamanParams, (address[], uint256[], bytes[]));
        require(
            shamanTemplates.length == shamanPermissions.length &&
                shamanTemplates.length == initShamanDeployParams.length,
            "HOS: shamanTemplates length mismatch"
        );

        uint256 actionsLength = postInitializationActions.length;
        // amend postInitializationActions to include setShamans
        bytes[] memory amendedPostInitActions = new bytes[](actionsLength + 1);

        // create arrays to hold new shaman addresses
        address[] memory shamanAddresses = new address[](shamanTemplates.length);

        for (uint256 i; i < shamanTemplates.length; ) {
            require(shamanTemplates[i] != address(0), "HOS: shamanTemplates address is zero");
            require(isTemplateInAllowlist(shamanTemplates[i]), "HOS: template not in allowlist");
            // Clones because it should not need to be upgradable
            bytes32 salt = keccak256(
                abi.encode(
                    baalAddress,
                    i,
                    shamanTemplates[i],
                    shamanPermissions[i],
                    keccak256(initShamanDeployParams[i]),
                    saltNonce
                )
            );
            shamanAddresses[i] = Clones.cloneDeterministic(shamanTemplates[i], salt);

            // add shaman to deployed mapping
            deployedShamans[shamanAddresses[i]] = "0x01";

            unchecked {
                ++i;
            }
        }

        // copy over the rest of the actions
        for (uint256 i; i < actionsLength; ) {
            amendedPostInitActions[i] = postInitializationActions[i];
            unchecked {
                ++i;
            }
        }
        amendedPostInitActions[actionsLength] = abi.encodeWithSignature(
            "setShamans(address[],uint256[])",
            shamanAddresses,
            shamanPermissions
        );

        return (amendedPostInitActions, shamanAddresses);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    // solhint-disable-next-line state-visibility, var-name-mixedcase
    uint256[46] __gap;
}
