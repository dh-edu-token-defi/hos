// SPDX-License-Identifier: MIT
pragma solidity >=0.8.7 <0.9.0;

import { IShaman } from "./IShaman.sol";

/**
 * @title Baal Shaman Admin interface
 * @author DAOHaus
 * @notice Interface to implement a Shaman contract with admin capabilities
 * @dev Inherits base ISHaman interface
 * Interface ID: 0xb3b0786d
 */
interface IAdminShaman is IShaman {
    /**
     * @notice Returns true if Baal shaman has admin permissions
     * @dev Should use baal to fetch shaman permissions
     * @return true whether shaman has admin permissions or not
     */
    function isAdmin() external view returns (bool);

    /**
     * @notice Set baal admin config parameters
     * @dev Should fail if baal revoked shamans permissions
     * @param pauseShares whether or not pause Baal share token contract functionality
     * @param pauseLoot whether or not pause Baal loot token contract functionality
     */
    function setAdminConfig(bool pauseShares, bool pauseLoot) external;
}
