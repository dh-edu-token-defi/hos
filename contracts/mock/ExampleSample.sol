// SPDX-License-Identifier: MIT
pragma solidity >=0.8.7 <0.9.0;

import { AdminShaman, IAdminShaman } from "../shaman/AdminShaman.sol";
import { GovernorShaman, IGovernorShaman } from "../shaman/GovernorShaman.sol";
import { IManagerShaman, ManagerShaman } from "../shaman/ManagerShaman.sol";
import { IShaman } from "../shaman/interfaces/IShaman.sol";
import { ZodiacModule, ZodiacModuleShaman } from "../shaman/ZodiacModuleShaman.sol";

interface IExampleShaman {
    function blockNo() external returns (uint256);
}

contract ExampleShaman is IExampleShaman, ZodiacModuleShaman, AdminShaman, GovernorShaman, ManagerShaman {
    uint256 public blockNo;

    event Setup(address _baal, address _vault, bytes _initializeParams);

    function __ExampleShaman__init(address _baal, address _vault) internal onlyInitializing {
        __ZodiacModuleShaman__init("ExampleShaman", _baal, _vault);
        __AdminShaman_init_unchained();
        __GovernorShaman_init_unchained();
        __ManagerShaman_init_unchained();
        __ExampleShaman__init_unchained();
    }

    function __ExampleShaman__init_unchained() internal onlyInitializing {
        blockNo = block.number;
    }

    /**
     * @notice Main initializer function to setup the shaman config
     * @inheritdoc IShaman
     */
    function setup(address _baal, address _vault, bytes memory _initializeParams) public override(IShaman) initializer {
        __ExampleShaman__init(_baal, _vault);
        emit Setup(_baal, _vault, _initializeParams);
    }

    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(
        bytes4 _interfaceId
    ) public view virtual override(ZodiacModuleShaman, GovernorShaman, ManagerShaman, AdminShaman) returns (bool) {
        return _interfaceId == type(IExampleShaman).interfaceId || super.supportsInterface(_interfaceId);
    }

    function zodiacModuleId() external pure returns (bytes4) {
        return type(ZodiacModule).interfaceId;
    }

    function adminShamanId() external pure returns (bytes4) {
        return type(IAdminShaman).interfaceId;
    }

    function governorShamanId() external pure returns (bytes4) {
        return type(IGovernorShaman).interfaceId;
    }

    function managerShamanId() external pure returns (bytes4) {
        return type(IManagerShaman).interfaceId;
    }

    function shamanId() external pure returns (bytes4) {
        return type(IShaman).interfaceId;
    }
}
