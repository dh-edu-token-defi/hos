// SPDX-License-Identifier: MIT
pragma solidity >=0.8.7 <0.9.0;

import { IAdminShaman } from "./interfaces/IAdminShaman.sol";
import { IERC165, ShamanBase } from "./ShamanBase.sol";

/// @notice Shaman does not have admin privileges
error AdminShaman__NoAdminRole();

/**
 * @title Baal Shaman Admin contract
 * @author DAOHaus
 * @notice Implement the base functionality for a Shaman with admin privileges
 * @dev Inherits from ShamanBase
 */
abstract contract AdminShaman is ShamanBase, IAdminShaman {
    /**
     * @notice A modifier for methods that require to check shaman admin privileges
     */
    modifier isBaalAdmin() {
        if (!isAdmin()) revert AdminShaman__NoAdminRole();
        _;
    }

    /**
     * @notice A modifier for methods that require to check shaman admin privileges
     */
    modifier baalOrAdminOnly() {
        if (_msgSender() != _vault && !_baal.isAdmin(_msgSender())) revert AdminShaman__NoAdminRole();
        _;
    }

    /**
     * @notice Initializer function
     * @dev Should be called during contract initializaton
     * @param _name shaman name
     * @param _baalAddress baal address
     * @param _vaultAddress baal vault address
     */
    function __AdminShaman_init(
        string memory _name,
        address _baalAddress,
        address _vaultAddress
    ) internal onlyInitializing {
        __ShamanBase_init(_name, _baalAddress, _vaultAddress);
        __AdminShaman_init_unchained();
    }

    /**
     * @notice Local initializer function
     * @dev Should be called through main initializer to set any local state variables
     */
    function __AdminShaman_init_unchained() internal onlyInitializing {}

    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override(ShamanBase, IERC165) returns (bool) {
        return interfaceId == type(IAdminShaman).interfaceId || super.supportsInterface(interfaceId);
    }

    /**
     * @notice Returns true if Baal shaman has admin permissions
     * @inheritdoc IAdminShaman
     */
    function isAdmin() public view virtual returns (bool) {
        return _baal.isAdmin(address(this));
    }

    /**
     * @notice Set baal admin config parameters
     * @inheritdoc IAdminShaman
     */
    function setAdminConfig(bool pauseShares, bool pauseLoot) public virtual baalOrAdminOnly {
        _baal.setAdminConfig(pauseShares, pauseLoot);
    }
}
