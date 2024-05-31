// SPDX-License-Identifier: MIT
pragma solidity >=0.8.7 < 0.9.0;

interface IYeetNftEscrowShaman {
    function execute() external;

    function executed() external view returns (bool);

    function threshold() external view returns (uint256);
    function expiration() external view returns (uint256);
    function seller() external view returns (address);
    function nftAddress() external view returns (address);
    function tokenId() external view returns (uint256);

}
