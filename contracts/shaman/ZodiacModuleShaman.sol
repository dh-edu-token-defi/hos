// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity >=0.8.7 <0.9.0;

import { Enum } from "@gnosis.pm/safe-contracts/contracts/common/Enum.sol";
import { MultiSend } from "@gnosis.pm/safe-contracts/contracts/libraries/MultiSend.sol";
import { IAvatar } from "@gnosis.pm/zodiac/contracts/interfaces/IAvatar.sol";

import { ShamanBase } from "./ShamanBase.sol";
import { ZodiacModule } from "./ZodiacModule.sol";

error ZodiacModuleShaman__NotEnabledModule();

abstract contract ZodiacModuleShaman is ZodiacModule, ShamanBase {
    modifier isModuleEnabled() {
        if (!moduleEnabled()) revert ZodiacModuleShaman__NotEnabledModule();
        _;
    }

    function __ZodiacModuleShaman__init(
        string memory _name,
        address _baalAddress,
        address _vaultAddress
    ) internal onlyInitializing {
        __ShamanBase_init(_name, _baalAddress, _vaultAddress);
        _vaultAddress = vault();
        __ZodiacModuleShaman__init_unchained(abi.encode(_vaultAddress, _vaultAddress));
    }

    function __ZodiacModuleShaman__init_unchained(bytes memory _initializeParams) internal onlyInitializing {
        setUp(_initializeParams);
    }

    function setUp(bytes memory _initializeParams) public virtual override(ZodiacModule) onlyInitializing {
        super.setUp(_initializeParams);
        transferOwnership(vault());
    }

    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override(ShamanBase) returns (bool) {
        return
            interfaceId == type(ZodiacModule).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    function moduleEnabled() public view override returns (bool) {
        return IAvatar(vault()).isModuleEnabled(address(this));
    }

    function encodeMultiSendAction(Enum.Operation _operation, address _to, uint256 _value, bytes memory _callData) public pure returns (bytes memory) {
        return abi.encodePacked(_operation, _to, _value, _callData.length, _callData);
    }

    function _execMultiSendCall(bytes memory _transactions) internal returns (bool success, bytes memory returnData) {
        bytes memory multiSendCalldata = abi.encodeCall(MultiSend.multiSend, (_transactions));

        (success, returnData) = execAndReturnData(
            _baal.multisendLibrary(),
            0,
            multiSendCalldata,
            Enum.Operation.DelegateCall
        );
    }
}
