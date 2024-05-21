// SPDX-License-Identifier: MIT
pragma solidity >=0.8.7 < 0.9.0;

interface IYeet24Shaman {
    function execute() external;
    
    function executed() external view returns (bool);

    function createPoolAndMintPosition(
        address token0,
        address token1,
        uint256 liquidityAmount0,
        uint256 liquidityAmount1
    ) external;
}
