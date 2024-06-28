// SPDX-License-Identifier: MIT
pragma solidity >=0.8.7 <0.9.0;

import { INonfungiblePositionManager } from "../libs/INonfungiblePositionManager.sol";
import { IWETH9 } from "../libs/IWETH9.sol";

/**
 * @title A fair token launcher designed to democratize the token pre-sale process in the DeFi ecosystem.
 * @author DAOHaus
 * @notice It uses Yeeter for token pre-sales and Uniswap V3 for pool creation and initial liquidity position management
 * @dev In order to operate the contract should have Baal Admin and Manager privileges as well as being added as
 * a Safe module to the Baal/Yeeter vault.
 */
interface IYeet24Shaman {
    /**
     * @notice Executes the token launch if yeeter campaign meets its goal
     * @dev If goal is achieved, it should execute the following actions:
     * - Mint a shares amount to this contract so it doubles the total supply of Baal shares
     * - Turn Baal shares/loot transferrable
     * - if any boostRewards (e.g. fees + extra boostRewardsPool deposits) are available forward balance
     *   to the yeeter vault
     * - Execute a multiSend to wrap ETH collected in yeeter vault, transfer WETH from vault to the contract
     *   and call createPoolAndMintPosition.
     * - Create a UniV3Pool for shares token / WETH pair.
     * - Minted position is finally owned by the vault.
     * If fails to achieved the goal, it should execute the following actions:
     * - If boostRewardsPool is set any balance held in the contract should be forwarded to this address
     */
    function execute() external;

    /**
     * @notice Whether or not the shaman got executed
     * @dev executed does not necessarily mean it successfully launched a token
     * @return true if shaman execute() function was called
     */
    function executed() external view returns (bool);

    /**
     * @dev UniswapV3 NonfungiblePositionManager contract
     * @return UniV3 NonfungiblePositionManager contact address
     */
    function nonfungiblePositionManager() external view returns (INonfungiblePositionManager);

    /**
     * @dev WETH address
     * @return address of the WETH contract
     */
    function weth() external view returns (IWETH9);

    /**
     * @notice BoostRewardPool address
     * @dev Rewards pool address used to boost token launches or collect fees for failed campaigns.
     * It could be set to the zero address if no boosts rewards are plugged in into the campaign.
     * @return rewards pool address
     */
    function boostRewardsPool() external view returns (address payable);

    /**
     * @notice Campaign funding goal to be achieved.
     * @dev Should be the same as in the Yeeter
     * @return funding goal
     */
    function goal() external view returns (uint256);

    /**
     * @notice Whether or not the campaign achieved the funding goal.
     * @dev it can be used together with executed() to know if a campaign was successfully launched.
     * @return true if the funding goal was achieved
     */
    function goalAchieved() external view returns (bool);

    /**
     * @notice endTime whn campaign expires
     * @return timestamp in seconds
     */
    function endTime() external view returns (uint256);

    /**
     * @notice trading fee used to create the UniV3 pool
     * @dev Fee should be registered in IUniswapV3Factory
     */
    function poolFee() external view returns (uint24);

    /**
     * @notice UniV3Pool address
     * @dev address is set only when a token is successfully launched
     * @return pool address
     */
    function pool() external view returns (address);

    /**
     * @notice Liquidity position Id
     * @dev NFT position is set only when a token is successfully launched
     * @return liquidity position NFT Id
     */
    function positionId() external view returns (uint256);

    /**
     * @notice Amount of ETH collected to launch the token
     * @dev Value is set only when a token is successfully launched
     * @return ETH collected at token launch
     */
    function balance() external view returns (uint256);

    /**
     * @notice Creates a UniV3Pool and mint an  initial liquidity position
     * @param token0 token address
     * @param token1 token address
     * @param liquidityAmount0 amount of liquidity provided for token0
     * @param liquidityAmount1 amount of liquidity provided for token1
     */
    function createPoolAndMintPosition(
        address token0,
        address token1,
        uint256 liquidityAmount0,
        uint256 liquidityAmount1
    ) external;

    /**
     * @notice Withdraw any balance held in the contract and deposits into the vault.
     * @dev Should be called only after executed == true.
     * It serves as an escape hatch for any ETH submitted to the contract by mistake.
     */
    function withdrawShamanBalance() external;
}
