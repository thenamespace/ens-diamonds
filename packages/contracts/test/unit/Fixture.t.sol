// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {ISafe} from "@safe-global/safe-smart-account/contracts/interfaces/ISafe.sol";
import {IProxy} from "@safe-global/safe-smart-account/contracts/proxies/SafeProxy.sol";
import {IENSDiamonds} from "src/interfaces/IENSDiamonds.sol";
import {ENSDiamondsTestBase} from "test/utils/ENSDiamondsTestBase.sol";

contract ENSDiamondsFixtureTest is ENSDiamondsTestBase {
    function test_fixtureUsesPinnedSafeContracts() public view {
        assertEq(safeSingleton.VERSION(), "1.5.0");
        assertGt(address(safeSingleton).code.length, 0);
        assertGt(address(safeProxyFactory).code.length, 0);
        assertGt(address(safeFallbackHandler).code.length, 0);
    }

    function test_fixturePurchasesIntoRealSafeProxy() public {
        VaultFixture memory fixture = _defaultVaultFixture();
        uint256 funding = 3 ether;
        uint256 price = BASE_PRICE + PREMIUM_PRICE;

        _createVault(fixture, funding);
        uint256 committedAt = _beginAcquisition(fixture);
        assertEq(committedAt, INITIAL_TIMESTAMP);

        _matureCommitment(fixture);
        _purchase(fixture, executor);

        IENSDiamonds.Vault memory vault = _readVault(fixture.vaultId);
        ISafe deployedSafe = _safeAt(fixture.predictedSafe);
        address[] memory actualOwners = deployedSafe.getOwners();

        assertGt(fixture.predictedSafe.code.length, 0);
        assertEq(IProxy(fixture.predictedSafe).masterCopy(), address(safeSingleton));
        assertEq(deployedSafe.getThreshold(), fixture.threshold);
        assertEq(actualOwners, fixture.owners);
        assertEq(_fallbackHandlerAt(fixture.predictedSafe), address(safeFallbackHandler));
        assertEq(baseRegistrar.ownerOf(uint256(fixture.labelhash)), fixture.predictedSafe);
        assertEq(controller.lastCommitment(), fixture.ensCommitment);
        assertEq(controller.lastOwner(), fixture.predictedSafe);
        assertEq(controller.lastValue(), price);
        assertEq(controller.registerCallCount(), 1);
        assertEq(controller.commitments(fixture.ensCommitment), 0);
        assertEq(uint256(vault.state), uint256(IENSDiamonds.State.Acquired));
        assertEq(vault.escrowed, funding - price);
        assertEq(diamonds.totalLiabilities(), funding - price);
        assertEq(address(diamonds).balance, funding - price);
        assertEq(address(controller).balance, price);

        uint256 transferAmount = 0.5 ether;
        uint256 recipientBalance = thirdMember.balance;
        vm.deal(fixture.predictedSafe, transferAmount);

        assertTrue(
            _execSafeTransaction(
                fixture.predictedSafe,
                _defaultOwnerPrivateKeys(),
                thirdMember,
                transferAmount,
                bytes("")
            )
        );
        assertEq(thirdMember.balance, recipientBalance + transferAmount);
    }
}
