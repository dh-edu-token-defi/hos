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

    IWETH public constant weth = IWETH(0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9);
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

    function sqrt(uint y) internal pure returns (uint) {
        if (y > 3) {
            uint z = y;
            uint x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
            return z;
        } else if (y != 0) {
            return 1;
        }
        return 0;
    }

    function calculateSqrtPriceX96(uint256 amount0, uint256 amount1) internal pure returns (uint160) {
        require(amount0 > 0 && amount1 > 0, "Token amounts cannot be zero");

        // Calculate price ratio as amount1 / amount0 since amount1 is for token1 and amount0 is for token0
        uint256 priceRatio = (amount1 * 1e18) / amount0; // Price of 1 token0 in terms of token1

        uint256 sqrtPrice = sqrt(priceRatio);
        uint256 sqrtPriceX96 = (sqrtPrice * 2 ** 96) / 1e9;

        return uint160(sqrtPriceX96);
    }

    // PUBLIC FUNCTIONS

    function execute() public returns (uint256 tokenId) {
        // check if paused
        // check if threshold is met
        // loot holder can execute
        // get balance of DAO
        // withdraw eth from dao
        // wrap eth?
        // mint 50% more shares
        // approve uniswap
        // provide liquidity
        // transfer LP tokens to vault

        uint256 shares = IERC20(baal.sharesToken()).totalSupply();
        //uint24 poolFee = 10000; // 1%

        // get eth from DAO
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

        // mint 100% shares to this contract
        address[] memory receivers = new address[](1);
        receivers[0] = address(this);

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = shares;
        baal.mintShares(receivers, amounts);

        // make shares/loot transferable
        baal.setAdminConfig(false, false);

        // uint256 amountAToMint = shares;
        // uint256 amountBToMint = weth.balanceOf(address(this));
        // address tokenA = baal.sharesToken();
        // address tokenB = address(weth);

        // Ensure correct order of tokens based on their addresses
        (address token0, address token1, uint256 amount0, uint256 amount1) = baal.sharesToken() < address(weth)
            ? (baal.sharesToken(), address(weth), shares, weth.balanceOf(address(this)))
            : (address(weth), baal.sharesToken(), weth.balanceOf(address(this)), shares);

        // approve weth and shares with NonfungiblePositionManager (taken from univ3 docs)
        TransferHelper.safeApprove(token0, address(nonfungiblePositionManager), amount0);
        TransferHelper.safeApprove(token1, address(nonfungiblePositionManager), amount1);

        uint160 sqrtPriceX96 = calculateSqrtPriceX96(amount0, amount1);

        // Create and initialize the pool if necessary
        address pool = nonfungiblePositionManager.createAndInitializePoolIfNecessary(token0, token1, fee, sqrtPriceX96);

        // Set up mintParams with full range
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
            recipient: msg.sender,
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
