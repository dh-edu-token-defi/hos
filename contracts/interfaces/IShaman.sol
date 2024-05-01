//SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IShaman {
    function setup(address dao, address vault, bytes memory initParams) external;
}
