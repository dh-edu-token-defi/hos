// SPDX-License-Identifier: MIT
pragma solidity >=0.8.7 <0.9.0;

import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";

/**
 * @title Math utility functions
 * @author DAOHaus
 * @notice Includes math functions to calculate prices on Uniswap V3
 */
library CustomMath {
    /// @dev Scale used by Uniswap for working with Q64.96 (binary fixed-point) numbers
    uint256 constant Q96 = 2 ** 96;

    /**
     * @notice Calculates the squeare root of provided value
     * @param x value
     * @return SQRT(`value`)
     */
    function sqrt(uint256 x) internal pure returns (uint256) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2;
        uint256 y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
        return y;
    }

    /**
     * @dev Calculates the sqrtPriceX96 value for Uniswap V3 pools.
     *
     * This function computes the square root of the price ratio between two tokens
     * and adjusts it to the Uniswap V3 format, which requires the square root price
     * to be scaled by 2^96. This format is used by Uniswap V3 to facilitate high-precision
     * and low-cost arithmetic operations within the protocol.
     *
     * @param amount0 The amount of token0, where token0 is the token with a numerically lower address.
     * @param amount1 The amount of token1, where token1 is the token with a numerically higher address.
     *
     * The price ratio is calculated as the number of units of token1 equivalent to one unit of token0,
     * scaled up by 1e18 to maintain precision during the division operation.
     *
     * @return The square root of the price ratio, adjusted to the Uniswap V3 fixed-point format (sqrtPriceX96).
     *
     * Requirements:
     * - Both `amount0` and `amount1` must be greater than zero to avoid division by zero errors
     *   and ensure meaningful price calculations.
     *
     */
    function calculateSqrtPriceX96(uint256 amount0, uint256 amount1) internal pure returns (uint160) {
        require(amount0 > 0 && amount1 > 0, "Token amounts cannot be zero");

        // Calculate the price ratio as amount1 / amount0
        // Here, `amount1` is multiplied by 1e18 to retain precision after dividing by `amount0`.
        uint256 priceRatio = (amount1 * 1e18) / amount0;

        // Compute the square root of the price ratio.
        uint256 sqrtPrice = sqrt(priceRatio);

        // Adjust the square root price to the Uniswap V3 fixed-point format by scaling up by 2^96,
        // then dividing by 1e9 to correct for the initial scaling by 1e18.
        uint256 sqrtPriceX96 = (sqrtPrice * Q96) / 1e9;

        // Return the result as a uint160, conforming to the Uniswap V3 type requirement for sqrtPriceX96.
        return uint160(sqrtPriceX96);
    }
}
