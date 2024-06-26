// SPDX-License-Identifier: MIT
pragma solidity >=0.8.7 < 0.9.0;

import { Enum } from "@gnosis.pm/safe-contracts/contracts/common/Enum.sol";

import { IUniswapV3Factory } from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol";
import { IERC20, TransferHelper } from "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";


import { IYeet24Shaman } from "./IYeet24Shaman.sol";
import { AdminShaman } from "../../shaman/AdminShaman.sol";
import { ManagerShaman } from "../../shaman/ManagerShaman.sol";
import { IShaman } from "../../shaman/interfaces/IShaman.sol";
import { ZodiacModuleShaman } from "../../shaman/ZodiacModuleShaman.sol";
import { INonfungiblePositionManager } from "../../libs/INonfungiblePositionManager.sol";
import { IWETH9 } from "../../libs/IWETH9.sol";
import { CustomMath } from "../../libraries/CustomMath.sol";

// import "hardhat/console.sol";

error Yeet24ShamanModule__InvalidEndTime();
error Yeet24ShamanModule__InvalidPoolFee();
error Yeet24ShamanModule__YeetNotFinished();
error Yeet24ShamanModule__AlreadyExecuted();
error Yeet24ShamanModule__BaalVaultOnly();
error Yeet24ShamanModule__TransferFailed(bytes returnData);
error Yeet24ShamanModule__ExecutionFailed(bytes returnData);

