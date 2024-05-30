// SPDX-License-Identifier: MIT
pragma solidity >=0.8.7 < 0.9.0;

import { INonfungiblePositionManager } from "../../libs/INonfungiblePositionManager.sol";
import { IWETH9 } from "../../libs/IWETH9.sol";

interface IYeet24Shaman {
    function execute() external;

    function executed() external view returns (bool);
    function nonfungiblePositionManager() external view returns (INonfungiblePositionManager);
    function weth() external view returns (IWETH9);

    function threshold() external view returns (uint256);
    function expiration() external view returns (uint256);
    function poolFee() external view returns (uint24);

    function pool() external view returns (address);
    function positionId() external view returns (uint256);

    function createPoolAndMintPosition(
        address token0,
        address token1,
        uint256 liquidityAmount0,
        uint256 liquidityAmount1
    ) external;
}
