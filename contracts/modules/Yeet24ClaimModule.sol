// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PausableUpgradeable.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import { IHOSBase } from "../hos/IHOSBase.sol";
import { IYeet24Shaman } from "../memeYeeter/IYeet24Shaman.sol";

import { IYeet24ClaimModule } from "./IYeet24ClaimModule.sol";

contract Yeet24ClaimModule is
    IYeet24ClaimModule,
    Initializable,
    PausableUpgradeable,
    OwnableUpgradeable,
    UUPSUpgradeable
{
    uint256 public maxReward; // 300000000000000000 // max reward 0.3 eth
    uint256 public rewardPercent; // 15% of shaman balance
    bytes32 public shamanTemplateId; // matches id
    address public hos; // base deployer

    event RewardClaimed(address vault, address shaman, uint256 reward);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function __Yeet24ClaimModule_init(bytes memory initializationParams) public initializer {
        __Pausable_init();
        __UUPSUpgradeable_init();
        address initialOwner;
        (initialOwner, hos, shamanTemplateId, maxReward, rewardPercent) = abi.decode(
            initializationParams,
            (address, address, bytes32, uint256, uint256)
        );
        __Ownable_init(initialOwner);
    }

    // is ok to claim
    modifier isWhiteListedShaman() {
        require(IHOSBase(hos).deployedShamans(_msgSender()) == shamanTemplateId, "Yeet24ClaimModule: !approved");
        _;
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }

    function setMaxReward(uint256 _maxReward) public onlyOwner {
        maxReward = _maxReward;
    }

    function setRewardPercent(uint256 _rewardPercent) public onlyOwner {
        rewardPercent = _rewardPercent;
    }

    function claimReward(address vault, address payable shaman) public isWhiteListedShaman returns (uint256 reward) {
        if (maxReward == 0 || address(this).balance == 0) {
            return 0;
        }
        // transfer reward to sender

        uint256 vaultBalance = vault.balance;
        reward = (vaultBalance * rewardPercent) / 100;
        if (reward > maxReward) {
            reward = maxReward;
        }
        if (reward > address(this).balance) {
            reward = address(this).balance;
        }

        (bool transferSuccess, ) = shaman.call{ value: reward }("");
        require(transferSuccess, "Yeet24ClaimModule: transfer failed");
        emit RewardClaimed(vault, shaman, reward);
    }

    /**
     * @notice Accept ETH deposits
     * @dev fallback function to accept ETH deposits
     */
    receive() external payable {}

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
