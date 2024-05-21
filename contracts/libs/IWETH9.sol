// SPDX-License-Identifier: MIT
pragma solidity >=0.8.7 < 0.9.0;

interface IWETH9 {
    function allowance(address src, address guy) external returns (uint);
    function approve(address guy, uint wad) external returns (bool);
    function balanceOf(address account) external view returns (uint);
    function deposit() external payable;
    function transfer(address to, uint value) external returns (bool);
    function transferFrom(address src, address dst, uint wad) external returns (bool);
    function withdraw(uint wad) external;
}
