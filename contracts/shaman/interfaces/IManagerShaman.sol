// SPDX-License-Identifier: MIT
pragma solidity >=0.8.7 <0.9.0;

import { IShaman } from "./IShaman.sol";

/**
 * @title Baal Shaman Manager interface
 * @author DAOHaus
 * @notice Interface to implement a Shaman contract with manager capabilities
 * @dev Inherits base ISHaman interface
 */
interface IManagerShaman is IShaman {
    /**
     * @notice Returns true if Baal shaman has manager permissions
     * @dev Should use baal to fetch shaman permissions
     * @return true whether shaman has manager permissions or not
     */
    function isManager() external view returns (bool);

    /**
     * @notice Mint an amount of baal shares to specified addresses
     * @dev Should fail if baal revoked shamans permissions
     * @param to a list of recipient address
     * @param amount a list of share amounts to mint per recipient
     */
    function mintShares(address[] calldata to, uint256[] calldata amount) external;

    /**
     * @notice Burn an amount of baal shares to specified addresses
     * @dev Should fail if baal revoked shamans permissions
     * @param from a list of addresses to burn shares
     * @param amount a list of share amounts to burn per recipient
     */
    function burnShares(address[] calldata from, uint256[] calldata amount) external;

    /**
     * @notice Mint an amount of baal loot to specified addresses
     * @dev Should fail if baal revoked shamans permissions
     * @param to a list of recipient address
     * @param amount a list of loot amounts to mint per recipient
     */
    function mintLoot(address[] calldata to, uint256[] calldata amount) external;

    /**
     * @notice Burn an amount of baal loot to specified addresses
     * @dev Should fail if baal revoked shamans permissions
     * @param from a list of addresses to burn loot tokens
     * @param amount a list of loot amounts to burn per recipient
     */
    function burnLoot(address[] calldata from, uint256[] calldata amount) external;
}
