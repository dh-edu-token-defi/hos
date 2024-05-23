// SPDX-License-Identifier: MIT
pragma solidity >=0.8.7 < 0.9.0;

import { Enum } from "@gnosis.pm/safe-contracts/contracts/common/Enum.sol";

// import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
// import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";

import { IYeet24Shaman } from "./IYeet24Shaman.sol";
import { AdminShaman } from "../../shaman/AdminShaman.sol";
import { ManagerShaman } from "../../shaman/ManagerShaman.sol";
import { IShaman } from "../../shaman/interfaces/IShaman.sol";
import { ZodiacModuleShaman } from "../../shaman/ZodiacModuleShaman.sol";
import { INonfungiblePositionManager } from "../../libs/INonfungiblePositionManager.sol";
import { IWETH9 } from "../../libs/IWETH9.sol";
import { CustomMath } from "../../libraries/CustomMath.sol";

error YeetShamanModule__AlreadyExecuted();
error YeetShamanModule_BaalVaultOnly();

// contract should be set to a shaman (admin, manager) and a treasury module in the summoner
contract Yeet24ShamanModule is IYeet24Shaman, ZodiacModuleShaman, AdminShaman, ManagerShaman {
    bool public executed;
    INonfungiblePositionManager public nonfungiblePositionManager;
    IWETH9 public weth;

    uint256 public threshold;
    uint256 public expiration;
    uint24 public poolFee; // Fee tier corresponding to 1%

    /// @dev The minimum tick that may be passed to #getSqrtRatioAtTick computed from log base 1.0001 of 2**-128
    int24 internal constant MIN_TICK = -887272;
    /// @dev The maximum tick that may be passed to #getSqrtRatioAtTick computed from log base 1.0001 of 2**128
    int24 internal constant MAX_TICK = -MIN_TICK;

    event Setup(address indexed baal, address indexed vault, uint256 threshold, uint256 expiration, uint256 poolFee);
    event Executed(address indexed token, uint256 tokenSupply, uint256 ethSupply);
    event UniswapPositionCreated(address indexed pool, uint256 indexed tokenId, uint160 sqrtPriceX96, uint128 liquidity, uint256 amount0, uint256 amount1);

    modifier baalVaultOnly() {
        if (_msgSender() != vault()) revert YeetShamanModule_BaalVaultOnly();
        _;
    }

    modifier notExecuted() {
        if (executed) revert YeetShamanModule__AlreadyExecuted();
        _;
    }

    function __Yeet24ShamanModule__init(
        address _baal,
        address _vault,
        address _nftPositionManager,
        address _weth9Address,
        uint256 _threshold,
        uint256 _expiration,
        uint24 _poolFee
    ) internal onlyInitializing {
        __ZodiacModuleShaman__init("Yeet24ShamanModule", _baal, _vault, "");
        __AdminShaman_init_unchained();
        __ManagerShaman_init_unchained();
        __Yeet24ShamanModule__init_unchained(_nftPositionManager, _weth9Address, _threshold, _expiration, _poolFee);
    }

    function __Yeet24ShamanModule__init_unchained(
        address _nftPositionManager,
        address _weth9Address,
        uint256 _threshold,
        uint256 _expiration,
        uint24 _poolFee
    ) internal onlyInitializing {
        nonfungiblePositionManager = INonfungiblePositionManager(_nftPositionManager);
        weth = IWETH9(_weth9Address);
        threshold = _threshold;
        expiration = _expiration;
        poolFee = _poolFee;
    }

    function setup(address _baal, address _vault, bytes memory _initializeParams) public override(IShaman) initializer {
        (
            address _nftPositionManager,
            address _weth9Address,
            uint256 _threshold,
            uint256 _expiration,
            uint24 _poolFee
        ) = abi.decode(
            _initializeParams,
            (address, address, uint256, uint256, uint24)
        );
        __Yeet24ShamanModule__init(
            _baal,
            _vault,
            _nftPositionManager,
            _weth9Address,
            _threshold,
            _expiration,
            _poolFee
        );
        emit Setup(_baal, _vault, _threshold, _expiration, _poolFee);
    }

    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override(ZodiacModuleShaman, AdminShaman, ManagerShaman) returns (bool) {
        return
            interfaceId == type(IYeet24Shaman).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    // VIEW FUNCTIONS

    // PRIVATE FUNCTIONS

    // PUBLIC FUNCTIONS

    function createPoolAndMintPosition(
        address token0,
        address token1,
        uint256 liquidityAmount0,
        uint256 liquidityAmount1
    ) external baalVaultOnly {

        // Ensure correct order of tokens based on their addresses
        (token0, token1, liquidityAmount0, liquidityAmount1) = token0 < token1
            ? (token0, token1, liquidityAmount0, liquidityAmount1)
            : (token1, token0, liquidityAmount1, liquidityAmount0);

        // calculate the sqrtPriceX96
        uint160 sqrtPriceX96 = CustomMath.calculateSqrtPriceX96(liquidityAmount0, liquidityAmount0);

        // Create and initialize the pool if necessary
        address pool = nonfungiblePositionManager.createAndInitializePoolIfNecessary(
            token0,
            token1,
            poolFee,
            sqrtPriceX96
        );

        // TODO: check safe approve from vault
        // approve weth and shares with NonfungiblePositionManager (taken from univ3 docs)
        TransferHelper.safeApprove(token0, address(nonfungiblePositionManager), liquidityAmount0);
        TransferHelper.safeApprove(token1, address(nonfungiblePositionManager), liquidityAmount1);

        // Set up mintParams with full range for volitile token
        // tick upper and lower need to be a valid tick per fee (divisiable by 200 for 1%)
        // postion receipt NFT goes to the vault
        INonfungiblePositionManager.MintParams memory mintParams = INonfungiblePositionManager.MintParams({
            token0: token0,
            token1: token1,
            fee: poolFee,
            tickLower: MIN_TICK,
            tickUpper: MAX_TICK,
            amount0Desired: liquidityAmount0,
            amount1Desired: liquidityAmount1,
            amount0Min: 0,
            amount1Min: 0,
            recipient: _msgSender(),
            deadline: block.timestamp + 15 minutes // Ensure a reasonable deadline
        });

        // Mint the position
        (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1) = nonfungiblePositionManager.mint(mintParams);

        // Remove allowance and refund in both assets.
        if (amount0 < liquidityAmount0) {
            TransferHelper.safeApprove(token0, address(nonfungiblePositionManager), 0);
            uint256 refund0 = liquidityAmount0 - amount0;
            TransferHelper.safeTransfer(token0, _msgSender(), refund0);
        }

        if (amount1 < liquidityAmount1) {
            TransferHelper.safeApprove(token1, address(nonfungiblePositionManager), 0);
            uint256 refund1 = liquidityAmount1 - amount1;
            TransferHelper.safeTransfer(token1, _msgSender(), refund1);
        }

        emit UniswapPositionCreated(pool, tokenId, sqrtPriceX96, liquidity, amount0, amount1);
    }

    function execute() public nonReentrant notExecuted isModuleEnabled isBaalAdmin isBaalManager {
        require(block.timestamp >= expiration, "!expired"); // TODO: custom error

        uint256 yeethBalance = _baal.target().balance;

        require(yeethBalance >= threshold, "threshold not met"); // TODO: custom error

        address token = _baal.sharesToken();
        
        address[] memory receivers = new address[](1);
        receivers[0] = address(this);
        uint256[] memory amounts = new uint256[](1);
        // get total tokens(shares) that were minted during pre-sale
        amounts[0] = IERC20(token).totalSupply();
        
        // ManagerShaman action: mint 100% shares to this contract. this doubles the total shares
        _baal.mintShares(receivers, amounts);

        // AdminShaman action: Make shares/loot transferable
        _baal.setAdminConfig(false, false);

        bytes memory wethDepositCalldata = abi.encodeCall(
            IWETH9.transfer,
            (address(this), yeethBalance)
        );

        bytes memory createPositionCalldata = abi.encodeCall(
            IYeet24Shaman.createPoolAndMintPosition,
            (token, address(weth), amounts[0], yeethBalance)
        );

        bytes memory multisendTxs = abi.encodePacked(
            abi.encode(Enum.Operation.Call, address(weth), yeethBalance, 0, ""), // eth -> weth
            abi.encode(Enum.Operation.Call, address(weth), 0, wethDepositCalldata.length, wethDepositCalldata), // transfer weth to shaman
            abi.encode(Enum.Operation.Call, address(this), 0, createPositionCalldata.length, createPositionCalldata) // create pool + position
        );

        bool success = exec(
            _baal.multisendLibrary(),
            0,
            multisendTxs,
            Enum.Operation.DelegateCall
        );

        require(success, "exec failed"); // TODO: custom error

        executed = true;

        emit Executed(token, amounts[0], yeethBalance);
    }

    // ADMIN FUNCTIONS

    //

    receive() external payable {}
}
