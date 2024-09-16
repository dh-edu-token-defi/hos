// SPDX-License-Identifier: MIT
pragma solidity >=0.8.7 <0.9.0;

import { IHOSBase } from "../hos/IHOSBase.sol";

abstract contract HosDeployable {
    address public hos;

    function __HosDeployable_init(bytes32 shamanTemplateId) internal {

        hos = msg.sender;
        IHOSBase(hos).registerShaman(address(this), shamanTemplateId);
    }

}    