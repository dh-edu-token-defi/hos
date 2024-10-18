// SPDX-License-Identifier: MIT
pragma solidity >=0.8.7 <0.9.0;

import { Enum } from "@gnosis.pm/safe-contracts/contracts/common/Enum.sol";
import { MultiSend } from "@gnosis.pm/safe-contracts/contracts/libraries/MultiSend.sol";
import { IAvatar } from "@gnosis.pm/zodiac/contracts/interfaces/IAvatar.sol";

import { ShamanBase } from "./ShamanBase.sol";
import { ZodiacModule } from "./ZodiacModule.sol";

/// @notice Contract is currently not enabled as a module
error ZodiacModuleShaman__NotEnabledModule();

/**
 * @title Baal Shaman + Zodiac Module contract
 * @author DAOHaus
 * @notice Implement the base functionality for a Shaman contract to also have Zodiac module capabilities
 * @dev Inherits from ZodiacModule
 */
abstract contract ZodiacModuleShaman is ZodiacModule, ShamanBase {
    /**
     * A modifier for methods that require to check zodiac module privileges
     */
    modifier isModuleEnabled() {
        if (!moduleEnabled()) revert ZodiacModuleShaman__NotEnabledModule();
        _;
    }

    /**
     * @notice Initializer function
     * @param _name shaman name
     * @param _baalAddress baal address
     * @param _vaultAddress ball vault address
     */
    function __ZodiacModuleShaman_init(
        string memory _name,
        address _baalAddress,
        address _vaultAddress
    ) internal onlyInitializing {
        __ShamanBase_init(_name, _baalAddress, _vaultAddress);
        _vaultAddress = vault();
        __ZodiacModuleShaman_init_unchained(abi.encode(_vaultAddress, _vaultAddress));
    }

    /**
     * @notice Local initializer function
     * @param _initializeParams Abi encoded Zodiac initialization params
     */
    function __ZodiacModuleShaman_init_unchained(bytes memory _initializeParams) internal onlyInitializing {
        setUp(_initializeParams);
    }

    /**
     * @notice Zodiac initializer function
     * @inheritdoc ZodiacModule
     */
    function setUp(bytes memory _initializeParams) public virtual override(ZodiacModule) onlyInitializing {
        super.setUp(_initializeParams);
        transferOwnership(vault());
    }

    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override(ShamanBase) returns (bool) {
        return interfaceId == type(ZodiacModule).interfaceId || super.supportsInterface(interfaceId);
    }

    /**
     * @notice Returns true if the contract is set as a Safe module
     * @inheritdoc ZodiacModule
     */
    function moduleEnabled() public view override returns (bool) {
        return IAvatar(vault()).isModuleEnabled(address(this));
    }

    /**
     * @notice Util function to encode a tx call as a Safe multiSend action
     * @param _operation call or delegate call
     * @param _to calling contract or recipient address
     * @param _value value to be sent
     * @param _callData calldata to be called on recipient
     */
    function encodeMultiSendAction(
        Enum.Operation _operation,
        address _to,
        uint256 _value,
        bytes memory _callData
    ) public pure returns (bytes memory) {
        return abi.encodePacked(_operation, _to, _value, _callData.length, _callData);
    }

    /**
     * @notice Encodes and executes a multiSend tx to `avatar` using the contract Zodiac module privileges
     * @dev transactions should follow the same encoding method used by the Safe MultiSend library
     * @param _transactions multiSend-like encoded transactions
     * @return success whether or not the multiSend call succeeded
     * @return returnData data returned by the multiSend call
     */
    function execMultiSendCall(bytes memory _transactions) internal returns (bool success, bytes memory returnData) {
        bytes memory multiSendCalldata = abi.encodeCall(MultiSend.multiSend, (_transactions));

        (success, returnData) = execAndReturnData(
            _baal.multisendLibrary(),
            0,
            multiSendCalldata,
            Enum.Operation.DelegateCall
        );
    }
}
