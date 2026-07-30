// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

interface IBaseRegistrar {
    function ownerOf(uint256 tokenId) external view returns (address);
}
