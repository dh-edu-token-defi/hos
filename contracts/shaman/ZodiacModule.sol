// SPDX-License-Identifier: MIT
pragma solidity >=0.8.7 <0.9.0;

import { FactoryFriendly, Module } from "@gnosis.pm/zodiac/contracts/core/Module.sol";

/**
 * @title Zodiac Base Module contract
 * @author DAOHaus
 * @notice Implement the base functionality for a contract to become a Zodiac module
 * @dev Inherits from Gnosis Module
 */
abstract contract ZodiacModule is Module {
    /**
     * @notice Returns true if the contract is set as a Safe module
     * @dev Should use avatar to eval if contract is currently added as a module
     * @return whether or not the contract is enabled as a module
     */
    function moduleEnabled() public virtual view returns (bool);

    /**
     * @notice Initializer function
     * @dev Parameters should be ABI encoded in `_initializeParams`
     */
    function setUp(bytes memory _initializeParams) public virtual override(FactoryFriendly) onlyInitializing {
        __Ownable_init();
        (avatar, target) = abi.decode(_initializeParams, (address, address));
    }
}
