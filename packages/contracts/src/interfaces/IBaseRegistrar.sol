// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

/// @title ENS Base Registrar ownership interface
/// @notice Minimal interface used to verify ownership of a registered `.eth` label.
interface IBaseRegistrar {
    /// @notice Returns the owner of a label token.
    /// @param tokenId Numeric `.eth` labelhash.
    /// @return owner Current Base Registrar token owner.
    function ownerOf(uint256 tokenId) external view returns (address);
}
