// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20SnapshotUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/draft-ERC20PermitUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
// import "hardhat/console.sol";

error NotSupported();
error AlreadyMinted();
error LengthMismatch();
error AmountsMismatch();

contract FixedLoot is ERC20SnapshotUpgradeable, ERC20PermitUpgradeable, OwnableUpgradeable {
    bool public _mintingLocked;

    constructor() {
        _disableInitializers();
    }

    /// @notice Configure loot - called by Baal on summon
    /// @dev initializer should prevent this from being called again
    /// @param params setup params
    function setUp(bytes calldata params) external initializer {
        (
            string memory name_,
            string memory symbol_,
            address[] memory initialHolders,
            uint256[] memory initialAmounts
        ) = abi.decode(params, (string, string, address[], uint256[]));

        // the first 2 amounts in the array are reserved for the vault and the claim shaman
        // and are requiered
        if (initialAmounts.length < 2) {
            revert AmountsMismatch();
        }
        if (initialHolders.length != initialAmounts.length - 2) {
            revert LengthMismatch();
        }
        require(bytes(name_).length != 0, "loot: name empty");
        require(bytes(symbol_).length != 0, "loot: symbol empty");

        __ERC20_init(name_, symbol_);
        __ERC20Permit_init(name_);
        __ERC20Snapshot_init();
        __Ownable_init();
    }

    /// @notice Allows baal to create a snapshot
    function snapshot() external onlyOwner returns (uint256) {
        return _snapshot();
    }

    /// @notice get current SnapshotId
    function getCurrentSnapshotId() external view returns (uint256) {
        return _getCurrentSnapshotId();
    }

    /// @notice Baal-only function to pause shares.
    function pause() public view onlyOwner {
        // this should not revert but should not do anything
    }

    /// @notice Baal-only function to pause shares.
    function unpause() public view onlyOwner {
        // this should not revert but should not do anything
    }

    function paused() public pure returns (bool) {
        return false;
    }

    /// @notice Baal-only function to mint loot. notsupported in fixed loot
    /// @param recipient Address to receive loot
    /// @param amount Amount to mint
    function mint(address recipient, uint256 amount) external view onlyOwner {
        // should revert
        revert NotSupported();
    }

    /// @notice function to mint initial loot.
    /// can oly be run once then minting is locked going forward
    /// first 2 amounts in the array are reserved for the vault and the claim shaman
    /// any furture distributions will be done after that offset
    /// @dev can only be called once
    /// @param vault Address to receive vault loot (zero index)
    /// @param claimShaman Address to receive claim shaman loot (one index)
    /// @param params setup params
    function initialMint(address vault, address claimShaman, bytes memory params) external onlyOwner {
        if (_mintingLocked) {
            revert AlreadyMinted();
        }

        (, , address[] memory initialHolders, uint256[] memory initialAmounts) = abi.decode(
            params,
            (string, string, address[], uint256[])
        );

        _mintingLocked = true;
        _mint(vault, initialAmounts[0]);
        _mint(claimShaman, initialAmounts[1]);

        for (uint256 i = 0; i < initialHolders.length; i++) {
            _mint(initialHolders[i], initialAmounts[i + 2]);
        }
    }

    /// @notice Baal-only function to burn loot.
    /// @param account Address to lose loot
    /// @param amount Amount to burn
    function burn(address account, uint256 amount) external onlyOwner {
        _burn(account, amount);
    }

    /// @notice Internal hook to restrict token transfers unless allowed by baal
    /// @dev Allows transfers if msg.sender is Baal which enables minting and burning
    /// @param from The address of the source account.
    /// @param to The address of the destination account.
    /// @param amount The number of `loot` tokens to transfer.
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override(ERC20Upgradeable, ERC20SnapshotUpgradeable) {
        super._beforeTokenTransfer(from, to, amount);
        require(!paused(), "loot: !transferable");
    }
}
