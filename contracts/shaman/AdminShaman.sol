// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity >=0.8.7 <0.9.0;

import { IAdminShaman } from "./interfaces/IAdminShaman.sol";
import { IERC165, ShamanBase } from "./ShamanBase.sol";

error AdminShaman__NoAdminRole();

abstract contract AdminShaman is ShamanBase, IAdminShaman {

    modifier isBaalAdmin() {
        if(!isAdmin()) revert AdminShaman__NoAdminRole();
        _;
    }

    function __AdminShaman_init(string memory _name, address _baalAddress, address _vaultAddress) internal onlyInitializing {
        __ShamanBase_init(_name, _baalAddress, _vaultAddress);
        __AdminShaman_init_unchained();
    }

    function __AdminShaman_init_unchained() internal onlyInitializing { }

    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override(ShamanBase, IERC165) returns (bool) {
        return
            interfaceId == type(IAdminShaman).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    function isAdmin() public view virtual returns (bool) {
        return _baal.isAdmin(address(this));
    }

    function setAdminConfig(bool pauseShares, bool pauseLoot) public virtual {
        _baal.setAdminConfig(pauseShares, pauseLoot);
    }
}
