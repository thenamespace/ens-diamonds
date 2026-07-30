// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {IENSDiamonds} from "src/interfaces/IENSDiamonds.sol";
import {VaultActions} from "test/utils/VaultActions.sol";

contract PredictSafeTest is VaultActions {
    bytes32 internal constant VAULT_ID_DOMAIN = keccak256("ENS_DIAMONDS_VAULT_V1");

    function test_predictSafeIsDeterministic() public view {
        address[] memory owners = _owners(accounts.alice.addr, accounts.bob.addr);

        (bytes32 vaultId, address safe, uint256 threshold) =
            diamonds.predictSafe(accounts.alice.addr, DEFAULT_VAULT_SALT, owners);
        (bytes32 repeatedId, address repeatedSafe, uint256 repeatedThreshold) =
            diamonds.predictSafe(accounts.alice.addr, DEFAULT_VAULT_SALT, owners);

        bytes32 expectedId = keccak256(
            abi.encode(
                VAULT_ID_DOMAIN,
                block.chainid,
                address(diamonds),
                accounts.alice.addr,
                DEFAULT_VAULT_SALT
            )
        );
        assertEq(vaultId, expectedId);
        assertEq(repeatedId, vaultId);
        assertEq(repeatedSafe, safe);
        assertEq(repeatedThreshold, threshold);
        assertEq(threshold, 2);
        assertEq(safe.code.length, 0);
    }

    function test_predictSafeChangesAcrossDomains() public {
        address[] memory owners = _owners(accounts.alice.addr, accounts.bob.addr);
        (bytes32 originalId, address originalSafe,) =
            diamonds.predictSafe(accounts.alice.addr, DEFAULT_VAULT_SALT, owners);

        (bytes32 saltId, address saltSafe,) = diamonds.predictSafe(
            accounts.alice.addr, bytes32(uint256(DEFAULT_VAULT_SALT) + 1), owners
        );
        assertNotEq(saltId, originalId);
        assertNotEq(saltSafe, originalSafe);

        address[] memory otherOwners = _owners(accounts.bob.addr, accounts.alice.addr);
        (bytes32 creatorId, address creatorSafe,) =
            diamonds.predictSafe(accounts.bob.addr, DEFAULT_VAULT_SALT, otherOwners);
        assertNotEq(creatorId, originalId);
        assertNotEq(creatorSafe, originalSafe);

        vm.chainId(block.chainid + 1);
        (bytes32 chainId, address chainSafe,) =
            diamonds.predictSafe(accounts.alice.addr, DEFAULT_VAULT_SALT, owners);
        assertNotEq(chainId, originalId);
        assertNotEq(chainSafe, originalSafe);
    }

    function test_predictSafeChangesWhenOwnerOrderChanges() public view {
        address[] memory owners =
            _owners(accounts.alice.addr, accounts.bob.addr, accounts.charlie.addr);
        (, address originalSafe,) =
            diamonds.predictSafe(accounts.alice.addr, DEFAULT_VAULT_SALT, owners);

        owners[1] = accounts.charlie.addr;
        owners[2] = accounts.bob.addr;
        (, address reorderedSafe,) =
            diamonds.predictSafe(accounts.alice.addr, DEFAULT_VAULT_SALT, owners);

        assertNotEq(reorderedSafe, originalSafe);
    }

    function testFuzz_predictSafeUsesStrictMajority(uint8 ownerCountSeed) public view {
        uint256 ownerCount = bound(ownerCountSeed, 2, 10);
        address[] memory owners = new address[](ownerCount);
        owners[0] = accounts.alice.addr;

        for (uint256 i = 1; i < ownerCount; ++i) {
            owners[i] = vm.addr(10_000 + i);
        }

        (,, uint256 threshold) =
            diamonds.predictSafe(accounts.alice.addr, DEFAULT_VAULT_SALT, owners);
        assertEq(threshold, ownerCount / 2 + 1);
    }

    function test_predictSafeRevertsForInvalidCreatorOrSalt() public {
        address[] memory owners = _owners(accounts.alice.addr, accounts.bob.addr);

        vm.expectRevert(IENSDiamonds.InvalidAddress.selector);
        diamonds.predictSafe(address(0), DEFAULT_VAULT_SALT, owners);

        vm.expectRevert(IENSDiamonds.InvalidConfiguration.selector);
        diamonds.predictSafe(accounts.alice.addr, bytes32(0), owners);
    }

    function test_predictSafeRevertsForInvalidOwnerCount() public {
        address[] memory oneOwner = new address[](1);
        oneOwner[0] = accounts.alice.addr;

        vm.expectRevert(IENSDiamonds.InvalidOwners.selector);
        diamonds.predictSafe(accounts.alice.addr, DEFAULT_VAULT_SALT, oneOwner);

        address[] memory elevenOwners = new address[](11);
        elevenOwners[0] = accounts.alice.addr;
        for (uint256 i = 1; i < elevenOwners.length; ++i) {
            elevenOwners[i] = vm.addr(20_000 + i);
        }

        vm.expectRevert(IENSDiamonds.InvalidOwners.selector);
        diamonds.predictSafe(accounts.alice.addr, DEFAULT_VAULT_SALT, elevenOwners);
    }

    function test_predictSafeRevertsUnlessCreatorIsFirstOwner() public {
        address[] memory owners = _owners(accounts.bob.addr, accounts.alice.addr);

        vm.expectRevert(IENSDiamonds.InvalidOwners.selector);
        diamonds.predictSafe(accounts.alice.addr, DEFAULT_VAULT_SALT, owners);
    }

    function test_predictSafeRevertsForForbiddenOwners() public {
        address[] memory owners = _owners(accounts.alice.addr, address(0));
        vm.expectRevert(IENSDiamonds.InvalidOwners.selector);
        diamonds.predictSafe(accounts.alice.addr, DEFAULT_VAULT_SALT, owners);

        owners[1] = address(1);
        vm.expectRevert(IENSDiamonds.InvalidOwners.selector);
        diamonds.predictSafe(accounts.alice.addr, DEFAULT_VAULT_SALT, owners);

        owners[1] = address(diamonds);
        vm.expectRevert(IENSDiamonds.InvalidOwners.selector);
        diamonds.predictSafe(accounts.alice.addr, DEFAULT_VAULT_SALT, owners);
    }

    function test_predictSafeRevertsForDuplicateOwner() public {
        address[] memory owners = _owners(accounts.alice.addr, accounts.alice.addr);

        vm.expectRevert(IENSDiamonds.InvalidOwners.selector);
        diamonds.predictSafe(accounts.alice.addr, DEFAULT_VAULT_SALT, owners);
    }
}
