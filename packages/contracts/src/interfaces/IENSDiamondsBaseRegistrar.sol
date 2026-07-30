// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

/// @notice ENS Base Registrar reads required by ENS Diamonds.
interface IENSDiamondsBaseRegistrar {
    function ownerOf(uint256 tokenId) external view returns (address);

    function nameExpires(uint256 tokenId) external view returns (uint256);
}
