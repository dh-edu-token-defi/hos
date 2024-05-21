// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity >=0.8.7 <0.9.0;

import { FactoryFriendly, Module } from "@gnosis.pm/zodiac/contracts/core/Module.sol";
import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import { ShamanBase } from "./ShamanBase.sol";

abstract contract ZodiacModuleShaman is Initializable, Module, ShamanBase {
    function __ZodiacModuleShaman__init(
        string memory _name,
        address _baalAddress,
        address _vaultAddress,
        bytes memory _initializeParams
    ) internal onlyInitializing {
        __ShamanBase_init(_name, _baalAddress, _vaultAddress);
        __ZodiacModuleShaman__init_unchained(_initializeParams);

    }

    function __ZodiacModuleShaman__init_unchained(bytes memory _initializeParams) internal onlyInitializing {
        setUp(_initializeParams);
    }

    function setUp(bytes memory /*_initializeParams*/) public override(FactoryFriendly) onlyInitializing {
        __Ownable_init();
        transferOwnership(_vault);
    }

    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override(ShamanBase) returns (bool) {
        return
            interfaceId == type(Module).interfaceId ||
            super.supportsInterface(interfaceId);
    }
}
