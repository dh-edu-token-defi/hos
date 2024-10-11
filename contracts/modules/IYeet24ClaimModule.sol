// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.20;

import { IERC165 } from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

interface IYeet24ClaimModule is IERC165 {
    function claimReward(address vault, address payable shaman) external returns (uint256);
    function updateRewardsConfig(uint256 _maxReward, uint256 _rewardPercent) external;
}
