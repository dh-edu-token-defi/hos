// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity >=0.8.7 <0.9.0;

import { IERC165 } from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

interface IShaman is IERC165 {
    function baal() external view returns (address);
    function name() external view returns (string memory);
    function setup(address baal, address vault, bytes memory initializeParams) external;
    function vault() external view returns (address);
}
