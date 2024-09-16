// SPDX-License-Identifier: MIT
pragma solidity >=0.8.7 <0.9.0;

import { IBaal } from "@daohaus/baal-contracts/contracts/interfaces/IBaal.sol";
import { IERC165 } from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import { ERC165Upgradeable } from "@openzeppelin/contracts-upgradeable/utils/introspection/ERC165Upgradeable.sol";
import { ContextUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import {
    ReentrancyGuardUpgradeable
} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

import { IShaman } from "./interfaces/IShaman.sol";

import { IHOSBase } from "../hos/IHOSBase.sol";

/// @notice Provided address is invalid
error ShamanBase__InvalidAddress();
/// @notice Provided name is invalid
error ShamanBase__InvalidName();

/**
 * @title Baal Shaman Base contract
 * @author DAOHaus
 * @notice Implement the base functionality for a Shaman contract
 * @dev This contract should not be be directly inherited. Use one of the shaman flavours instead
 *      (e.g. admin, manager, governor)
 */
abstract contract ShamanBase is IShaman, ContextUpgradeable, ReentrancyGuardUpgradeable, ERC165Upgradeable {
    /// @notice shaman name
    string internal NAME;
    /// @notice baal address
    IBaal internal _baal;
    /// @notice vault address
    address internal _vault;

    /**
     * @notice Initializer function
     * @dev Should be called during contract initializaton
     * @param _name shaman name
     * @param _baalAddress baal address
     * @param _vaultAddress baal vault address
     */
    function __ShamanBase_init(
        string memory _name,
        address _baalAddress,
        address _vaultAddress
    ) internal onlyInitializing {
        if (bytes(_name).length == 0) revert ShamanBase__InvalidName();
        if (_baalAddress == address(0)) revert ShamanBase__InvalidAddress();
        __Context_init();
        __ReentrancyGuard_init();
        __ERC165_init();
        __ShamanBase_init_unchained(_name, _baalAddress, _vaultAddress);
    }

    /**
     * @notice Local initializer function
     * @dev Should be called through main initializer to set any local state variables
     * @param _name shaman name
     * @param _baalAddress baal address
     * @param _vaultAddress baal vault address
     */
    function __ShamanBase_init_unchained(
        string memory _name,
        address _baalAddress,
        address _vaultAddress
    ) internal onlyInitializing {
        NAME = _name;
        _baal = IBaal(_baalAddress);
        _vault = _vaultAddress == address(0) ? _baal.avatar() : _vaultAddress;
    }

    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(ERC165Upgradeable, IERC165) returns (bool) {
        return interfaceId == type(IShaman).interfaceId || super.supportsInterface(interfaceId);
    }

    /**
     * @notice Gets the dao address associated with the shaman
     * @inheritdoc IShaman
     */
    function baal() public view returns (address) {
        return address(_baal);
    }

    /**
     * @notice Gets the name of the shaman
     * @inheritdoc IShaman
     */
    function name() public view returns (string memory) {
        return NAME;
    }

    /**
     * @notice Gets the vault address associated with `baal`
     * @inheritdoc IShaman
     */
    function vault() public view returns (address) {
        return _vault;
    }
}
