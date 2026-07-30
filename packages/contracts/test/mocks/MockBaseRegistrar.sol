// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

contract MockBaseRegistrar {
    error TokenDoesNotExist(uint256 tokenId);
    error OwnerQueryReverted();

    mapping(uint256 tokenId => address owner) internal owners;

    bool public ownerQueryShouldRevert;

    function ownerOf(uint256 tokenId) external view returns (address owner) {
        if (ownerQueryShouldRevert) revert OwnerQueryReverted();

        owner = owners[tokenId];
        if (owner == address(0)) revert TokenDoesNotExist(tokenId);
    }

    function exists(uint256 tokenId) external view returns (bool) {
        return owners[tokenId] != address(0);
    }

    function ownerOfOrZero(uint256 tokenId) external view returns (address) {
        return owners[tokenId];
    }

    function setOwner(uint256 tokenId, address owner) external {
        owners[tokenId] = owner;
    }

    function setOwnerQueryShouldRevert(bool shouldRevert) external {
        ownerQueryShouldRevert = shouldRevert;
    }
}
