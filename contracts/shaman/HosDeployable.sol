// SPDX-License-Identifier: MIT
pragma solidity >=0.8.7 <0.9.0;

import { IHOSBase } from "../hos/IHOSBase.sol";
import { ContextUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";

abstract contract HosDeployable is ContextUpgradeable {
    address public hos;

    function __HosDeployable_init(bytes32 shamanTemplateId) internal {
        hos = _msgSender();
        IHOSBase(hos).registerShaman(address(this), shamanTemplateId);
    }
}
