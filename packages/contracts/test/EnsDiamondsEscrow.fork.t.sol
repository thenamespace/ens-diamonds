// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {EnsDiamondsEscrow} from "../src/EnsDiamondsEscrow.sol";
import {IETHRegistrarController, IPriceOracle, IBaseRegistrar} from "../src/interfaces/IENS.sol";
import {ISafe} from "../src/interfaces/ISafe.sol";
import {ISafeProxyFactory} from "../src/interfaces/ISafeProxyFactory.sol";

// Addresses rule (spec §10): you MUST resolve the current canonical mainnet
// addresses at implementation time and paste them into the constants below.
// Do NOT trust values from model memory. Resolution methods:
// - Safe `SafeProxyFactory` + Safe singleton (`SafeL2`/`Safe`) + `CompatibilityFallbackHandler` v1.4.1: use the official `safe-global/safe-deployments` repo (JSON files) or app.safe.global's deployment docs.
// - ENS `ETHRegistrarController`, `PublicResolver`, `BaseRegistrarImplementation`: resolve via the ENS registry (`resolver("eth")` / documented addresses on docs.ens.domains). Confirm the `ETHRegistrarController` is the version whose `register`/`rentPrice` signatures match `IENS.sol`; if ENS has shipped a newer controller, update the interface to match before writing the test.
// This test is gated on `MAINNET_RPC_URL`; skip it in CI runs without an archive/full node by not setting the env var (the test `vm.skip`s itself).
contract EnsDiamondsEscrowForkTest is Test {
    // === FILL THESE IN at implementation time — verify against canonical lists. ===
    address constant SAFE_PROXY_FACTORY = address(0); // TODO: canonical v1.4.1 factory
    address constant SAFE_SINGLETON = address(0); //     TODO: canonical v1.4.1 singleton
    address constant SAFE_FALLBACK_HANDLER = address(0); // TODO: CompatibilityFallbackHandler v1.4.1
    address constant ENS_CONTROLLER = address(0); //     TODO: ETHRegistrarController (mainnet)
    address constant ENS_RESOLVER = address(0); //       TODO: PublicResolver (mainnet)
    address constant ENS_BASE_REGISTRAR = address(0); // TODO: BaseRegistrarImplementation (mainnet)
    // =============================================================================

    EnsDiamondsEscrow escrow;
    address alice = address(0xA11CE);
    address bob = address(0xB0B);

    function setUp() public {
        string memory rpc = vm.envOr("MAINNET_RPC_URL", string(""));
        vm.skip(bytes(rpc).length == 0);
        if (bytes(rpc).length == 0) return;
        vm.createSelectFork(rpc);
        escrow = new EnsDiamondsEscrow(SAFE_PROXY_FACTORY, SAFE_SINGLETON, SAFE_FALLBACK_HANDLER);
    }

    function test_fork_finalizeDeploysRealSafeAndRegistersName() public {
        // Guard so the test is a no-op until addresses are filled in.
        if (SAFE_PROXY_FACTORY == address(0)) {
            vm.skip(true);
            return;
        }

        // --- Fund a pool to a modest target ---
        string memory label = "coffertestname1234"; // an available, never-in-premium test label on the fork
        uint256 target = 1 ether;

        address[] memory inv = new address[](1);
        inv[0] = bob;
        vm.prank(alice);
        uint256 id = escrow.createPool(label, uint96(target), uint40(block.timestamp + 3 days), inv);

        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
        vm.prank(alice);
        escrow.deposit{value: 0.5 ether}(id);
        vm.prank(bob);
        escrow.deposit{value: 0.5 ether}(id); // funded exactly

        // --- Finalize: deploy the real Safe and fund it ---
        vm.prank(alice);
        address safe = escrow.finalize(id);
        assertGt(safe.code.length, 0, "safe not deployed");
        assertEq(safe.balance, target);

        // --- Register the name through the Safe (simulated: call controller as the Safe) ---
        IETHRegistrarController controller = IETHRegistrarController(ENS_CONTROLLER);
        uint256 duration = 365 days;
        bytes32 secret = keccak256("coffer-secret");
        bytes[] memory data = new bytes[](0);

        bytes32 commitment = controller.makeCommitment(label, safe, duration, secret, ENS_RESOLVER, data, false, 0);
        vm.prank(alice);
        controller.commit(commitment);

        vm.warp(block.timestamp + controller.minCommitmentAge() + 1);

        IPriceOracle.Price memory price = controller.rentPrice(label, duration);
        uint256 total = price.base + price.premium;

        // Execute register AS the Safe (in production this is a threshold Safe tx;
        // on the fork we prank the Safe to prove the controller accepts owner==safe).
        vm.deal(safe, total * 2);
        vm.prank(safe);
        controller.register{value: total}(label, safe, duration, secret, ENS_RESOLVER, data, false, 0);

        // --- Confirm ownership ---
        uint256 labelId = uint256(keccak256(bytes(label)));
        assertEq(IBaseRegistrar(ENS_BASE_REGISTRAR).ownerOf(labelId), safe, "safe does not own the name");
    }

    function test_fork_finalizeAdoptsRealPreDeployedSafe() public {
        if (SAFE_PROXY_FACTORY == address(0)) {
            vm.skip(true);
            return;
        }

        // Fund a pool (alice then bob → contributors [alice, bob]).
        string memory label = "coffertestname5678";
        uint256 target = 1 ether;
        address[] memory inv = new address[](1);
        inv[0] = bob;
        vm.prank(alice);
        uint256 id = escrow.createPool(label, uint96(target), uint40(block.timestamp + 3 days), inv);
        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
        vm.prank(alice);
        escrow.deposit{value: 0.5 ether}(id);
        vm.prank(bob);
        escrow.deposit{value: 0.5 ether}(id); // funded exactly

        // Reconstruct the EXACT initializer finalize will build, and PRE-DEPLOY the Safe
        // via the real factory (simulating a squatter/front-runner).
        address[] memory owners = new address[](2);
        owners[0] = alice;
        owners[1] = bob;
        bytes memory initializer = abi.encodeWithSelector(
            ISafe.setup.selector,
            owners,
            uint256(2),
            address(0),
            bytes(""),
            SAFE_FALLBACK_HANDLER,
            address(0),
            uint256(0),
            payable(address(0))
        );
        address preDeployed =
            ISafeProxyFactory(SAFE_PROXY_FACTORY).createProxyWithNonce(SAFE_SINGLETON, initializer, id);
        assertGt(preDeployed.code.length, 0, "pre-deploy failed");

        // finalize must ADOPT the pre-existing real Safe (not revert) and fund it.
        vm.prank(alice);
        address safe = escrow.finalize(id);
        assertEq(safe, preDeployed, "did not adopt the pre-deployed real Safe");
        assertEq(safe.balance, target);
        assertEq(address(escrow).balance, 0);
    }
}
