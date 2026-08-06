// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {IETHRegistrarController} from "ens-contracts/ethregistrar/IETHRegistrarController.sol";

/// @title ENS Diamonds Registrar Controller extension
/// @notice Adds Controller getters required by ENS Diamonds but absent from the upstream interface.
interface IENSDiamondsRegistrarController is IETHRegistrarController {
    /// @notice Returns the timestamp at which a commitment was submitted, or zero if absent.
    function commitments(bytes32 commitment) external view returns (uint256);

    /// @notice Returns the minimum age required before a commitment may be registered.
    function minCommitmentAge() external view returns (uint256);

    /// @notice Returns the maximum age after which a commitment expires.
    function maxCommitmentAge() external view returns (uint256);

    /// @notice Returns the minimum supported registration duration in seconds.
    function MIN_REGISTRATION_DURATION() external view returns (uint256);
}
