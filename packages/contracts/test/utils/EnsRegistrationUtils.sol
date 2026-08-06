// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {IETHRegistrarController} from "ens-contracts/ethregistrar/IETHRegistrarController.sol";
import {IPriceOracle} from "ens-contracts/ethregistrar/IPriceOracle.sol";
import {SafeTestUtils} from "test/utils/SafeTestUtils.sol";

abstract contract EnsRegistrationUtils is SafeTestUtils {
    function _registerDirect(string memory label, address owner, uint256 duration, bytes32 secret)
        internal
        returns (uint256 expires)
    {
        IETHRegistrarController.Registration memory registration =
            IETHRegistrarController.Registration({
                label: label,
                owner: owner,
                duration: duration,
                secret: secret,
                resolver: address(0),
                data: new bytes[](0),
                reverseRecord: 0,
                referrer: bytes32(0)
            });
        bytes32 commitment = controller.makeCommitment(registration);

        vm.prank(owner);
        controller.commit(commitment);
        vm.warp(block.timestamp + controller.minCommitmentAge());

        IPriceOracle.Price memory quote = controller.rentPrice(label, duration);
        uint256 price = quote.base + quote.premium;
        vm.deal(owner, owner.balance + price);
        vm.prank(owner);
        controller.register{value: price}(registration);

        expires = baseRegistrar.nameExpires(uint256(keccak256(bytes(label))));
    }
}