// contract should be set to a shaman (admin, manager) and a treasury module in the summoner
contract Yeet24ShamanModule is IYeet24Shaman, ZodiacModuleShaman, AdminShaman, ManagerShaman {
    INonfungiblePositionManager public nonfungiblePositionManager;
    IWETH9 public weth;

    address payable public boostRewardsPool;

    address public pool;
    uint256 public positionId;
    uint256 public balance;

    uint256 public endTime;
    uint256 public goal;
    uint24 public poolFee; // e.g. fee tier corresponding to 1%

    /// @dev The minimum tick that may be passed to #getSqrtRatioAtTick computed from log base 1.0001 of 2**-128.
    /// Make sure lower/upper tick are valid tick per fee (e.g. 1% fee uses tickSpacing=200)
    int24 internal minTick;
    /// @dev The maximum tick that may be passed to #getSqrtRatioAtTick computed from log base 1.0001 of 2**128
    int24 internal maxTick;

    bool public executed;
    bool internal success;

    event Setup(address indexed baal, address indexed vault, uint256 goal, uint256 endTime, uint256 poolFee, address boostRewardsPool);
    event BoostRewardsPoolUpdated(address boostRewardsPool);
    event ExecutionFailed(uint256 yeethBalance, uint256 boostRewards, bool forwardedToRewardsPool);
    event Executed(address indexed token, uint256 tokenSupply, uint256 ethSupply, uint256 boostRewards);
    event UniswapPositionCreated(address indexed pool, uint256 indexed positionId, uint160 sqrtPriceX96, uint128 liquidity, uint256 amount0, uint256 amount1);
    event BoostRewardsDeposited(address indexed sender, uint256 value);
    event ShamanBalanceWithdrawn(uint256 value);

    modifier baalVaultOnly() {
        if (_msgSender() != vault()) revert Yeet24ShamanModule__BaalVaultOnly();
        _;
    }

    modifier notExecuted() {
        if (executed) revert Yeet24ShamanModule__AlreadyExecuted();
        _;
    }

    function __Yeet24ShamanModule__init(
        address _baal,
        address _vault,
        address _nftPositionManager,
        address _weth9Address,
        address _boostRewardsPool,
        uint256 _goal,
        uint256 _endTime,
        uint24 _poolFee
    ) internal onlyInitializing {
        __ZodiacModuleShaman__init("Yeet24ShamanModule", _baal, _vault);
        __AdminShaman_init_unchained();
        __ManagerShaman_init_unchained();
        __Yeet24ShamanModule__init_unchained(
            _nftPositionManager,
            _weth9Address,
            _boostRewardsPool,
            _goal,
            _endTime,
            _poolFee
        );
    }

    function __Yeet24ShamanModule__init_unchained(
        address _nftPositionManager,
        address _weth9Address,
        address _boostRewardsPool,
        uint256 _goal,
        uint256 _endTime,
        uint24 _poolFee
    ) internal onlyInitializing {
        if (_endTime <= block.timestamp) revert Yeet24ShamanModule__InvalidEndTime();
        nonfungiblePositionManager = INonfungiblePositionManager(_nftPositionManager);
        IUniswapV3Factory factory = IUniswapV3Factory(nonfungiblePositionManager.factory());
        int24 tickSpacing = factory.feeAmountTickSpacing(_poolFee);
        if (tickSpacing == 0) revert Yeet24ShamanModule__InvalidPoolFee();
        maxTick = (887272 / tickSpacing) * tickSpacing;
        minTick = -maxTick;
        weth = IWETH9(_weth9Address);
        boostRewardsPool = payable(_boostRewardsPool);
        goal = _goal;
        endTime = _endTime;
        poolFee = _poolFee;
    }

    function setup(address _baal, address _vault, bytes memory _initializeParams) public override(IShaman) initializer {
        (
            address _nftPositionManager,
            address _weth9Address,
            address _boostRewardsPool,
            uint256 _goal,
            uint256 _expiration,
            uint24 _poolFee
        ) = abi.decode(
            _initializeParams,
            (address, address, address, uint256, uint256, uint24)
        );
        __Yeet24ShamanModule__init(
            _baal,
            _vault,
            _nftPositionManager,
            _weth9Address,
            _boostRewardsPool,
            _goal,
            _expiration,
            _poolFee
        );
        emit Setup(_baal, _vault, _goal, _expiration, _poolFee, _boostRewardsPool);
    }

    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override(ZodiacModuleShaman, AdminShaman, ManagerShaman) returns (bool) {
        return
            interfaceId == type(IYeet24Shaman).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    function goalAchieved() public view returns (bool) {
        if (executed) return success;
        return vault().balance >= goal;
    }

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
        // console.log("Tokens", token0, token1);
        // console.log("Liquidity", liquidityAmount0, liquidityAmount1);

        // calculate the sqrtPriceX96
        uint160 sqrtPriceX96 = CustomMath.calculateSqrtPriceX96(liquidityAmount0, liquidityAmount0);
        // console.log("sqrtPriceX96", sqrtPriceX96);

        // Create and initialize the pool if necessary
        pool = nonfungiblePositionManager.createAndInitializePoolIfNecessary(
            token0,
            token1,
            poolFee,
            sqrtPriceX96
        );
        // console.log("pool", pool);

        // approve weth and shares with NonfungiblePositionManager (taken from univ3 docs)
        TransferHelper.safeApprove(token0, address(nonfungiblePositionManager), liquidityAmount0);
        TransferHelper.safeApprove(token1, address(nonfungiblePositionManager), liquidityAmount1);
        // console.log("approve OK");

        // Set up mintParams with full range for volatile token
        // tick upper and lower need to be a valid tick per fee (divisible by 200 for 1%)
        // position receipt NFT goes to the vault
        INonfungiblePositionManager.MintParams memory mintParams = INonfungiblePositionManager.MintParams({
            token0: token0,
            token1: token1,
            fee: poolFee,
            tickLower: minTick,
            tickUpper: maxTick,
            amount0Desired: liquidityAmount0,
            amount1Desired: liquidityAmount1,
            amount0Min: 0,
            amount1Min: 0,
            recipient: _msgSender(), // baalVaultOnly ensures vault is the caller
            deadline: block.timestamp + 15 minutes // Ensure a reasonable deadline
        });

        // Mint the position
        (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1) = nonfungiblePositionManager.mint(mintParams);
        positionId = tokenId;
        // console.log("tokenId", tokenId);
        // console.log("liquidity", liquidity);
        // console.log("amount0", amount0);
        // console.log("amount1", amount1);

        // Remove allowance and refund in both assets.
        if (amount0 < liquidityAmount0) {
            TransferHelper.safeApprove(token0, address(nonfungiblePositionManager), 0);
            uint256 refund0 = liquidityAmount0 - amount0;
            // console.log("refund0", refund0);
            TransferHelper.safeTransfer(token0, _msgSender(), refund0);
        }

        if (amount1 < liquidityAmount1) {
            TransferHelper.safeApprove(token1, address(nonfungiblePositionManager), 0);
            uint256 refund1 = liquidityAmount1 - amount1;
            // console.log("refund1", refund1);
            TransferHelper.safeTransfer(token1, _msgSender(), refund1);
        }

        emit UniswapPositionCreated(pool, tokenId, sqrtPriceX96, liquidity, amount0, amount1);
    }

    function execute() public nonReentrant notExecuted isModuleEnabled isBaalAdmin isBaalManager {
        if (block.timestamp <= endTime) revert Yeet24ShamanModule__YeetNotFinished();
        uint256 yeethBalance = vault().balance;
        uint256 boostRewards = address(this).balance;

        executed = true;

        if (yeethBalance < goal) {
            // Shaman action: any boostRewards should be forwarded to the boostRewardsPool
            bool transferSuccess;
            if (boostRewards > 0 && boostRewardsPool != address(0)) {
                bytes memory returnData;
                (transferSuccess, returnData) = boostRewardsPool.call{value: boostRewards}("");
                if (!transferSuccess) revert Yeet24ShamanModule__TransferFailed(returnData);
            }
            emit ExecutionFailed(yeethBalance, boostRewards, transferSuccess);
        } else {
            success = true;

            address token = _baal.sharesToken();
            
            address[] memory receivers = new address[](1);
            receivers[0] = address(this);
            uint256[] memory amounts = new uint256[](1);
            // get total tokens(shares) that were minted during pre-sale
            amounts[0] = IERC20(token).totalSupply();
            
            // ManagerShaman action: mint 100% shares to this contract. this doubles the total shares
            _baal.mintShares(receivers, amounts);

            // AdminShaman action: Make shares/loot transferrable
            _baal.setAdminConfig(false, false);

            // Shaman action: if any boostRewards (e.g. fees + extra boostRewardsPool deposits) are available,
            // forward balance to the vault in charge of minting the pool initial liquidity position
            if (boostRewards > 0) {
                (bool transferSuccess, bytes memory data) = vault().call{value: boostRewards}("");
                if (!transferSuccess) revert Yeet24ShamanModule__TransferFailed(data);
                yeethBalance += boostRewards; // NOTICE: update balance to be used for minting pool position
            }

            // ZodiacModuleShaman action: execute multiSend to
            //  - wrap ETH collected in vault
            //  - transfer WETH from vault to shaman
            //  - call shaman.createPoolAndMintPosition
            bytes memory wethDepositCalldata = abi.encodeCall(
                IWETH9.transfer,
                (address(this), yeethBalance)
            );
            bytes memory createPositionCalldata = abi.encodeCall(
                IYeet24Shaman.createPoolAndMintPosition,
                (token, address(weth), amounts[0], yeethBalance)
            );
            bytes memory multisendTxs = abi.encodePacked(
                encodeMultiSendAction(Enum.Operation.Call, address(weth), yeethBalance, bytes("")), // eth -> weth
                encodeMultiSendAction(Enum.Operation.Call, address(weth), 0, wethDepositCalldata), // transfer weth to shaman
                encodeMultiSendAction(Enum.Operation.Call, address(this), 0, createPositionCalldata) // create pool + mint position
            );
            (bool multiSendSuccess, bytes memory returnData) = _execMultiSendCall(multisendTxs);

            if (!multiSendSuccess) revert Yeet24ShamanModule__ExecutionFailed(returnData);

            balance = yeethBalance;

            emit Executed(token, amounts[0], yeethBalance, boostRewards);
        }
    }

    function updateBoostRewardsPool(address _boostRewardsPool) external baalVaultOnly {
        boostRewardsPool = payable(_boostRewardsPool);
        emit BoostRewardsPoolUpdated(_boostRewardsPool);
    }

    function withdrawShamanBalance() external baalVaultOnly {
        bool transferSuccess;
        bytes memory returnData;
        uint256 shamanBalance = address(this).balance;
        // Shaman MUST have been executed to be able to withdraw any remaining balance
        if (executed && shamanBalance > 0) {
            (transferSuccess, returnData) = vault().call{value: shamanBalance}("");
        }
        if (!transferSuccess) revert Yeet24ShamanModule__TransferFailed(returnData);
        emit ShamanBalanceWithdrawn(shamanBalance);
    }

    receive() external payable {
        if (boostRewardsPool == msg.sender) {
            emit BoostRewardsDeposited(msg.sender, msg.value);
        }
    }
}
