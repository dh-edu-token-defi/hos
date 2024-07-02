// SPDX-License-Identifier: MIT
pragma solidity >=0.8.7 <0.9.0;

import { IERC165 } from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

/**
 * @title Baal Shaman Base interface
 * @author DAOHaus
 * @notice Base interface to implement a Shaman contract
 * @dev Supports ERC165 to detect what interfaces a smart contract implements
 * Interface ID: 0xd2296f8d
 */
interface IShaman is IERC165 {
    /**
     * @notice Gets the dao address associated with the shaman
     * @dev Should return the Baal address
     * @return dao address
     */
    function baal() external view returns (address);

    /**
     * @notice Gets the name of the shaman
     * @dev name is set during setup
     * @return shaman name as string
     */
    function name() external view returns (string memory);

    /**
     * @notice Initializer function to setup the shaman config
     * @dev Extra parameters should be ABI encoded in `initializeParams`.
     * Should be called during contract initialization.
     * @param baal Baal address
     * @param vault Vault address used by `baal`
     * @param initializeParams ABI encoded parameters
     */
    function setup(address baal, address vault, bytes memory initializeParams) external;

    /**
     * @notice Gets the vault address associated with `baal`
     * @dev Should return either a main treasury Baal vault or a sidecar vault
     * @return vault address
     */
    function vault() external view returns (address);
}
