// SPDX-License-Identifier: MIT
pragma solidity >=0.8.7 <0.9.0;

import { ContextUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";

import { IHOSBase } from "../hos/IHOSBase.sol";


abstract contract HOSDeployable is ContextUpgradeable {
    address internal hos;

    function __HOSDeployable_init(bytes32 shamanTemplateId) internal onlyInitializing {
        __HOSDeployable_init_unchained(shamanTemplateId);
    }

    function __HOSDeployable_init_unchained(bytes32 shamanTemplateId) internal onlyInitializing {
        hos = _msgSender();
        IHOSBase(hos).registerShaman(shamanTemplateId);
    }
}
