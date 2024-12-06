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
error LockerPositionMismatch();
error Unauthorized(address caller);
error CannotTransferBeforeLockPeriod(uint256 currentTime, uint256 lockTime);

contract Yeet24LockerModule is IERC721Receiver, OwnableUpgradeable, ReentrancyGuardUpgradeable, UUPSUpgradeable {
    struct Locker {
        address[] feeRecipients;
        uint256[] feePercentages;
        uint256 tokenId;
        address initialHolder;
        address originOwner;
        uint256 createdAt;
        bool isInitialized;
    }

    uint256 public initialLockPeriod;

    INonfungiblePositionManager public positionManager;
    mapping(uint256 => Locker) public lockers; // Mapping from locker ID to locker data
    uint256 public nextLockerId;

    // events
    event LockerCreated(uint256 indexed lockerId, address initialHolder, uint256 createdAt);
    event LockerInitialized(uint256 indexed lockerId, uint256 tokenId);
    event FeesCollected(uint256 indexed lockerId, address indexed recipient, uint256 amount0, uint256 amount1);
    event PositionUnlocked(uint256 indexed lockerId, uint256 indexed tokenId, address recipient);

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
        address[] memory _feeRecipients,
        uint256[] memory _feePercentages,
        address _initialHolder
    ) external returns (uint256 lockerId) {
        if (_feeRecipients.length != _feePercentages.length) {
            revert RecipientsAndPercentagesMismatch();
        }
        uint256 totalPercentage = 0;
        for (uint256 i = 0; i < _feePercentages.length; i++) {
            totalPercentage += _feePercentages[i];
        }
        if (totalPercentage != 100) {
            revert InvalidPercentageSum(totalPercentage);
        }

        lockerId = nextLockerId++;
        Locker storage locker = lockers[lockerId];
        locker.feeRecipients = _feeRecipients;
        locker.feePercentages = _feePercentages;
        locker.initialHolder = _initialHolder;
        locker.originOwner = _msgSender(); // should be the DAO
        locker.createdAt = block.timestamp;
        emit LockerCreated(lockerId, _initialHolder, block.timestamp);
    }

    function collectFees(uint256 lockerId, uint256 tokenId) public nonReentrant {
        Locker storage locker = lockers[lockerId];
        if (!locker.isInitialized) {
            // Transfer+Lock NFT to this contract
            positionManager.transferFrom(locker.initialHolder, address(this), tokenId);
            locker.tokenId = tokenId;
            locker.isInitialized = true;
            emit LockerInitialized(lockerId, tokenId);
        } else if (locker.tokenId != tokenId) {
            revert LockerPositionMismatch();
        }

        // Collect fees from the NFT position
        INonfungiblePositionManager.CollectParams memory params = INonfungiblePositionManager.CollectParams({
            tokenId: tokenId,
            recipient: address(this),
            amount0Max: type(uint128).max,
            amount1Max: type(uint128).max
        });

        (uint256 amount0, uint256 amount1) = positionManager.collect(params);

        // Retrieve token addresses
        (address token0, address token1) = getTokenAddresses(tokenId);

        // Distribute fees based on time elapsed
        if (block.timestamp < locker.createdAt + initialLockPeriod) {
            for (uint256 i = 0; i < locker.feeRecipients.length; i++) {
                uint256 share0 = (amount0 * locker.feePercentages[i]) / 100;
                uint256 share1 = (amount1 * locker.feePercentages[i]) / 100;

                // use safe transfer?
                IERC20(token0).transfer(locker.feeRecipients[i], share0);
                IERC20(token1).transfer(locker.feeRecipients[i], share1);
                emit FeesCollected(lockerId, locker.feeRecipients[i], share0, share1);
            }
        } else {
            // After initialLockPeriod, send all fees to the position's originOwner
            IERC20(token0).transfer(locker.originOwner, amount0);
            IERC20(token1).transfer(locker.originOwner, amount1);
            emit FeesCollected(lockerId, locker.originOwner, amount0, amount1);
        }
    }

    function unlockPosition(uint256 lockerId) external {
        Locker memory locker = lockers[lockerId];
        address positionOwner = locker.originOwner;
        if (_msgSender() != positionOwner) {
            revert Unauthorized(positionOwner);
        }
        uint256 lockTime = locker.createdAt + initialLockPeriod;
        if (block.timestamp < lockTime) {
            revert CannotTransferBeforeLockPeriod(block.timestamp, lockTime);
        }

        // Transfer the NFT out
        uint256 tokenId = locker.tokenId;
        positionManager.transferFrom(address(this), positionOwner, tokenId);

        // Clear locker state
        delete lockers[lockerId];

        emit PositionUnlocked(lockerId, tokenId, positionOwner);
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
        address /*operator*/,
        address /*from*/,
        uint256 /*tokenId*/,
        bytes calldata /*data*/
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
