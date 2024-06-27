// SPDX-License-Identifier: MIT
pragma solidity >=0.8.7 <0.9.0;

interface IShaman {
    function baal() external view returns (address);

    function name() external view returns (string memory);

    function setup(address baal, address vault, bytes memory initializeParams) external;

    function supportsInterface(bytes4 interfaceId) external view returns (bool);

    function vault() external view returns (address);
}
