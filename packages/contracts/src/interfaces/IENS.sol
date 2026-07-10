// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IPriceOracle {
    struct Price {
        uint256 base;
        uint256 premium;
    }
}

/// @notice ENS ETHRegistrarController surface used by the fork test.
/// Verify the on-chain function signatures against the deployed controller
/// at implementation time (Task 11) — this is the current mainnet shape.
interface IETHRegistrarController {
    function rentPrice(string memory name, uint256 duration) external view returns (IPriceOracle.Price memory);
    function minCommitmentAge() external view returns (uint256);
    function makeCommitment(
        string memory name,
        address owner,
        uint256 duration,
        bytes32 secret,
        address resolver,
        bytes[] calldata data,
        bool reverseRecord,
        uint16 ownerControlledFuses
    ) external pure returns (bytes32);
    function commit(bytes32 commitment) external;
    function register(
        string calldata name,
        address owner,
        uint256 duration,
        bytes32 secret,
        address resolver,
        bytes[] calldata data,
        bool reverseRecord,
        uint16 ownerControlledFuses
    ) external payable;
}

interface IBaseRegistrar {
    function ownerOf(uint256 tokenId) external view returns (address);
}
