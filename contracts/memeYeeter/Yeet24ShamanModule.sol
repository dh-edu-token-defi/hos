// SPDX-License-Identifier: MIT
pragma solidity >=0.8.7 <0.9.0;

import { Enum } from "@gnosis.pm/safe-contracts/contracts/common/Enum.sol";

import { IUniswapV3Factory } from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol";
import { IERC20, TransferHelper } from "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";

import { IYeet24Shaman } from "./IYeet24Shaman.sol";
import { INonfungiblePositionManager } from "../libs/INonfungiblePositionManager.sol";
import { IWETH9 } from "../libs/IWETH9.sol";
import { CustomMath } from "../libraries/CustomMath.sol";
import { IYeet24ClaimModule } from "../modules/IYeet24ClaimModule.sol";
import { AdminShaman, IERC165 } from "../shaman/AdminShaman.sol";
import { HOSDeployable } from "../shaman/HOSDeployable.sol";
import { ManagerShaman } from "../shaman/ManagerShaman.sol";
import { ZodiacModuleShaman } from "../shaman/ZodiacModuleShaman.sol";
import { IShaman } from "../shaman/interfaces/IShaman.sol";

// import "hardhat/console.sol";

// @notice Provided end time is invalid
error Yeet24ShamanModule__InvalidEndTime();
// @notice Provided pool fee is not used by UniV3
error Yeet24ShamanModule__InvalidPoolFee();
// @notice Yeeter campaign has not finished yet
error Yeet24ShamanModule__YeetNotFinished();
// @notice Shaman already executed
error Yeet24ShamanModule__AlreadyExecuted();
// @notice Function should be called only by the Baal vault
error Yeet24ShamanModule__BaalVaultOnly();
// @notice ETH transfer failed
error Yeet24ShamanModule__TransferFailed(bytes returnData);
// @notice MultiSend execution failed
error Yeet24ShamanModule__ExecutionFailed(bytes returnData);

/**
 * @title A fair token launcher designed to democratize the token pre-sale process in the DeFi ecosystem.
 * @author DAOHaus
 * @notice It uses Yeeter for token pre-sales and Uniswap V3 for pool creation and initial liquidity position management
 * @dev In order to operate the contract should have Baal Admin and Manager privileges as well as being added as
 * a Safe module to the Baal/Yeeter vault.
 */

