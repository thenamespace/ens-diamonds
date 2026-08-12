// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {IETHRegistrarController} from "ens-contracts/ethregistrar/IETHRegistrarController.sol";
import {Test} from "forge-std/Test.sol";
import {IENSDiamonds} from "src/interfaces/IENSDiamonds.sol";
import {IENSDiamondsRegistrarController} from "src/interfaces/IENSDiamondsRegistrarController.sol";

abstract contract ENSDiamondsHandlerBase is Test {
    struct TrackedVault {
        bytes32 vaultId;
        address predictedSafe;
        string label;
        bytes32 targetSalt;
        bytes32 ensSecret;
        uint256 threshold;
    }

    struct VaultCreation {
        TrackedVault tracked;
        address[] owners;
        bytes32 vaultSalt;
        bytes32 targetIntent;
        bytes32 ensCommitment;
    }

    uint96 internal constant MAX_SPEND = 3 ether;
    uint32 internal constant REGISTRATION_DURATION = 365 days;
    uint256 internal constant MAX_TRACKED_VAULTS = 8;

    IENSDiamonds public immutable DIAMONDS;
    IENSDiamondsRegistrarController public immutable CONTROLLER;

    address public immutable ALICE;
    address public immutable BOB;
    address public immutable CHARLIE;
    address public immutable EXECUTOR;

    TrackedVault[] internal trackedVaults;
    IENSDiamonds.State[] internal previousStates;

    uint256 public expectedLiabilities;
    bool public stateRegressed;
    bool public terminalStateChanged;

    constructor(
        IENSDiamonds diamonds_,
        IENSDiamondsRegistrarController controller_,
        address alice_,
        address bob_,
        address charlie_,
        address executor_
    ) {
        DIAMONDS = diamonds_;
        CONTROLLER = controller_;
        ALICE = alice_;
        BOB = bob_;
        CHARLIE = charlie_;
        EXECUTOR = executor_;
    }

    function trackedVaultCount() external view returns (uint256) {
        return trackedVaults.length;
    }

    function trackedVault(uint256 index)
        external
        view
        returns (bytes32 vaultId, address predictedSafe, uint256 threshold)
    {
        TrackedVault storage tracked = trackedVaults[index];
        return (tracked.vaultId, tracked.predictedSafe, tracked.threshold);
    }

    function owners() external view returns (address[] memory) {
        return _owners();
    }

    function _vaultCreation(uint256 index) internal view returns (VaultCreation memory creation) {
        creation.owners = _owners();
        creation.tracked.label = string.concat("invariant-", vm.toString(index));
        creation.vaultSalt = keccak256(abi.encode("vault", index));
        creation.tracked.targetSalt = keccak256(abi.encode("target", index));
        creation.tracked.ensSecret = keccak256(abi.encode("secret", index));
        (creation.tracked.vaultId, creation.tracked.predictedSafe, creation.tracked.threshold) =
            DIAMONDS.predictSafe(ALICE, creation.vaultSalt, creation.owners);
        creation.targetIntent = keccak256(
            abi.encode(
                keccak256(
                    "ENSDiamondsTargetIntentV1(uint256 chainId,address protocol,bytes32 vaultId,address creator,bytes32 labelhash,uint32 registrationDuration,bytes32 targetSalt)"
                ),
                block.chainid,
                address(DIAMONDS),
                creation.tracked.vaultId,
                ALICE,
                keccak256(bytes(creation.tracked.label)),
                REGISTRATION_DURATION,
                creation.tracked.targetSalt
            )
        );
        creation.ensCommitment = CONTROLLER.makeCommitment(
            _registration(
                creation.tracked.label, creation.tracked.predictedSafe, creation.tracked.ensSecret
            )
        );
    }

    function _registration(string memory label, address owner, bytes32 secret)
        internal
        pure
        returns (IETHRegistrarController.Registration memory)
    {
        return IETHRegistrarController.Registration({
            label: label,
            owner: owner,
            duration: REGISTRATION_DURATION,
            secret: secret,
            resolver: address(0),
            data: new bytes[](0),
            reverseRecord: 0,
            referrer: bytes32(0)
        });
    }

    function _readVault(bytes32 vaultId) internal view returns (IENSDiamonds.Vault memory vault) {
        (bool success, bytes memory data) =
            address(DIAMONDS).staticcall(abi.encodeCall(IENSDiamonds.vaults, (vaultId)));
        require(success);
        vault = abi.decode(bytes.concat(bytes32(uint256(32)), data), (IENSDiamonds.Vault));
    }

    function _updateState(uint256 index) internal {
        IENSDiamonds.State current = _readVault(trackedVaults[index].vaultId).state;
        IENSDiamonds.State previous = previousStates[index];

        if (uint256(current) < uint256(previous)) stateRegressed = true;
        if (_isTerminal(previous) && current != previous) terminalStateChanged = true;
        previousStates[index] = current;
    }

    function _isTerminal(IENSDiamonds.State state) internal pure returns (bool) {
        return state == IENSDiamonds.State.Acquired || state == IENSDiamonds.State.Cancelled
            || state == IENSDiamonds.State.Failed;
    }

    function _owner(uint8 seed) internal view returns (address) {
        uint256 index = uint256(seed) % 3;
        if (index == 0) return ALICE;
        if (index == 1) return BOB;
        return CHARLIE;
    }

    function _owners() internal view returns (address[] memory result) {
        result = new address[](3);
        result[0] = ALICE;
        result[1] = BOB;
        result[2] = CHARLIE;
    }
}
