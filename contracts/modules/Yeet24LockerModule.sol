// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.20;

import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {
    ERC165Upgradeable,
    IERC165
} from "@openzeppelin/contracts-upgradeable/utils/introspection/ERC165Upgradeable.sol";

import { IERC721Receiver } from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

import { INonfungiblePositionManager } from "../libs/INonfungiblePositionManager.sol";

error RecipientsAndPercentagesMismatch();
error InvalidPercentageSum(uint256 total);
error LockerAlreadyInitialized();
error LockerNotInitialized();
error Unauthorized(address caller);
error CannotTransferBeforeLockPeriod(uint256 currentTime, uint256 lockTime);

contract Yeet24LockerModule is IERC721Receiver, OwnableUpgradeable, ReentrancyGuardUpgradeable, UUPSUpgradeable {
    struct Locker {
        address[] recipients;
        uint256[] percentages;
        uint256 tokenId;
        address initialHolder;
        address singleClaimRecipient;
        uint256 createdAt;
        bool isInitialized;
    }

    uint256 public initialLockPeriod;

    INonfungiblePositionManager public positionManager;
    mapping(uint256 => Locker) public lockers; // Mapping from locker ID to locker data
    uint256 public nextLockerId;

    // events
    event LockerCreated(uint256 indexed lockerId, address initialHolder, uint256 createdAt);
    event FeesCollected(uint256 indexed lockerId, address recipient, uint256 amount0, uint256 amount1);
    event NFTTransferred(uint256 indexed lockerId, address recipient);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address initialOwner, address _positionManager, uint256 _initialLockPeriod) public initializer {
        __Ownable_init(initialOwner);
        __UUPSUpgradeable_init();
        positionManager = INonfungiblePositionManager(_positionManager);
        initialLockPeriod = _initialLockPeriod;
    }

    function createLocker(
        address[] memory _recipients,
        uint256[] memory _percentages,
        address _initialHolder
    ) external returns (uint256 lockerId) {
        if (_recipients.length != _percentages.length) {
            revert RecipientsAndPercentagesMismatch();
        }
        uint256 totalPercentage = 0;
        for (uint256 i = 0; i < _percentages.length; i++) {
            totalPercentage += _percentages[i];
        }
        if (totalPercentage != 100) {
            revert InvalidPercentageSum(totalPercentage);
        }

        lockerId = nextLockerId++;
        lockers[lockerId] = Locker({
            recipients: _recipients,
            percentages: _percentages,
            tokenId: 0,
            initialHolder: _initialHolder,
            singleClaimRecipient: _msgSender(), // should be the DAO
            createdAt: block.timestamp,
            isInitialized: false
        });
        emit LockerCreated(lockerId, _initialHolder, block.timestamp);
    }

    function initializeLocker(uint256 lockerId, uint256 tokenId) external {
        Locker storage locker = lockers[lockerId];
        if (locker.isInitialized) {
            revert LockerAlreadyInitialized();
        }

        // Transfer NFT to this contract
        positionManager.transferFrom(locker.initialHolder, address(this), tokenId);
        locker.tokenId = tokenId;
        locker.isInitialized = true;
        collectFees(lockerId);
    }

    function collectFees(uint256 lockerId) public nonReentrant {
        Locker storage locker = lockers[lockerId];
        if (!locker.isInitialized) {
            revert LockerNotInitialized();
        }

        // Collect fees from the NFT position
        INonfungiblePositionManager.CollectParams memory params = INonfungiblePositionManager.CollectParams({
            tokenId: locker.tokenId,
            recipient: address(this),
            amount0Max: type(uint128).max,
            amount1Max: type(uint128).max
        });

        (uint256 amount0, uint256 amount1) = positionManager.collect(params);

        // Retrieve token addresses
        (address token0, address token1) = getTokenAddresses(locker.tokenId);

        // Distribute fees based on time elapsed
        if (block.timestamp < locker.createdAt + initialLockPeriod) {
            for (uint256 i = 0; i < locker.recipients.length; i++) {
                uint256 share0 = (amount0 * locker.percentages[i]) / 100;
                uint256 share1 = (amount1 * locker.percentages[i]) / 100;

                // use safe transfer?
                IERC20(token0).transfer(locker.recipients[i], share0);
                IERC20(token1).transfer(locker.recipients[i], share1);
                emit FeesCollected(lockerId, locker.recipients[i], share0, share1);
            }
        } else {
            // After initialLockPeriod, send all fees to the single recipient
            payable(locker.singleClaimRecipient).transfer(amount0);

            IERC20(token0).transfer(locker.singleClaimRecipient, amount0);
            IERC20(token1).transfer(locker.singleClaimRecipient, amount1);
            emit FeesCollected(lockerId, locker.singleClaimRecipient, amount0, amount1);
        }
    }

    function transferNFTOut(uint256 lockerId) external {
        Locker storage locker = lockers[lockerId];
        if (block.timestamp < locker.createdAt + initialLockPeriod) {
            revert CannotTransferBeforeLockPeriod(block.timestamp, locker.createdAt + initialLockPeriod);
        }
        if (msg.sender != locker.singleClaimRecipient) {
            revert Unauthorized(_msgSender());
        }

        // Transfer the NFT out
        positionManager.transferFrom(address(this), _msgSender(), locker.tokenId);

        // Clear locker state
        delete lockers[lockerId];
        emit NFTTransferred(lockerId, locker.singleClaimRecipient);
    }

    function getTokenAddresses(uint256 tokenId) internal view returns (address token0, address token1) {
        INonfungiblePositionManager.Position memory position = positionManager.positions(tokenId);
        token0 = position.token0;
        token1 = position.token1;
    }

    /**
     * @dev IERC721Receiver implementation to handle incoming NFTs safely
     */
    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) external pure override returns (bytes4) {
        // Return the selector to confirm the token transfer
        return IERC721Receiver.onERC721Received.selector;
    }

    /**
     * @notice Accept ETH deposits
     * @dev fallback function to accept ETH deposits
     */
    receive() external payable {}

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
