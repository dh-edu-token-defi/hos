// SPDX-License-Identifier: MIT
pragma solidity >=0.8.7 <0.9.0;

import { IShaman } from "./IShaman.sol";

/**
 * @title Baal Shaman Governor interface
 * @author DAOHaus
 * @notice Interface to implement a Shaman contract with governor capabilities
 * @dev Inherits base ISHaman interface
 */
interface IGovernorShaman is IShaman {
    /**
     * @notice Returns true if Baal shaman has governor permissions
     * @dev Should use baal to fetch shaman permissions
     * @return true whether shaman has governor permissions or not
     */
    function isGovernor() external view returns (bool);

    /**
     * @notice Cancel an active proposal in baal
     * @dev Should fail if baal revoked shamans permissions
     * @param _proposalId baal proposal Id
     */
    function cancelProposal(uint32 _proposalId) external;

    /**
     * @notice Set baal governance parameters such as:
     * - voting & grace periods
     * - tribute, quorum, sponsor threshold & retention bound
     * @dev Should fail if baal revoked shamans permissions.
     * @param _governanceConfig ABI encoded governance parameters
     */
    function setGovernanceConfig(bytes memory _governanceConfig) external;

    /**
     * @notice Set baal trusted forwarded for meta txs
     * @dev Should fail if baal revoked shamans permissions.
     * @param _trustedForwarderAddress forwarded contract address
     */
    function setTrustedForwarder(address _trustedForwarderAddress) external;
}
