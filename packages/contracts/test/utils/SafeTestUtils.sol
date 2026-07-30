// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {ISafe} from "@safe-global/safe-smart-account/contracts/interfaces/ISafe.sol";
import {Enum} from "@safe-global/safe-smart-account/contracts/libraries/Enum.sol";
import {EfficientHashLib} from "solady/utils/EfficientHashLib.sol";
import {VaultActions} from "test/utils/VaultActions.sol";
import {VaultConfig} from "test/utils/VaultConfig.sol";

abstract contract SafeTestUtils is VaultActions {
    bytes32 internal constant FALLBACK_HANDLER_STORAGE_SLOT =
        0x6c9a6c4a39284e37ed1cf53d337577d14212a4870fb976a4366c693b939918d5;
    bytes32 internal constant SAFE_SALT_DOMAIN = keccak256("ENS_DIAMONDS_SAFE_V1");

    function _safeAt(address account) internal pure returns (ISafe) {
        return ISafe(payable(account));
    }

    function _fallbackHandlerAt(address account) internal view returns (address) {
        return address(uint160(uint256(vm.load(account, FALLBACK_HANDLER_STORAGE_SLOT))));
    }

    function _deployPredictedSafe(VaultConfig memory config) internal returns (address deployed) {
        deployed = address(
            safeProxyFactory.createProxyWithNonce(
                address(safeSingleton), _safeInitializer(config), _safeSaltNonce(config)
            )
        );
        assertEq(deployed, config.predictedSafe);
    }

    function _safeInitializer(VaultConfig memory config) internal view returns (bytes memory) {
        return abi.encodeCall(
            ISafe.setup,
            (
                config.owners,
                config.threshold,
                address(0),
                bytes(""),
                address(safeFallbackHandler),
                address(0),
                0,
                payable(address(0))
            )
        );
    }

    function _safeSaltNonce(VaultConfig memory config) internal view returns (uint256) {
        return uint256(
            EfficientHashLib.hash(
                uint256(SAFE_SALT_DOMAIN),
                block.chainid,
                uint256(uint160(address(diamonds))),
                uint256(config.vaultId)
            )
        );
    }

    function _executeSafeTransaction(
        address account,
        uint256[] memory ownerPrivateKeys,
        address to,
        uint256 value,
        bytes memory data
    ) internal returns (bool success) {
        ISafe safe = _safeAt(account);
        uint256 threshold = safe.getThreshold();
        _sortPrivateKeys(ownerPrivateKeys);

        bytes32 transactionHash = safe.getTransactionHash(
            to,
            value,
            data,
            Enum.Operation.Call,
            0,
            0,
            0,
            address(0),
            payable(address(0)),
            safe.nonce()
        );
        bytes memory signatures;

        for (uint256 i; i < threshold; ++i) {
            (uint8 v, bytes32 r, bytes32 s) = vm.sign(ownerPrivateKeys[i], transactionHash);
            signatures = bytes.concat(signatures, abi.encodePacked(r, s, v));
        }

        success = safe.execTransaction(
            to,
            value,
            data,
            Enum.Operation.Call,
            0,
            0,
            0,
            address(0),
            payable(address(0)),
            signatures
        );
    }

    function _sortPrivateKeys(uint256[] memory privateKeys) internal pure {
        for (uint256 i = 1; i < privateKeys.length; ++i) {
            uint256 key = privateKeys[i];
            address owner = vm.addr(key);
            uint256 j = i;

            while (j != 0 && vm.addr(privateKeys[j - 1]) > owner) {
                privateKeys[j] = privateKeys[j - 1];
                unchecked {
                    --j;
                }
            }
            privateKeys[j] = key;
        }
    }
}
