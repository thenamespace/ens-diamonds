// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {IENSDiamonds} from "src/interfaces/IENSDiamonds.sol";
import {ENSDiamondsTestBase} from "test/utils/ENSDiamondsTestBase.sol";

contract ReceiveTest is ENSDiamondsTestBase {
    function test_receiveRejectsDirectEther() public {
        vm.prank(accounts.alice.addr);
        (bool success, bytes memory result) = address(diamonds).call{value: 1 ether}(bytes(""));

        assertFalse(success);
        assertEq(result, abi.encodeWithSelector(IENSDiamonds.DirectETHNotAccepted.selector));
        assertEq(address(diamonds).balance, 0);
    }

    function test_fallbackRejectsCallsAndEther() public {
        vm.prank(accounts.alice.addr);
        (bool success, bytes memory result) = address(diamonds).call{value: 1 ether}(hex"deadbeef");

        assertFalse(success);
        assertEq(result, abi.encodeWithSelector(IENSDiamonds.DirectETHNotAccepted.selector));
        assertEq(address(diamonds).balance, 0);
    }
}
