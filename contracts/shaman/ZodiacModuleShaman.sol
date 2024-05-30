// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity >=0.8.7 <0.9.0;

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
        address _vaultAddress,
        bytes memory _initializeParams
    ) internal onlyInitializing {
        __ShamanBase_init(_name, _baalAddress, _vaultAddress);
        __ZodiacModuleShaman__init_unchained(_initializeParams);

    }

    function __ZodiacModuleShaman__init_unchained(bytes memory _initializeParams) internal onlyInitializing {
        setUp(_initializeParams);
    }

    function setUp(bytes memory _initializeParams) public virtual override(ZodiacModule) onlyInitializing {
        super.setUp(_initializeParams);
        transferOwnership(_vault);
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
}
