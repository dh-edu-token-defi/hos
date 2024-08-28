// SPDX-License-Identifier: MIT
pragma solidity >=0.8.7 <0.9.0;

interface IAuctionHausShaman {
    function execute(uint256 maxBid) external;

    // function endTime() external view returns (uint256);

    // function captain() external view returns (address);

    // function balance() external view returns (uint256);

    function auctionHouse() external view returns (address);
}