contract Yeet24ShamanModule is IYeet24Shaman, ZodiacModuleShaman, AdminShaman, ManagerShaman, HOSDeployable {
    /// @dev UniswapV3 NonfungiblePositionManager contract
    INonfungiblePositionManager public nonfungiblePositionManager;
    /// @dev WETH address
    IWETH9 public weth;

    /// @notice BoostRewardPool address
    /// @dev Rewards pool address used to boost token launches or collect fees for failed campaigns.
    /// It could be set to the zero address if no boosts rewards are plugged in into the campaign.
    address payable public boostRewardsPool;

    /// @notice UniV3Pool address
    /// @dev address is set only when a token is successfully launched
    address public pool;
    /// @notice Liquidity position Id
    /// @dev NFT position is set only when a token is successfully launched
    uint256 public positionId;
    /// @notice Amount of ETH collected to launch the token
    /// @dev Value is set only when a token is successfully launched
    uint256 public balance;

    /// @notice endTime whn campaign expires
    uint256 public endTime;
    /// @notice Campaign funding goal to be achieved.
    /// @dev Should be the same as in the Yeeter
    uint256 public goal;
    /// @notice trading fee used to create the UniV3 pool
    /// @dev Fee should be registered in IUniswapV3Factory
    uint24 public poolFee; // e.g. fee tier corresponding to 1%

    /// @dev The minimum tick that may be passed to #getSqrtRatioAtTick computed from log base 1.0001 of 2**-128.
    /// Make sure lower/upper tick are valid tick per fee (e.g. 1% fee uses tickSpacing=200)
    int24 internal minTick;
    /// @dev The maximum tick that may be passed to #getSqrtRatioAtTick computed from log base 1.0001 of 2**128
    int24 internal maxTick;

    /// @notice Whether or not the shaman got executed
    /// @dev executed does not necessarily mean it successfully launched a token
    bool public executed;
    /// @dev Whether or not the token was successfully launched
    bool internal success;

    /// @notice emitted when the contract is initialized
    /// @param baal baal address
    /// @param vault baal vault address
    /// @param goal campaign funding goal
    /// @param endTime campaign end timestamp in seconds
    /// @param poolFee UniV3 pool fee
    /// @param boostRewardsPool rewards pool address
    event Setup(
        address indexed baal,
        address indexed vault,
        uint256 goal,
        uint256 endTime,
        uint256 poolFee,
        address boostRewardsPool
    );
    /// @notice emitted when a token launch failed to meet the goal
    /// @param yeethBalance amount of ETH collected during the campaign
    /// @param boostRewards boost rewards collected durinng the campaign
    /// @param forwardedToRewardsPool whether or not boost rewards were deposited back to the rewards pool
    event ExecutionFailed(uint256 yeethBalance, uint256 boostRewards, bool forwardedToRewardsPool);
    /// @notice emitted when a token is successfully launched
    /// @param token token address
    /// @param tokenSupply token liquidity amount
    /// @param ethSupply ETH liquidity amount
    /// @param boostRewards extra ETH used to boost liquidity
    event Executed(address indexed token, uint256 tokenSupply, uint256 ethSupply, uint256 boostRewards);
    /// @notice emitted when the UniV3 pool is created and the initial liquidity position is minted
    /// @param pool pool address
    /// @param positionId NFT position Id
    /// @param sqrtPriceX96 initial token price
    /// @param liquidity final liquidity provided
    /// @param amount0 final amount of liquidity provided for token0
    /// @param amount1 final amount of liquidity provided for token1
    event UniswapPositionCreated(
        address indexed pool,
        uint256 indexed positionId,
        uint160 sqrtPriceX96,
        uint128 liquidity,
        uint256 amount0,
        uint256 amount1
    );
    /// @notice emitted when some boost rewards were deposited from the boostRewardsPool
    /// @param sender pool address
    /// @param value deposited amount
    event BoostRewardsDeposited(address indexed sender, uint256 value);
    /// @notice emitted when contract ETH balance is forwarded to the Baal vault
    /// @param value of ETH deposited into the Baal vault
    event ShamanBalanceWithdrawn(uint256 value);

    /// @notice A modifier for methods that require to be called by the Baal vault
    modifier baalVaultOnly() {
        if (_msgSender() != vault()) revert Yeet24ShamanModule__BaalVaultOnly();
        _;
    }

    /// @notice A modifer for methods that require to check if the execute function was already called
    modifier notExecuted() {
        if (executed) revert Yeet24ShamanModule__AlreadyExecuted();
        _;
    }

    /**
     * @notice Initializer function
     * @dev _boostRewardsPool could be set to the zero address if no boosts rewards are plugged in into the campaign
     * @param _baal baal address
     * @param _vault bal vault address
     * @param _nftPositionManager UniV3 NonfungiblePositionManager contract address
     * @param _weth9Address weth address
     * @param _boostRewardsPool boost rewards pool address
     * @param _goal campaign funding goal
     * @param _endTime campaign end timestamp is seconds
     * @param _poolFee pool fee to be used by the token launcher
     */
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
        __ZodiacModuleShaman_init("Yeet24ShamanModule", _baal, _vault);
        __HOSDeployable_init(keccak256(abi.encode(name())));
        __AdminShaman_init_unchained();
        __ManagerShaman_init_unchained();
        __Yeet24ShamanModule_init_unchained(
            _nftPositionManager,
            _weth9Address,
            _boostRewardsPool,
            _goal,
            _endTime,
            _poolFee
        );
    }

    /**
     * @notice Local initializer function
     * @dev _boostRewardsPool could be set to the zero address if no boosts rewards are plugged in into the campaign
     * @param _nftPositionManager UniV3 NonfungiblePositionManager contract address
     * @param _weth9Address weth address
     * @param _boostRewardsPool boost rewards pool address
     * @param _goal campaign funding goal
     * @param _endTime campaign end timestamp is seconds
     * @param _poolFee pool fee to be used by the token launcher
     */
    function __Yeet24ShamanModule_init_unchained(
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

    /**
     * @notice Main initializer function to setup the shaman config
     * @inheritdoc IShaman
     */
    function setup(address _baal, address _vault, bytes memory _initializeParams) public override(IShaman) initializer {
        (
            address _nftPositionManager,
            address _weth9Address,
            address _boostRewardsPool,
            uint256 _goal,
            uint256 _expiration,
            uint24 _poolFee
        ) = abi.decode(_initializeParams, (address, address, address, uint256, uint256, uint24));
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
    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(ZodiacModuleShaman, AdminShaman, ManagerShaman) returns (bool) {
        return interfaceId == type(IYeet24Shaman).interfaceId || super.supportsInterface(interfaceId);
    }

    /**
     * @notice Whether or not the campaign achieved the funding goal.
     * @inheritdoc IYeet24Shaman
     */
    function goalAchieved() public view returns (bool) {
        if (executed) return success;
        return vault().balance >= goal;
    }

    /**
     * @notice Transfer/burn any remainder after creating a liquidity position
     * @dev if token is the baal shares token, remainder should be burned
     * @param _token token address
     * @param _to recipient addres
     * @param _value value to be transferred
     * @param _isSharesToken whether or not the token is the baal shares token
     */
    function _transferRemainder(address _token, address _to, uint256 _value, bool _isSharesToken) internal {
        if (_isSharesToken) {
            address[] memory from = new address[](1);
            from[0] = address(this);
            uint256[] memory amounts = new uint256[](1);
            amounts[0] = _value;

            // ManagerShaman action: burn shares hold in the contract
            _baal.burnShares(from, amounts);
        } else {
            TransferHelper.safeTransfer(_token, _to, _value);
        }
    }

    /**
     * @notice Creates a UniV3Pool and mint an  initial liquidity position
     * @inheritdoc IYeet24Shaman
     */
    function createPoolAndMintPosition(
        address token0,
        address token1,
        uint256 liquidityAmount0,
        uint256 liquidityAmount1
    ) external baalVaultOnly {
        bool isSharesToken0 = token0 < token1;
        // Ensure correct order of tokens based on their addresses
        (token0, token1, liquidityAmount0, liquidityAmount1) = isSharesToken0
            ? (token0, token1, liquidityAmount0, liquidityAmount1)
            : (token1, token0, liquidityAmount1, liquidityAmount0);
        // console.log("Tokens", token0, token1);
        // console.log("Liquidity", liquidityAmount0, liquidityAmount1);

        // calculate the sqrtPriceX96
        uint160 sqrtPriceX96 = CustomMath.calculateSqrtPriceX96(liquidityAmount0, liquidityAmount1);
        // console.log("sqrtPriceX96", sqrtPriceX96);

        // Create and initialize the pool if necessary
        pool = nonfungiblePositionManager.createAndInitializePoolIfNecessary(token0, token1, poolFee, sqrtPriceX96);
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
        (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1) = nonfungiblePositionManager.mint(
            mintParams
        );
        positionId = tokenId;
        // console.log("sqrtPriceX96", sqrtPriceX96);
        // console.log("Desired liq0", liquidityAmount0);
        // console.log("Desired liq1", liquidityAmount1);
        // console.log("tokenId", tokenId);
        // console.log("liquidity", liquidity);
        // console.log("amount0", amount0, amount0 < liquidityAmount0);
        // console.log("amount1", amount1, amount1 < liquidityAmount1);

        // address sharesToken = _baal.sharesToken();
        // Remove allowance and refund in both assets.
        if (amount0 < liquidityAmount0) {
            TransferHelper.safeApprove(token0, address(nonfungiblePositionManager), 0);
            uint256 refund0 = liquidityAmount0 - amount0;
            // console.log("refund0", refund0);
            _transferRemainder(token0, _msgSender(), refund0, isSharesToken0);
        }

        if (amount1 < liquidityAmount1) {
            TransferHelper.safeApprove(token1, address(nonfungiblePositionManager), 0);
            uint256 refund1 = liquidityAmount1 - amount1;
            // console.log("refund1", refund1);
            _transferRemainder(token1, _msgSender(), refund1, !isSharesToken0);
        }

        emit UniswapPositionCreated(pool, tokenId, sqrtPriceX96, liquidity, amount0, amount1);
    }

    /**
     * @notice Executes the token launch if yeeter campaign meets its goal
     * @inheritdoc IYeet24Shaman
     */
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
                (transferSuccess, returnData) = boostRewardsPool.call{ value: boostRewards }("");
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

            // Yeet24ClaimModule action: claim additional rewards from the boostRewardsPool if available
            // NOTICE: it uses ERC165 to check whether contract supports claim module interface
            (, bytes memory ifaceReturnData) = boostRewardsPool.call(
                abi.encodeWithSelector(IERC165.supportsInterface.selector, type(IYeet24ClaimModule).interfaceId)
            );
            bytes32 boolResult = bytes32(ifaceReturnData); // truncate return data. Should only return a boolean
            bool isClaimModule;
            assembly {
                isClaimModule := boolResult
            }
            if (isClaimModule) {
                boostRewards += IYeet24ClaimModule(boostRewardsPool).claimReward(vault(), payable(address(this)));
            }
            // Shaman action: if any boostRewards (e.g. fees + extra boostRewardsPool deposits) are available,
            // forward balance to the vault in charge of minting the pool initial liquidity position
            if (boostRewards > 0) {
                (bool transferSuccess, bytes memory data) = vault().call{ value: boostRewards }("");
                if (!transferSuccess) revert Yeet24ShamanModule__TransferFailed(data);
                yeethBalance += boostRewards; // NOTICE: update balance to be used for minting pool position
            }

            // ZodiacModuleShaman action: execute multiSend to
            //  - wrap ETH collected in vault
            //  - transfer WETH from vault to shaman
            //  - call shaman.createPoolAndMintPosition
            bytes memory wethDepositCalldata = abi.encodeCall(IWETH9.transfer, (address(this), yeethBalance));
            bytes memory createPositionCalldata = abi.encodeCall(
                IYeet24Shaman.createPoolAndMintPosition,
                (token, address(weth), amounts[0], yeethBalance)
            );
            bytes memory multisendTxs = abi.encodePacked(
                // eth -> weth
                encodeMultiSendAction(Enum.Operation.Call, address(weth), yeethBalance, bytes("")),
                // transfer weth to shaman
                encodeMultiSendAction(Enum.Operation.Call, address(weth), 0, wethDepositCalldata),
                // create pool + mint position
                encodeMultiSendAction(Enum.Operation.Call, address(this), 0, createPositionCalldata)
            );
            (bool multiSendSuccess, bytes memory returnData) = execMultiSendCall(multisendTxs);

            if (!multiSendSuccess) revert Yeet24ShamanModule__ExecutionFailed(returnData);

            balance = yeethBalance;

            emit Executed(token, amounts[0], yeethBalance, boostRewards);
        }
    }

    /**
     * @notice Withdraw any balance held in the contract and deposits into the vault.
     * @inheritdoc IYeet24Shaman
     */
    function withdrawShamanBalance() external baalVaultOnly {
        bool transferSuccess;
        bytes memory returnData;
        uint256 shamanBalance = address(this).balance;
        // Shaman MUST have been executed to be able to withdraw any remaining balance
        if (executed && shamanBalance > 0) {
            (transferSuccess, returnData) = vault().call{ value: shamanBalance }("");
        }
        if (!transferSuccess) revert Yeet24ShamanModule__TransferFailed(returnData);
        emit ShamanBalanceWithdrawn(shamanBalance);
    }

    /**
     * @notice Accept ETH deposits as a form of rewards to boost initial pool liquidity
     * @dev examples include receiving yeeter fees or extra deposits from a rewards pool
     */
    receive() external payable {
        if (boostRewardsPool == _msgSender()) {
            emit BoostRewardsDeposited(_msgSender(), msg.value);
        }
    }
}
