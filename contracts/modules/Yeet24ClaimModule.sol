// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.20;

import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { ERC165Upgradeable, IERC165 } from "@openzeppelin/contracts-upgradeable/utils/introspection/ERC165Upgradeable.sol";
import { PausableUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";

import { IHOSBase } from "../hos/IHOSBase.sol";
import { IYeet24Shaman } from "../memeYeeter/IYeet24Shaman.sol";

import { IYeet24ClaimModule } from "./IYeet24ClaimModule.sol";

contract Yeet24ClaimModule is
    IYeet24ClaimModule,
    ERC165Upgradeable,
    PausableUpgradeable,
    OwnableUpgradeable,
    UUPSUpgradeable
{
    uint256 public maxReward; // 300000000000000000 // max reward 0.3 eth
    uint256 public rewardPercent; // 15% of shaman balance
    bytes32 public shamanTemplateId; // matches id
    address public hos; // base deployer

    event RewardClaimed(address vault, address shaman, uint256 reward);
    event RewardsConfigUpdated(uint256 _maxReward, uint256 _rewardPercent);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    modifier isWhitelistedShaman() {
        require(IHOSBase(hos).deployedShamans(_msgSender()) == shamanTemplateId, "Yeet24ClaimModule: !approved");
        _;
    }

    function __Yeet24ClaimModule_init(bytes memory initializationParams) internal onlyInitializing {
        __Pausable_init();
        (address initialOwner) = abi.decode(initializationParams, (address));
        __Ownable_init(initialOwner);
        __UUPSUpgradeable_init();
        __Yeet24ClaimModule_init_unchained(initializationParams);
    }

    function __Yeet24ClaimModule_init_unchained(bytes memory initializationParams) internal onlyInitializing {
        (, hos, shamanTemplateId, maxReward, rewardPercent) = abi.decode(
            initializationParams,
            (address, address, bytes32, uint256, uint256)
        );
        require(rewardPercent <= 100, "invalid rewardPercent");
        emit RewardsConfigUpdated(maxReward, rewardPercent);
    }

    function initialize(bytes memory initializationParams) public initializer {
        __Yeet24ClaimModule_init(initializationParams);
    }

    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(ERC165Upgradeable, IERC165) returns (bool) {
        return interfaceId == type(IYeet24ClaimModule).interfaceId || super.supportsInterface(interfaceId);
    }

    function pause(bool _pauseToggle) external onlyOwner {
        if (_pauseToggle) _pause();
        else _unpause();
    }

    function updateRewardsConfig(uint256 _maxReward, uint256 _rewardPercent) external onlyOwner {
        require(_rewardPercent <= 100, "invalid rewardPercent");
        maxReward = _maxReward;
        rewardPercent = _rewardPercent;
        emit RewardsConfigUpdated(_maxReward, _rewardPercent);
    }

    function claimReward(address vault, address payable shaman) public isWhitelistedShaman returns (uint256 reward) {
        if (maxReward == 0 || address(this).balance == 0) {
            return 0;
        }
        // transfer reward to sender

        uint256 vaultBalance = vault.balance;
        reward = (vaultBalance * rewardPercent) / 100;
        if (reward > maxReward) {
            // cap to maxReward
            reward = maxReward;
        }
        if (reward > address(this).balance) {
            // send remainder funds if not enough balance
            reward = address(this).balance;
        }

        (bool transferSuccess, ) = shaman.call{ value: reward }("");
        require(transferSuccess, "Yeet24ClaimModule: transfer failed");
        emit RewardClaimed(vault, shaman, reward);
    }

    function withdrawFunds() external onlyOwner {
        (bool success, ) = payable(_msgSender()).call{value: address(this).balance}("");
        require(success, "failed");
    }

    /**
     * @notice Accept ETH deposits
     * @dev fallback function to accept ETH deposits
     */
    receive() external payable {}

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    // TODO: ownable function to withdraw balance 

    // solhint-disable-next-line state-visibility, var-name-mixedcase
    uint256[50] __gap;
}
