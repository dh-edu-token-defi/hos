// SPDX-License-Identifier: MIT
pragma solidity >=0.8.7 <0.9.0;

import { IGovernorShaman } from "./interfaces/IGovernorShaman.sol";
import { IERC165, ShamanBase } from "./ShamanBase.sol";

/// @notice Shaman does not have governor privileges
error GovernorShaman__NoGovernorRole();

/**
 * @title Baal Shaman Governor contract
 * @author DAOHaus
 * @notice Implement the base functionality for a Shaman with governor privileges
 * @dev Inherits from ShamanBase
 */
abstract contract GovernorShaman is ShamanBase, IGovernorShaman {
    /**
     * @notice A modifier for methods that require to check shaman governor privileges
     */
    modifier isBaalGovernor() {
        if (!isGovernor()) revert GovernorShaman__NoGovernorRole();
        _;
    }

    /**
     * @notice A modifier for methods that require to check shaman admin privileges
     */
    modifier baalOrGovernorOnly() {
        if (_msgSender() != _vault && !_baal.isGovernor(_msgSender())) revert GovernorShaman__NoGovernorRole();
        _;
    }

    /**
     * @notice Initializer function
     * @dev Should be called during contract initializaton
     * @param _name shaman name
     * @param _baalAddress baal address
     * @param _vaultAddress baal vault address
     */
    function __GovernorShaman_init(
        string memory _name,
        address _baalAddress,
        address _vaultAddress
    ) internal onlyInitializing {
        __ShamanBase_init(_name, _baalAddress, _vaultAddress);
        __GovernorShaman_init_unchained();
    }

    /**
     * @notice Local initializer function
     * @dev Should be called through main initializer to set any local state variables
     */
    function __GovernorShaman_init_unchained() internal onlyInitializing {}

    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override(ShamanBase, IERC165) returns (bool) {
        return interfaceId == type(IGovernorShaman).interfaceId || super.supportsInterface(interfaceId);
    }

    /**
     * @notice Returns true if Baal shaman has governor permissions
     * @inheritdoc IGovernorShaman
     */
    function isGovernor() public view virtual returns (bool) {
        return _baal.isGovernor(address(this));
    }

    /**
     * @notice Cancel an active proposal in baal
     * @inheritdoc IGovernorShaman
     */
    function cancelProposal(uint32 _proposalId) public virtual nonReentrant baalOrGovernorOnly {
        _baal.cancelProposal(_proposalId);
    }

    /**
     * @notice Set baal governance parameters such as:
     * - voting & grace periods
     * - tribute, quorum, sponsor threshold & retention bound
     * @inheritdoc IGovernorShaman
     */
    function setGovernanceConfig(bytes memory _governanceConfig) public virtual baalOrGovernorOnly {
        _baal.setGovernanceConfig(_governanceConfig);
    }

    /**
     * @notice Set baal trusted forwarded for meta txs
     * @inheritdoc IGovernorShaman
     */
    function setTrustedForwarder(address _trustedForwarderAddress) public virtual baalOrGovernorOnly {
        _baal.setTrustedForwarder(_trustedForwarderAddress);
    }
}
