// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.8.7;
pragma abicoder v2;

/// @title Non-fungible token for positions
/// @notice Wraps Uniswap V3 positions in a non-fungible token interface which allows for them to be transferred
/// and authorized.
interface IPoolInitializer {
    function createAndInitializePoolIfNecessary(
        address token0,
        address token1,
        uint24 fee,
        uint160 sqrtPriceX96
    ) external payable returns (address pool);
}
