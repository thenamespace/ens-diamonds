// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {IENSDiamondsRegistrarController} from "./interfaces/IENSDiamondsRegistrarController.sol";
import {ReentrancyGuardTransient} from "@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {ISafe} from "@safe-global/safe-smart-account/contracts/interfaces/ISafe.sol";
import {
    SafeProxyFactory
} from "@safe-global/safe-smart-account/contracts/proxies/SafeProxyFactory.sol";
import {IBaseRegistrar} from "ens-contracts/ethregistrar/IBaseRegistrar.sol";
import {IETHRegistrarController} from "ens-contracts/ethregistrar/IETHRegistrarController.sol";
import {IPriceOracle} from "ens-contracts/ethregistrar/IPriceOracle.sol";

/// @title ENS Diamonds
/// @notice Pools ETH from a fixed group to register one .eth name directly to a
/// deterministic Safe.
/// @dev This contract is immutable, has no administrator, and targets networks
/// supporting EIP-1153 transient storage.
contract ENSDiamonds is ReentrancyGuardTransient {
    using SafeCast for uint256;

    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------

    /// @notice Lifecycle of an acquisition vault.
    enum State {
        Draft,
        Funding,
        Committed,
        Acquired,
        Cancelled,
        Failed
    }

    /// @notice Persistent state for one acquisition.
    /// @dev Deliberately packed into four storage slots.
    struct Vault {
        // Slot 0
        address creator;
        uint96 escrowed;
        // Slot 1
        uint96 maxSpend;
        uint40 committedAt;
        uint32 registrationDuration;
        State state;
        // Slots 2 and 3
        bytes32 targetIntent;
        bytes32 ensCommitment;
    }

    /// @dev Ephemeral Safe deployment data shared by prediction and creation.
    struct SafeConfig {
        address predicted;
        uint256 threshold;
        uint256 saltNonce;
        bytes initializer;
    }

    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------

    uint256 public constant MIN_MEMBERS = 2;
    uint256 public constant MAX_MEMBERS = 10;

    bytes32 public constant TARGET_INTENT_TYPEHASH = keccak256(
        "ENSDiamondsTargetIntentV1(uint256 chainId,address protocol,uint256 vaultId,address creator,bytes32 labelhash,uint32 registrationDuration,bytes32 targetSalt)"
    );

    bytes32 internal constant SAFE_SALT_DOMAIN = keccak256("ENS_DIAMONDS_SAFE_V1");
    address internal constant SAFE_SENTINEL = address(0x1);

    // -------------------------------------------------------------------------
    // Immutable dependencies
    // -------------------------------------------------------------------------

    IENSDiamondsRegistrarController public immutable CONTROLLER;
    IBaseRegistrar public immutable BASE_REGISTRAR;
    ISafe public immutable SAFE_SINGLETON;
    SafeProxyFactory public immutable SAFE_PROXY_FACTORY;
    address public immutable SAFE_FALLBACK_HANDLER;

    uint256 public immutable MIN_COMMITMENT_AGE;
    uint256 public immutable MAX_COMMITMENT_AGE;
    uint256 public immutable MIN_REGISTRATION_DURATION;
    bytes32 public immutable SAFE_PROXY_INIT_CODE_HASH;

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------

    mapping(uint256 vaultId => Vault vault) public vaults;
    mapping(uint256 vaultId => address[] owners) internal ownersOf;
    mapping(uint256 vaultId => mapping(address member => uint256 balance)) public balanceOf;

    uint256 public vaultCount;
    uint256 public totalLiabilities;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event VaultCreated(
        uint256 indexed vaultId,
        address indexed creator,
        uint96 maxSpend,
        uint32 registrationDuration,
        address[] owners
    );

    event FundingOpened(
        uint256 indexed vaultId, bytes32 targetIntent, bytes32 ensCommitment, uint256 creatorDeposit
    );

    event Deposited(uint256 indexed vaultId, address indexed member, uint256 amount);

    event Withdrawn(
        uint256 indexed vaultId, address indexed member, address indexed recipient, uint256 amount
    );

    event VaultCancelled(uint256 indexed vaultId);

    event AcquisitionCommitted(
        uint256 indexed vaultId,
        bytes32 ensCommitment,
        address indexed predictedSafe,
        uint256 committedAt,
        uint256 threshold
    );

    event NameAcquired(
        uint256 indexed vaultId,
        bytes32 indexed labelhash,
        address indexed safe,
        uint256 protocolPrice,
        uint256 refundableBalance,
        bool copiedPurchase
    );

    event AcquisitionExpired(uint256 indexed vaultId);

    event Claimed(
        uint256 indexed vaultId, address indexed member, address indexed recipient, uint256 amount
    );

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error InvalidDependency(address dependency);
    error InvalidDependencyConfiguration();
    error VaultNotFound(uint256 vaultId);
    error Unauthorized();
    error InvalidState(State current);
    error InvalidMaxSpend();
    error InvalidDuration();
    error InvalidOwnerCount();
    error InvalidOwner(address owner);
    error DuplicateOwner(address owner);
    error PredictedSafeIsOwner(address safe);
    error ZeroTargetIntent();
    error ZeroENSCommitment();
    error ZeroTargetSalt();
    error ZeroENSSecret();
    error ZeroAmount();
    error InvalidRecipient();
    error NotMember(address account);
    error FundingCapExceeded();
    error NoFunding();
    error InsufficientBalance();
    error TargetIntentMismatch();
    error ENSCommitmentMismatch();
    error CommitmentAtBoundary();
    error CommitmentTooYoung(uint256 validAt);
    error CommitmentExpired(uint256 expiredAt);
    error CommitmentNotExpired(uint256 expiresAt);
    error CommitmentChanged();
    error InsufficientFunding(uint256 price, uint256 escrowed);
    error SafeDeploymentFailed();
    error SafePredictionMismatch(address expected, address actual);
    error ENSOwnershipMismatch();
    error ENSExpiryMismatch(uint256 expiry);
    error NothingToClaim();
    error ETHTransferFailed();
    error DirectETHNotAccepted();

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /// @param controller_ Canonical ENS ETH Registrar Controller.
    /// @param baseRegistrar_ Canonical ENS Base Registrar.
    /// @param safeSingleton_ Canonical Safe singleton implementation.
    /// @param safeProxyFactory_ Canonical Safe Proxy Factory.
    /// @param safeFallbackHandler_ Canonical Safe Compatibility Fallback Handler.
    constructor(
        IENSDiamondsRegistrarController controller_,
        IBaseRegistrar baseRegistrar_,
        ISafe safeSingleton_,
        SafeProxyFactory safeProxyFactory_,
        address safeFallbackHandler_
    ) {
        _requireContract(address(controller_));
        _requireContract(address(baseRegistrar_));
        _requireContract(address(safeSingleton_));
        _requireContract(address(safeProxyFactory_));
        _requireContract(safeFallbackHandler_);

        CONTROLLER = controller_;
        BASE_REGISTRAR = baseRegistrar_;
        SAFE_SINGLETON = safeSingleton_;
        SAFE_PROXY_FACTORY = safeProxyFactory_;
        SAFE_FALLBACK_HANDLER = safeFallbackHandler_;

        uint256 minimumAge = controller_.minCommitmentAge();
        uint256 maximumAge = controller_.maxCommitmentAge();
        uint256 minimumDuration = controller_.MIN_REGISTRATION_DURATION();

        if (maximumAge <= minimumAge || minimumDuration > type(uint32).max) {
            revert InvalidDependencyConfiguration();
        }

        MIN_COMMITMENT_AGE = minimumAge;
        MAX_COMMITMENT_AGE = maximumAge;
        MIN_REGISTRATION_DURATION = minimumDuration;

        SAFE_PROXY_INIT_CODE_HASH = keccak256(
            abi.encodePacked(
                safeProxyFactory_.proxyCreationCode(), uint256(uint160(address(safeSingleton_)))
            )
        );
    }

    // -------------------------------------------------------------------------
    // Vault creation and funding
    // -------------------------------------------------------------------------

    /// @notice Creates a vault with an immutable ordered Safe owner roster.
    /// @param maxSpend Maximum ETH the vault may collect and spend.
    /// @param registrationDuration ENS registration duration in seconds.
    /// @param owners Complete ordered Safe owner roster; the creator must be first.
    /// @return vaultId Newly assigned sequential vault identifier.
    function createVault(uint96 maxSpend, uint32 registrationDuration, address[] calldata owners)
        external
        returns (uint256 vaultId)
    {
        if (maxSpend == 0) revert InvalidMaxSpend();
        if (registrationDuration < MIN_REGISTRATION_DURATION) revert InvalidDuration();

        uint256 ownerCount = owners.length;
        if (ownerCount < MIN_MEMBERS || ownerCount > MAX_MEMBERS) {
            revert InvalidOwnerCount();
        }
        if (owners[0] != msg.sender) revert InvalidOwner(owners[0]);

        for (uint256 i; i < ownerCount;) {
            address owner = owners[i];
            if (owner == address(0) || owner == SAFE_SENTINEL || owner == address(this)) {
                revert InvalidOwner(owner);
            }

            for (uint256 j; j < i;) {
                if (owners[j] == owner) revert DuplicateOwner(owner);
                unchecked {
                    ++j;
                }
            }

            unchecked {
                ++i;
            }
        }

        vaultId = vaultCount;
        vaultCount = vaultId + 1;

        Vault storage vault = vaults[vaultId];
        vault.creator = msg.sender;
        vault.maxSpend = maxSpend;
        vault.registrationDuration = registrationDuration;
        vault.state = State.Draft;

        ownersOf[vaultId] = owners;

        emit VaultCreated(vaultId, msg.sender, maxSpend, registrationDuration, owners);
    }

    /// @notice Fixes the target commitments and opens member funding.
    /// @dev Optional ETH is credited as the creator's initial contribution.
    function openFunding(uint256 vaultId, bytes32 targetIntent, bytes32 ensCommitment)
        external
        payable
    {
        Vault storage vault = _vault(vaultId);
        _requireCreator(vault);
        _requireState(vault, State.Draft);

        if (targetIntent == bytes32(0)) revert ZeroTargetIntent();
        if (ensCommitment == bytes32(0)) revert ZeroENSCommitment();
        if (msg.value > vault.maxSpend) revert FundingCapExceeded();

        SafeConfig memory config = _safeConfig(vaultId);
        if (_isMember(vaultId, config.predicted)) {
            revert PredictedSafeIsOwner(config.predicted);
        }

        vault.targetIntent = targetIntent;
        vault.ensCommitment = ensCommitment;
        vault.state = State.Funding;

        if (msg.value != 0) {
            balanceOf[vaultId][msg.sender] = msg.value;
            vault.escrowed = msg.value.toUint96();
            totalLiabilities += msg.value;
        }

        emit FundingOpened(vaultId, targetIntent, ensCommitment, msg.value);
    }

    /// @notice Adds ETH to a funding vault.
    function deposit(uint256 vaultId) external payable {
        Vault storage vault = _vault(vaultId);
        _requireState(vault, State.Funding);

        if (msg.value == 0) revert ZeroAmount();
        if (!_isMember(vaultId, msg.sender)) revert NotMember(msg.sender);

        uint256 updatedEscrow = uint256(vault.escrowed) + msg.value;
        if (updatedEscrow > vault.maxSpend) revert FundingCapExceeded();

        balanceOf[vaultId][msg.sender] += msg.value;
        vault.escrowed = updatedEscrow.toUint96();
        totalLiabilities += msg.value;

        emit Deposited(vaultId, msg.sender, msg.value);
    }

    /// @notice Withdraws part or all of the caller's contribution during funding.
    function withdraw(uint256 vaultId, uint256 amount, address payable recipient)
        external
        nonReentrant
    {
        Vault storage vault = _vault(vaultId);
        _requireState(vault, State.Funding);

        if (amount == 0) revert ZeroAmount();
        if (recipient == address(0)) revert InvalidRecipient();

        uint256 balance = balanceOf[vaultId][msg.sender];
        if (amount > balance) revert InsufficientBalance();

        balanceOf[vaultId][msg.sender] = balance - amount;
        vault.escrowed = (uint256(vault.escrowed) - amount).toUint96();
        totalLiabilities -= amount;

        emit Withdrawn(vaultId, msg.sender, recipient, amount);
        _sendEth(recipient, amount);
    }

    /// @notice Cancels a Draft or Funding vault.
    /// @dev Contributions remain available through pull-based claims.
    function cancel(uint256 vaultId) external {
        Vault storage vault = _vault(vaultId);
        _requireCreator(vault);

        State state = vault.state;
        if (state != State.Draft && state != State.Funding) {
            revert InvalidState(state);
        }

        vault.state = State.Cancelled;
        emit VaultCancelled(vaultId);
    }

    // -------------------------------------------------------------------------
    // Acquisition
    // -------------------------------------------------------------------------

    /// @notice Locks funding and submits or adopts the fixed ENS commitment.
    function beginAcquisition(uint256 vaultId) external nonReentrant {
        Vault storage vault = _vault(vaultId);
        _requireCreator(vault);
        _requireState(vault, State.Funding);

        if (vault.escrowed == 0) revert NoFunding();

        // Effects before the external call prevent cross-function funding changes.
        // Any downstream revert rolls this state transition back.
        vault.state = State.Committed;

        bytes32 commitment = vault.ensCommitment;
        uint256 timestamp = CONTROLLER.commitments(commitment);

        if (timestamp == 0) {
            CONTROLLER.commit(commitment);
            timestamp = CONTROLLER.commitments(commitment);
        } else {
            uint256 expiresAt = timestamp + MAX_COMMITMENT_AGE;

            // ENS commit-reveal validity is explicitly timestamp based.
            // forge-lint: disable-next-line(block-timestamp)
            if (block.timestamp == expiresAt) revert CommitmentAtBoundary();

            // forge-lint: disable-next-line(block-timestamp)
            if (block.timestamp > expiresAt) {
                CONTROLLER.commit(commitment);
                timestamp = CONTROLLER.commitments(commitment);
            }
        }

        if (timestamp == 0) revert CommitmentChanged();

        vault.committedAt = timestamp.toUint40();

        SafeConfig memory config = _safeConfig(vaultId);
        emit AcquisitionCommitted(
            vaultId, commitment, config.predicted, timestamp, config.threshold
        );
    }

    /// @notice Registers the committed name or recognizes an exact copied registration.
    /// @dev Permissionless because every supplied field is bound by the stored commitments.
    function purchase(
        uint256 vaultId,
        string calldata normalizedLabel,
        bytes32 targetSalt,
        bytes32 ensSecret
    ) external nonReentrant {
        Vault storage vault = _vault(vaultId);
        _requireState(vault, State.Committed);

        if (targetSalt == bytes32(0)) revert ZeroTargetSalt();
        if (ensSecret == bytes32(0)) revert ZeroENSSecret();

        // Keep commitment hashing explicit and easy to compare with client code.
        // forge-lint: disable-next-line(asm-keccak256)
        bytes32 labelhash = keccak256(bytes(normalizedLabel));
        // forge-lint: disable-next-line(asm-keccak256)
        bytes32 expectedIntent = keccak256(
            abi.encode(
                TARGET_INTENT_TYPEHASH,
                block.chainid,
                address(this),
                vaultId,
                vault.creator,
                labelhash,
                vault.registrationDuration,
                targetSalt
            )
        );
        if (expectedIntent != vault.targetIntent) revert TargetIntentMismatch();

        SafeConfig memory config = _safeConfig(vaultId);
        IETHRegistrarController.Registration memory registration =
            _registration(vault, normalizedLabel, ensSecret, config.predicted);

        if (CONTROLLER.makeCommitment(registration) != vault.ensCommitment) {
            revert ENSCommitmentMismatch();
        }

        uint256 controllerTimestamp = CONTROLLER.commitments(vault.ensCommitment);
        uint256 storedTimestamp = vault.committedAt;

        if (controllerTimestamp == storedTimestamp) {
            _purchaseCommitted(vaultId, vault, labelhash, registration, config);
            return;
        }

        if (controllerTimestamp == 0) {
            _recoverCopiedPurchase(vaultId, vault, labelhash, config);
            return;
        }

        revert CommitmentChanged();
    }

    /// @notice Materializes an expired commitment as Failed.
    function expireAcquisition(uint256 vaultId) external nonReentrant {
        Vault storage vault = _vault(vaultId);
        _requireState(vault, State.Committed);

        uint256 expiresAt = uint256(vault.committedAt) + MAX_COMMITMENT_AGE;
        // ENS commit-reveal validity is explicitly timestamp based.
        // forge-lint: disable-next-line(block-timestamp)
        if (block.timestamp < expiresAt) revert CommitmentNotExpired(expiresAt);

        vault.state = State.Failed;
        emit AcquisitionExpired(vaultId);
    }

    /// @notice Claims the caller's full refundable balance to a chosen recipient.
    /// @dev An expired Committed vault is failed and claimed in the same transaction.
    function claim(uint256 vaultId, address payable recipient) external nonReentrant {
        Vault storage vault = _vault(vaultId);
        if (recipient == address(0)) revert InvalidRecipient();

        if (vault.state == State.Committed) {
            uint256 expiresAt = uint256(vault.committedAt) + MAX_COMMITMENT_AGE;
            // ENS commit-reveal validity is explicitly timestamp based.
            // forge-lint: disable-next-line(block-timestamp)
            if (block.timestamp < expiresAt) revert InvalidState(State.Committed);

            vault.state = State.Failed;
            emit AcquisitionExpired(vaultId);
        }

        State state = vault.state;
        if (state != State.Acquired && state != State.Cancelled && state != State.Failed) {
            revert InvalidState(state);
        }

        uint256 amount = balanceOf[vaultId][msg.sender];
        if (amount == 0) revert NothingToClaim();

        balanceOf[vaultId][msg.sender] = 0;
        vault.escrowed = (uint256(vault.escrowed) - amount).toUint96();
        totalLiabilities -= amount;

        emit Claimed(vaultId, msg.sender, recipient, amount);
        _sendEth(recipient, amount);
    }

    // -------------------------------------------------------------------------
    // Views
    // -------------------------------------------------------------------------

    /// @notice Predicts the canonical Safe address and initial threshold.
    function predictSafe(uint256 vaultId) external view returns (address safe, uint256 threshold) {
        _vault(vaultId);
        SafeConfig memory config = _safeConfig(vaultId);
        return (config.predicted, config.threshold);
    }

    /// @notice Returns the complete fixed Safe owner roster.
    function getOwners(uint256 vaultId) external view returns (address[] memory owners) {
        _vault(vaultId);
        return ownersOf[vaultId];
    }

    /// @notice Returns whether an account belongs to the fixed owner roster.
    function isMember(uint256 vaultId, address account) external view returns (bool) {
        _vault(vaultId);
        return _isMember(vaultId, account);
    }

    /// @notice Returns unused funding capacity under the immutable spending cap.
    function remainingCapacity(uint256 vaultId) external view returns (uint256) {
        Vault storage vault = _vault(vaultId);
        return uint256(vault.maxSpend) - uint256(vault.escrowed);
    }

    /// @notice Returns Failed for a virtually expired Committed vault.
    function effectiveState(uint256 vaultId) external view returns (State) {
        Vault storage vault = _vault(vaultId);

        if (
            vault.state == State.Committed
                // ENS commit-reveal validity is explicitly timestamp based.
                // forge-lint: disable-next-line(block-timestamp)
                && block.timestamp >= uint256(vault.committedAt) + MAX_COMMITMENT_AGE
        ) {
            return State.Failed;
        }

        return vault.state;
    }

    // -------------------------------------------------------------------------
    // Internal acquisition logic
    // -------------------------------------------------------------------------

    function _purchaseCommitted(
        uint256 vaultId,
        Vault storage vault,
        bytes32 labelhash,
        IETHRegistrarController.Registration memory registration,
        SafeConfig memory config
    ) internal {
        uint256 committedAt = vault.committedAt;
        uint256 validAt = committedAt + MIN_COMMITMENT_AGE;
        uint256 expiresAt = committedAt + MAX_COMMITMENT_AGE;

        // ENS commit-reveal validity is explicitly timestamp based.
        // forge-lint: disable-next-line(block-timestamp)
        if (block.timestamp < validAt) revert CommitmentTooYoung(validAt);
        // forge-lint: disable-next-line(block-timestamp)
        if (block.timestamp >= expiresAt) revert CommitmentExpired(expiresAt);

        IPriceOracle.Price memory quote =
            CONTROLLER.rentPrice(registration.label, registration.duration);
        uint256 price = quote.base + quote.premium;
        uint256 funding = vault.escrowed;
        if (price > funding) revert InsufficientFunding(price, funding);

        _ensureSafe(config);
        CONTROLLER.register{value: price}(registration);

        if (_ownerOf(uint256(labelhash)) != config.predicted) {
            revert ENSOwnershipMismatch();
        }

        uint256 surplus = _settlePurchase(vaultId, vault, funding, price);
        emit NameAcquired(vaultId, labelhash, config.predicted, price, surplus, false);
    }

    function _recoverCopiedPurchase(
        uint256 vaultId,
        Vault storage vault,
        bytes32 labelhash,
        SafeConfig memory config
    ) internal {
        uint256 committedAt = vault.committedAt;
        uint256 expiresAt = committedAt + MAX_COMMITMENT_AGE;
        // ENS commit-reveal validity is explicitly timestamp based.
        // forge-lint: disable-next-line(block-timestamp)
        if (block.timestamp >= expiresAt) revert CommitmentExpired(expiresAt);

        uint256 tokenId = uint256(labelhash);
        if (_ownerOf(tokenId) != config.predicted) revert ENSOwnershipMismatch();

        uint256 nameExpiry = BASE_REGISTRAR.nameExpires(tokenId);
        uint256 minimumExpiry = committedAt + MIN_COMMITMENT_AGE + vault.registrationDuration;
        uint256 maximumExpiry = committedAt + MAX_COMMITMENT_AGE + vault.registrationDuration;

        if (
            // ENS registration expiry is explicitly timestamp based.
            // forge-lint: disable-next-line(block-timestamp)
            nameExpiry <= block.timestamp || nameExpiry < minimumExpiry
                || nameExpiry >= maximumExpiry
        ) {
            revert ENSExpiryMismatch(nameExpiry);
        }

        _ensureSafe(config);
        vault.state = State.Acquired;

        emit NameAcquired(vaultId, labelhash, config.predicted, 0, vault.escrowed, true);
    }

    function _settlePurchase(uint256 vaultId, Vault storage vault, uint256 funding, uint256 price)
        internal
        returns (uint256 surplus)
    {
        surplus = funding - price;

        address[] storage owners = ownersOf[vaultId];
        uint256 ownerCount = owners.length;
        uint256 allocated;
        address lastContributor;

        for (uint256 i; i < ownerCount;) {
            address owner = owners[i];
            uint256 contribution = balanceOf[vaultId][owner];

            if (contribution != 0) {
                lastContributor = owner;
                uint256 refund = contribution * surplus / funding;
                balanceOf[vaultId][owner] = refund;
                allocated += refund;
            }

            unchecked {
                ++i;
            }
        }

        // funding is nonzero, so at least one positive contributor must exist.
        balanceOf[vaultId][lastContributor] += surplus - allocated;

        vault.escrowed = surplus.toUint96();
        vault.state = State.Acquired;
        totalLiabilities -= price;
    }

    // -------------------------------------------------------------------------
    // Internal Safe helpers
    // -------------------------------------------------------------------------

    function _safeConfig(uint256 vaultId) internal view returns (SafeConfig memory config) {
        address[] memory owners = ownersOf[vaultId];
        uint256 threshold = owners.length / 2 + 1;
        uint256 saltNonce =
            uint256(keccak256(abi.encode(SAFE_SALT_DOMAIN, block.chainid, address(this), vaultId)));

        bytes memory initializer = abi.encodeCall(
            ISafe.setup,
            (
                owners,
                threshold,
                address(0),
                bytes(""),
                SAFE_FALLBACK_HANDLER,
                address(0),
                0,
                payable(address(0))
            )
        );

        // Preserve the canonical Safe factory formula verbatim for auditability.
        // forge-lint: disable-next-line(asm-keccak256)
        bytes32 salt = keccak256(abi.encodePacked(keccak256(initializer), saltNonce));
        // forge-lint: disable-next-line(asm-keccak256)
        bytes32 digest = keccak256(
            abi.encodePacked(
                bytes1(0xff), address(SAFE_PROXY_FACTORY), salt, SAFE_PROXY_INIT_CODE_HASH
            )
        );

        // CREATE2 addresses intentionally use the low 160 bits of the digest.
        // forge-lint: disable-next-line(unsafe-typecast)
        address predicted = address(uint160(uint256(digest)));

        config = SafeConfig({
            predicted: predicted,
            threshold: threshold,
            saltNonce: saltNonce,
            initializer: initializer
        });
    }

    function _ensureSafe(SafeConfig memory config) internal {
        if (config.predicted.code.length != 0) return;

        address deployed = address(
            SAFE_PROXY_FACTORY.createProxyWithNonce(
                address(SAFE_SINGLETON), config.initializer, config.saltNonce
            )
        );

        if (deployed != config.predicted) {
            revert SafePredictionMismatch(config.predicted, deployed);
        }
        if (deployed.code.length == 0) revert SafeDeploymentFailed();
    }

    // -------------------------------------------------------------------------
    // Internal validation and utility helpers
    // -------------------------------------------------------------------------

    function _registration(
        Vault storage vault,
        string calldata normalizedLabel,
        bytes32 ensSecret,
        address predictedSafe
    ) internal view returns (IETHRegistrarController.Registration memory) {
        return IETHRegistrarController.Registration({
                label: normalizedLabel,
                owner: predictedSafe,
                duration: vault.registrationDuration,
                secret: ensSecret,
                resolver: address(0),
                data: new bytes[](0),
                reverseRecord: 0,
                referrer: bytes32(0)
            });
    }

    function _ownerOf(uint256 tokenId) internal view returns (address owner) {
        try BASE_REGISTRAR.ownerOf(tokenId) returns (address currentOwner) {
            return currentOwner;
        } catch {
            revert ENSOwnershipMismatch();
        }
    }

    function _isMember(uint256 vaultId, address account) internal view returns (bool) {
        address[] storage owners = ownersOf[vaultId];
        uint256 ownerCount = owners.length;

        for (uint256 i; i < ownerCount;) {
            if (owners[i] == account) return true;
            unchecked {
                ++i;
            }
        }

        return false;
    }

    function _vault(uint256 vaultId) internal view returns (Vault storage vault) {
        if (vaultId >= vaultCount) revert VaultNotFound(vaultId);
        return vaults[vaultId];
    }

    function _requireCreator(Vault storage vault) internal view {
        if (msg.sender != vault.creator) revert Unauthorized();
    }

    function _requireState(Vault storage vault, State expected) internal view {
        if (vault.state != expected) revert InvalidState(vault.state);
    }

    function _requireContract(address dependency) internal view {
        if (dependency == address(0) || dependency.code.length == 0) {
            revert InvalidDependency(dependency);
        }
    }

    function _sendEth(address payable recipient, uint256 amount) internal {
        (bool success,) = recipient.call{value: amount}("");
        if (!success) revert ETHTransferFailed();
    }

    /// @dev Rejects unaccounted direct ETH transfers.
    receive() external payable {
        revert DirectETHNotAccepted();
    }

    /// @dev Rejects unknown calls and direct ETH transfers.
    fallback() external payable {
        revert DirectETHNotAccepted();
    }
}
