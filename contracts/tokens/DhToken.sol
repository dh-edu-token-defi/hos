// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PermitUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20VotesUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract DhToken is
    Initializable,
    ERC20Upgradeable,
    ERC20PausableUpgradeable,
    OwnableUpgradeable,
    ERC20PermitUpgradeable,
    ERC20VotesUpgradeable,
    UUPSUpgradeable
{
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function setUp(string memory name_, string memory symbol_) public initializer {
        require(bytes(name_).length != 0, "DhToken: name empty");
        require(bytes(symbol_).length != 0, "DhToken: symbol empty");

        __ERC20_init(name_, symbol_);
        __ERC20Pausable_init();
        __Ownable_init(_msgSender());
        __ERC20Permit_init(name_);
        __ERC20Votes_init();
        __UUPSUpgradeable_init();
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }

    /// @notice Baal-only function to mint shares.
    /// @param recipient Address to receive shares
    /// @param amount Amount to mint
    function mint(address recipient, uint256 amount) external onlyOwner {
        // can not be more than half the max because of totalsupply of loot and shares
        require(totalSupply() + amount <= type(uint256).max / 2, "DhToken: cap exceeded");
        if (recipient == address(0)) {
            revert ERC20InvalidReceiver(address(0));
        }
        _update(address(0), recipient, amount);
    }

    /// @notice Baal-only function to burn shares.
    /// @param account Address to lose shares
    /// @param amount Amount to burn
    function burn(address account, uint256 amount) external onlyOwner {
        if (account == address(0)) {
            revert ERC20InvalidSender(address(0));
        }
        _update(account, address(0), amount);
    }

    function clock() public view override returns (uint48) {
        return uint48(block.timestamp);
    }

    // solhint-disable-next-line func-name-mixedcase
    function CLOCK_MODE() public pure override returns (string memory) {
        return "mode=timestamp";
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    // The following functions are overrides required by Solidity.

    function _update(
        address from,
        address to,
        uint256 value
    ) internal override(ERC20Upgradeable, ERC20VotesUpgradeable, ERC20PausableUpgradeable) {
        // allow baal to mint and burn even when paused
        require(
            from == address(0) /*Minting allowed*/ ||
                (_msgSender() == owner() && to == address(0)) /*Burning by Baal allowed*/ ||
                !paused(),
            "DhToken: !transferable"
        );
        uint256 balanceBefore = balanceOf(to);
        // Explictly call update function instead of super
        ERC20Upgradeable._update(from, to, value);
        // do the votes update function here instead of with a super
        _transferVotingUnits(from, to, value);

        // if holder is receiving funds for first time self delegate
        if (balanceBefore == 0 && numCheckpoints(to) == 0 && value > 0) {
            _delegate(to, to);
        }
    }

    function nonces(address owner) public view override(ERC20PermitUpgradeable, NoncesUpgradeable) returns (uint256) {
        return super.nonces(owner);
    }
}
