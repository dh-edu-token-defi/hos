// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity >=0.8.7 <0.9.0;

import { FactoryFriendly, Module } from "@gnosis.pm/zodiac/contracts/core/Module.sol";

abstract contract ZodiacModule is Module {
    function moduleEnabled() public virtual view returns (bool);

    function setUp(bytes memory _initializeParams) public virtual override(FactoryFriendly) onlyInitializing {
        __Ownable_init();
        (avatar, target) = abi.decode(_initializeParams, (address, address));
    }
}
