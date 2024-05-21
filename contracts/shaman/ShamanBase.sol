// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity >=0.8.7 <0.9.0;

import { IBaal } from "@daohaus/baal-contracts/contracts/interfaces/IBaal.sol";
import { IERC165 } from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import { ERC165Upgradeable } from "@openzeppelin/contracts-upgradeable/utils/introspection/ERC165Upgradeable.sol";
import { ContextUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

import { IShaman } from "./interfaces/IShaman.sol";

error ShamanBase__InvalidAddress();
error ShamanBase__InvalidName();

abstract contract ShamanBase is IShaman, ContextUpgradeable, ReentrancyGuardUpgradeable, ERC165Upgradeable {
    string internal NAME;
    IBaal internal _baal;
    address internal _vault;

    function __ShamanBase_init(string memory _name, address _baalAddress, address _vaultAddress) internal onlyInitializing {
        if (bytes(_name).length == 0) revert ShamanBase__InvalidName();
        if (_baalAddress == address(0) || _vaultAddress == address(0)) revert ShamanBase__InvalidAddress();
        __Context_init();
        __ReentrancyGuard_init();
        __ERC165_init();
        __ShamanBase_init_unchained(_name, _baalAddress, _vaultAddress);
    }

    function __ShamanBase_init_unchained(string memory _name, address _baalAddress, address _vaultAddress) internal onlyInitializing {
        NAME = _name;
        _baal = IBaal(_baalAddress);
        _vault = _vaultAddress;
    }

    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC165Upgradeable, IERC165) returns (bool) {
        return
            interfaceId == type(IShaman).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    function baal() public view returns (address) {
        return address(_baal);
    }

    function name() public view returns (string memory) {
        return NAME;
    }

    function vault() public view returns (address) {
        return _vault;
    }
}
