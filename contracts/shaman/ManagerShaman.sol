// SPDX-License-Identifier: MIT
pragma solidity >=0.8.7 <0.9.0;

import { IManagerShaman } from "./interfaces/IManagerShaman.sol";
import { IERC165, ShamanBase } from "./ShamanBase.sol";

/// @notice Shaman does not have manager privileges
error ManagerShaman__NoManagerRole();

/**
 * @title Baal Shaman Manager contract
 * @author DAOHaus
 * @notice Implement the base functionality for a Shaman with manager privileges
 * @dev Inherits from ShamanBase
 */
abstract contract ManagerShaman is ShamanBase, IManagerShaman {

    /**
     * @notice A modifier for methods that require to check shaman manager privileges
     */
    modifier isBaalManager() {
        if(!isManager()) revert ManagerShaman__NoManagerRole();
        _;
    }

    /**
     * @notice Initializer function
     * @dev Should be called during contract initializaton
     * @param _name shaman name
     * @param _baalAddress baal address
     * @param _vaultAddress baal vault address
     */
    function __ManagerShaman_init(string memory _name, address _baalAddress, address _vaultAddress) internal onlyInitializing {
        __ShamanBase_init(_name, _baalAddress, _vaultAddress);
        __ManagerShaman_init_unchained();
    }

    /**
     * @notice Local initializer function
     * @dev Should be called through main initializer to set any local state variables
     */
    function __ManagerShaman_init_unchained() internal onlyInitializing { }

    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override(ShamanBase, IERC165) returns (bool) {
        return
            interfaceId == type(IManagerShaman).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    /**
     * 
     * @inheritdoc IManagerShaman
     */
    function isManager() public view virtual returns (bool) {
        return _baal.isManager(address(this));
    }

    /**
     * @notice Mint an amount of baal shares to specified addresses
     * @inheritdoc IManagerShaman
     */
    function mintShares(address[] calldata to, uint256[] calldata amount) public virtual {
        _baal.mintShares(to, amount);
    }

    /**
     * @notice Burn an amount of baal shares to specified addresses
     * @inheritdoc IManagerShaman
     */
    function burnShares(address[] calldata from, uint256[] calldata amount) public virtual {
        _baal.burnShares(from, amount);
    }

    /**
     * @notice Mint an amount of baal loot to specified addresses
     * @inheritdoc IManagerShaman
     */
    function mintLoot(address[] calldata to, uint256[] calldata amount) public virtual {
        _baal.mintLoot(to, amount);
    }

    /**
     * @notice Burn an amount of baal loot to specified addresses
     * @inheritdoc IManagerShaman
     */
    function burnLoot(address[] calldata from, uint256[] calldata amount) public virtual {
        _baal.burnLoot(from, amount);
    }
}
