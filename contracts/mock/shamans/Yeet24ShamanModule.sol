// SPDX-License-Identifier: MIT

pragma solidity ^0.8.7;

import "@daohaus/baal-contracts/contracts/interfaces/IBaal.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";

// import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
// import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";

interface INonfungiblePositionManager {
    struct MintParams {
        address token0;
        address token1;
        uint24 fee;
        int24 tickLower;
        int24 tickUpper;
        uint256 amount0Desired;
        uint256 amount1Desired;
        uint256 amount0Min;
        uint256 amount1Min;
        address recipient;
        uint256 deadline;
    }

    /// @notice Creates a new position wrapped in a NFT
    /// @dev Call this when the pool does exist and is initialized. Note that if the pool is created but not initialized
    /// a method does not exist, i.e. the pool is assumed to be initialized.
    /// @param params The params necessary to mint a position, encoded as `MintParams` in calldata
    /// @return tokenId The ID of the token that represents the minted position
    /// @return liquidity The amount of liquidity for this position
    /// @return amount0 The amount of token0
    /// @return amount1 The amount of token1
    function mint(
        MintParams calldata params
    ) external payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1);

    function createAndInitializePoolIfNecessary(
        address token0,
        address token1,
        uint24 fee,
        uint160 sqrtPriceX96
    ) external payable returns (address pool);
}

interface IWETH {
    function deposit() external payable;

    function transfer(address to, uint value) external returns (bool);

    function withdraw(uint) external;

    function balanceOf(address account) external view returns (uint);
}

