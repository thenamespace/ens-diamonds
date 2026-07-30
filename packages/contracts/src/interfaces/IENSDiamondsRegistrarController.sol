// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {IETHRegistrarController} from "ens-contracts/ethregistrar/IETHRegistrarController.sol";

// ENS getters absent from the upstream interface.
interface IENSDiamondsRegistrarController is IETHRegistrarController {
    function commitments(bytes32 commitment) external view returns (uint256);

    function minCommitmentAge() external view returns (uint256);

    function maxCommitmentAge() external view returns (uint256);

    function MIN_REGISTRATION_DURATION() external view returns (uint256);
}
