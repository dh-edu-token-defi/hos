//SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// TODO: can't use this interface as it defines another setUp selector
// import "@daohaus/baal-contracts/contracts/interfaces/IBaalToken.sol";

interface IBaalFixedToken {
    function setUp(bytes memory initParams) external;

    function initialMint(address vault, address claimShaman, bytes memory initParams) external;

    function name() external view returns (string memory);

    function symbol() external view returns (string memory);

    function transferOwnership(address newOwner) external;
}