// contract shold be set to a shaman (admin, manager) and a treasury module in the summoner
contract Yeet24ShamanModule is Initializable {
    string public constant name = "Yeet24ShamanModule";

    IBaal public baal;
    address public vault;
    INonfungiblePositionManager public constant nonfungiblePositionManager =
        INonfungiblePositionManager(0x1238536071E1c677A632429e3655c799b22cDA52);

    IWETH public constant weth = IWETH(0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14);
    uint24 private constant fee = 10000; // Fee tier corresponding to 1%

    /// @dev The minimum tick that may be passed to #getSqrtRatioAtTick computed from log base 1.0001 of 2**-128
    int24 internal constant MIN_TICK = -887272;
    /// @dev The maximum tick that may be passed to #getSqrtRatioAtTick computed from log base 1.0001 of 2**128
    int24 internal constant MAX_TICK = -MIN_TICK;

    event Setup(address indexed moloch, address indexed vault, uint256 threshold, uint256 expiration, uint256 poolFee);
    event Execute(uint256 indexed tokenId, address pool, uint160 sqrtPriceX96);

    function setup(
        address _moloch, // DAO address
        address _vault, // recipient vault
        bytes memory _initParams
    ) external initializer {
        baal = IBaal(_moloch);
        vault = _vault;
        (uint256 threshold, uint256 expiration, uint256 poolFee, ) = abi.decode(
            _initParams,
            (uint256, uint256, uint256, address)
        );
        // TODO set contract variables
        emit Setup(_moloch, _vault, threshold, expiration, poolFee);
    }

    // VIEW FUNCTIONS

    // PRIVATE FUNCTIONS

    function sqrt(uint256 x) internal pure returns (uint256) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2;
        uint256 y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
        return y;
    }

    /**
     * @dev Calculates the sqrtPriceX96 value for Uniswap V3 pools.
     *
     * This function computes the square root of the price ratio between two tokens
     * and adjusts it to the Uniswap V3 format, which requires the square root price
     * to be scaled by 2^96. This format is used by Uniswap V3 to facilitate high-precision
     * and low-cost arithmetic operations within the protocol.
     *
     * @param amount0 The amount of token0, where token0 is the token with a numerically lower address.
     * @param amount1 The amount of token1, where token1 is the token with a numerically higher address.
     *
     * The price ratio is calculated as the number of units of token1 equivalent to one unit of token0,
     * scaled up by 1e18 to maintain precision during the division operation.
     *
     * @return The square root of the price ratio, adjusted to the Uniswap V3 fixed-point format (sqrtPriceX96).
     *
     * Requirements:
     * - Both `amount0` and `amount1` must be greater than zero to avoid division by zero errors
     *   and ensure meaningful price calculations.
     *
     */
    function calculateSqrtPriceX96(uint256 amount0, uint256 amount1) internal pure returns (uint160) {
        require(amount0 > 0 && amount1 > 0, "Token amounts cannot be zero");

        // Calculate the price ratio as amount1 / amount0
        // Here, `amount1` is multiplied by 1e18 to retain precision after dividing by `amount0`.
        uint256 priceRatio = (amount1 * 1e18) / amount0;

        // Compute the square root of the price ratio.
        uint256 sqrtPrice = sqrt(priceRatio);

        // Adjust the square root price to the Uniswap V3 fixed-point format by scaling up by 2^96,
        // then dividing by 1e9 to correct for the initial scaling by 1e18.
        uint256 sqrtPriceX96 = (sqrtPrice * 2 ** 96) / 1e9;

        // Return the result as a uint160, conforming to the Uniswap V3 type requirement for sqrtPriceX96.
        return uint160(sqrtPriceX96);
    }

    // PUBLIC FUNCTIONS

    function execute() public returns (uint256 tokenId) {
        // this todo:
        // check if paused
        // check if threshold is met
        // a bunch of checks
        // maybe events

        // get total tokens(shares) that were minted durring presale
        uint256 shares = IERC20(baal.sharesToken()).totalSupply();

        // get eth from presale treasury
        (bool success, ) = baal.target().call(
            abi.encodeWithSignature(
                "execTransactionFromModule(address,uint256,bytes,uint8)",
                address(this),
                baal.target().balance,
                "",
                0
            )
        );

        require(success, "execTransactionFromModule failed");

        // wrap eth
        (bool sent, ) = address(weth).call{ value: address(this).balance }("");

        // mint 100% shares to this contract. this doubles the total shares
        address[] memory receivers = new address[](1);
        receivers[0] = address(this);

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = shares;
        baal.mintShares(receivers, amounts);

        // Make shares/loot transferable
        baal.setAdminConfig(false, false);

        // Ensure correct order of tokens based on their addresses
        (address token0, address token1, uint256 amount0, uint256 amount1) = baal.sharesToken() < address(weth)
            ? (baal.sharesToken(), address(weth), shares, weth.balanceOf(address(this)))
            : (address(weth), baal.sharesToken(), weth.balanceOf(address(this)), shares);

        // approve weth and shares with NonfungiblePositionManager (taken from univ3 docs)
        TransferHelper.safeApprove(token0, address(nonfungiblePositionManager), amount0);
        TransferHelper.safeApprove(token1, address(nonfungiblePositionManager), amount1);

        // calculate the sqrtPriceX96
        uint160 sqrtPriceX96 = calculateSqrtPriceX96(amount0, amount1);

        // Create and initialize the pool if necessary
        address pool = nonfungiblePositionManager.createAndInitializePoolIfNecessary(token0, token1, fee, sqrtPriceX96);

        // Set up mintParams with full range for volitile token
        // tick upper and lower need to be a valid tick per fee (divisiable by 200 for 1%)
        // postion receipt NFT goes to the vault
        INonfungiblePositionManager.MintParams memory mintParams = INonfungiblePositionManager.MintParams({
            token0: token0,
            token1: token1,
            fee: fee,
            tickLower: -887200,
            tickUpper: 887200,
            amount0Desired: amount0,
            amount1Desired: amount1,
            amount0Min: 0,
            amount1Min: 0,
            recipient: vault,
            deadline: block.timestamp + 15 minutes // Ensure a reasonable deadline
        });

        // Mint the position
        (tokenId, , , ) = nonfungiblePositionManager.mint(mintParams);

        emit Execute(tokenId, pool, sqrtPriceX96);
    }

    // ADMIN FUNCTIONS

    //

    receive() external payable {}
}
