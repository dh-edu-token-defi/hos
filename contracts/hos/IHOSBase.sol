// SPDX-License-Identifier: MIT
pragma solidity >=0.8.7 <0.9.0;

/**
 * @title hos interface
 * @author DAOHaus
 */
interface IHOSBase {
    function registerShaman(address shamanAddress, bytes32 shamanId) external;

    function deployedShamans(address shamanAddress) external view returns (bytes32);
}
