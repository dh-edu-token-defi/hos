// SPDX-License-Identifier: MIT
pragma solidity >=0.8.7 <0.9.0;

import { Enum } from "@gnosis.pm/safe-contracts/contracts/common/Enum.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import { IYeetNftEscrowShaman } from "./IYeetNftEscrowShaman.sol";
import { AdminShaman } from "../../shaman/AdminShaman.sol";
import { IShaman } from "../../shaman/interfaces/IShaman.sol";
import { ZodiacModuleShaman } from "../../shaman/ZodiacModuleShaman.sol";

error YeetShamanModule__AlreadyExecuted();
error YeetShamanModule_BaalVaultOnly();

// contract should be set to a shaman (admin) and a treasury module in the summoner
// TODo
contract YeetNftEscrowShamanModule is IYeetNftEscrowShaman, ZodiacModuleShaman, AdminShaman {
    bool public isActive;
    uint256 public threshold;
    uint256 public expiration;
    address public seller;
    address public nftAddress;
    uint256 public tokenId;

    event Setup(
        address indexed baal,
        address indexed vault,
        uint256 threshold,
        uint256 expiration,
        address seller,
        address nftAddress,
        uint256 tokenId
    );
    event Executed(address seller, uint256 tokenId, uint256 ethSupply);

    modifier baalVaultOnly() {
        if (_msgSender() != vault()) revert YeetShamanModule_BaalVaultOnly();
        _;
    }

    modifier notExecuted() {
        if (executed() == true) revert YeetShamanModule__AlreadyExecuted();
        _;
    }

    function __YeetNftEscrowShamanModule__init(
        address _baal,
        address _vault,
        uint256 _threshold,
        uint256 _expiration,
        address _seller,
        address _nftAddress,
        uint256 _tokenId
    ) internal onlyInitializing {
        __ZodiacModuleShaman__init("YeetNftEscrowShamanModule", _baal, _vault);
        __AdminShaman_init_unchained();
        __YeetNftEscrowShamanModule__init_unchained(_threshold, _expiration, _seller, _nftAddress, _tokenId);
    }

    function __YeetNftEscrowShamanModule__init_unchained(
        uint256 _threshold,
        uint256 _expiration,
        address _seller,
        address _nftAddress,
        uint256 _tokenId
    ) internal onlyInitializing {
        threshold = _threshold;
        expiration = _expiration;
        seller = _seller;
        nftAddress = _nftAddress;
        tokenId = _tokenId;
    }

    function setup(address _baal, address _vault, bytes memory _initializeParams) public override(IShaman) initializer {
        (uint256 _threshold, uint256 _expiration, address _seller, address _nftAddress, uint256 _tokenId) = abi.decode(
            _initializeParams,
            (uint256, uint256, address, address, uint256)
        );
        __YeetNftEscrowShamanModule__init(_baal, _vault, _threshold, _expiration, _seller, _nftAddress, _tokenId);
        isActive = true;
        emit Setup(_baal, _vault, _threshold, _expiration, _seller, _nftAddress, _tokenId);
    }

    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(ZodiacModuleShaman, AdminShaman) returns (bool) {
        return interfaceId == type(IYeetNftEscrowShaman).interfaceId || super.supportsInterface(interfaceId);
    }

    // PUBLIC FUNCTIONS
    function execute() public nonReentrant notExecuted isModuleEnabled isBaalAdmin {
        require(block.timestamp >= expiration, "!expired"); // TODO: custom error

        uint256 yeethBalance = vault().balance;

        require(yeethBalance >= threshold, "threshold not met"); // TODO: custom error
        require(isActive == true, "No longer active"); // TODO: custom error

        require(
            IERC721(nftAddress).getApproved(tokenId) == address(this),
            "Escrow contract is not authorized to handle this NFT."
        );
        require(IERC721(nftAddress).ownerOf(tokenId) == seller, "Seller no longer owns the NFT.");

        IERC721(nftAddress).transferFrom(seller, vault(), tokenId);

        // AdminShaman action: Make shares/loot transferable
        _baal.setAdminConfig(false, false);

        bool success = exec(seller, yeethBalance, new bytes(0), Enum.Operation.Call);

        require(success, "transfer failed"); // TODO: custom error

        isActive = false;

        emit Executed(nftAddress, tokenId, yeethBalance);
    }

    // ADMIN FUNCTIONS
    function cancelEscrow() public baalVaultOnly {
        isActive = false;
    }

    // VIEW FUNCTIONS
    function executed() public view override returns (bool) {
        return !isActive;
    }

    function canExecute() public view returns (bool) {
        return
            IERC721(nftAddress).getApproved(tokenId) == address(this) &&
            block.timestamp >= expiration &&
            _baal.target().balance >= threshold &&
            isActive;
    }

    receive() external payable {}
}
