// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

/// @title ENS Diamonds shared acquisition protocol
/// @notice Coordinates ETH funding, ENS registration, and deterministic Safe ownership for a
/// fixed group of members.
interface IENSDiamonds {
    /// @notice Lifecycle of a vault and its single acquisition attempt.
    enum State {
        Funding,
        Committed,
        Acquired,
        Cancelled,
        Failed
    }

    /// @notice Persistent configuration and accounting for one vault.
    /// @param creator Address allowed to cancel funding or begin acquisition.
    /// @param escrowed ETH currently owed to the vault and its members.
    /// @param maxSpend Maximum ETH the vault may collect and spend.
    /// @param committedAt ENS Controller timestamp adopted for the acquisition attempt.
    /// @param registrationDuration ENS registration duration in seconds.
    /// @param state Current vault lifecycle state.
    /// @param targetIntent Commitment to the private normalized label and target salt.
    /// @param ensCommitment Commitment accepted by the ENS Controller.
    /// @param vaultURI URI resolving to immutable public vault metadata.
    struct Vault {
        address creator;
        uint96 escrowed;
        uint96 maxSpend;
        uint40 committedAt;
        uint32 registrationDuration;
        State state;
        bytes32 targetIntent;
        bytes32 ensCommitment;
        string vaultURI;
    }

    /// @notice Deterministic Safe deployment values derived from a vault and its owners.
    /// @param predicted Address at which the Safe is or will be deployed.
    /// @param threshold Strict-majority Safe signature threshold.
    /// @param saltNonce Nonce passed to the Safe proxy factory.
    /// @param initializer Encoded Safe setup call.
    struct SafeConfig {
        address predicted;
        uint256 threshold;
        uint256 saltNonce;
        bytes initializer;
    }

    /// @notice Emitted when a vault is created and enters the funding state.
    event VaultCreated(
        bytes32 indexed vaultId,
        address indexed creator,
        uint96 maxSpend,
        uint32 registrationDuration,
        address[] owners,
        bytes32 targetIntent,
        bytes32 ensCommitment,
        string vaultURI,
        uint256 creatorDeposit
    );
    /// @notice Emitted when a member adds ETH to a funding vault.
    event Deposited(bytes32 indexed vaultId, address indexed member, uint256 amount);
    /// @notice Emitted when a member withdraws ETH while the vault is funding.
    event Withdrawn(
        bytes32 indexed vaultId, address indexed member, address indexed recipient, uint256 amount
    );
    /// @notice Emitted when the creator cancels a funding vault.
    event VaultCancelled(bytes32 indexed vaultId);
    /// @notice Emitted when funding is locked and the ENS commitment window begins.
    event AcquisitionCommitted(
        bytes32 indexed vaultId,
        bytes32 ensCommitment,
        address indexed predictedSafe,
        uint256 committedAt,
        uint256 threshold
    );
    /// @notice Emitted after the name is registered to the deterministic Safe.
    event NameAcquired(
        bytes32 indexed vaultId,
        bytes32 indexed labelhash,
        address indexed safe,
        uint256 protocolPrice,
        uint256 refundableBalance
    );
    /// @notice Emitted when an acquisition reaches its terminal expiry without purchase.
    event AcquisitionExpired(bytes32 indexed vaultId);
    /// @notice Emitted when a member claims their terminal-state balance.
    event Claimed(
        bytes32 indexed vaultId, address indexed member, address indexed recipient, uint256 amount
    );

    error InvalidContract(address dependency);
    error InvalidConfiguration();
    error InvalidAddress();
    error InvalidOwners();
    error InvalidAmount();
    error VaultNotFound();
    error VaultAlreadyExists();
    error Unauthorized();
    error InvalidState(State current);
    error NotMember();
    error FundingLimitExceeded();
    error InsufficientBalance();
    error TargetMismatch();
    error CommitmentMismatch();
    error CommitmentAtBoundary();
    error CommitmentTooYoung(uint256 validAt);
    error CommitmentExpired(uint256 expiredAt);
    error CommitmentNotExpired(uint256 expiresAt);
    error CommitmentChanged();
    error InsufficientFunding(uint256 price, uint256 escrowed);
    error SafeVerificationFailed();
    error ENSVerificationFailed();
    error NothingToClaim();
    error ETHTransferFailed();
    error DirectETHNotAccepted();

    /// @notice Creates a funding vault with immutable owners and acquisition configuration.
    /// @dev The creator must be the first owner. Any attached ETH becomes the creator's deposit.
    /// @param vaultSalt Nonzero creator-chosen salt used to derive the vault identifier.
    /// @param maxSpend Maximum ETH the vault may collect and spend.
    /// @param registrationDuration ENS registration duration in seconds.
    /// @param owners Ordered Safe owner list containing 2 to 10 unique addresses.
    /// @param targetIntent Commitment to the normalized label and target salt.
    /// @param ensCommitment Commitment produced for the exact ENS registration request.
    /// @param vaultUri_ URI resolving to public metadata that describes the vault.
    /// @return vaultId Deterministic identifier of the created vault.
    function createVault(
        bytes32 vaultSalt,
        uint96 maxSpend,
        uint32 registrationDuration,
        address[] calldata owners,
        bytes32 targetIntent,
        bytes32 ensCommitment,
        string calldata vaultUri_
    ) external payable returns (bytes32 vaultId);

    /// @notice Deposits ETH into a funding vault on behalf of the caller.
    /// @param vaultId Vault receiving the deposit.
    function deposit(bytes32 vaultId) external payable;

    /// @notice Withdraws part of the caller's deposit while the vault is funding.
    /// @param vaultId Vault from which the deposit is withdrawn.
    /// @param amount Amount of ETH to withdraw.
    /// @param recipient Address receiving the ETH.
    function withdraw(bytes32 vaultId, uint256 amount, address payable recipient) external;

    /// @notice Cancels a funding vault and enables member claims.
    /// @dev Only the vault creator may cancel.
    /// @param vaultId Vault to cancel.
    function cancel(bytes32 vaultId) external;

    /// @notice Locks funding and creates, adopts, or refreshes the configured ENS commitment.
    /// @dev Only the vault creator may begin the vault's single acquisition attempt.
    /// @param vaultId Vault entering the committed state.
    function beginAcquisition(bytes32 vaultId) external;

    /// @notice Registers the revealed label to the vault's deterministic Safe.
    /// @dev Callable by anyone with the reveal values during the valid ENS commitment window.
    /// @param vaultId Vault funding the registration.
    /// @param normalizedLabel ENSIP-15 normalized label without the `.eth` suffix.
    /// @param targetSalt Salt used in the vault's target intent.
    /// @param ensSecret Secret used in the ENS Controller commitment.
    function purchase(
        bytes32 vaultId,
        string calldata normalizedLabel,
        bytes32 targetSalt,
        bytes32 ensSecret
    ) external;

    /// @notice Marks an expired acquisition as failed and enables member claims.
    /// @param vaultId Vault whose ENS commitment window has expired.
    function expireAcquisition(bytes32 vaultId) external;

    /// @notice Claims the caller's balance after acquisition, cancellation, or failure.
    /// @dev Also marks an expired committed vault as failed before paying the claim.
    /// @param vaultId Terminal vault holding the caller's balance.
    /// @param recipient Address receiving the ETH.
    function claim(bytes32 vaultId, address payable recipient) external;

    /// @notice Predicts the vault identifier, Safe address, and threshold before creation.
    /// @param creator Future vault creator, which must be the first owner.
    /// @param vaultSalt Nonzero creator-chosen vault salt.
    /// @param owners Ordered Safe owner list.
    /// @return vaultId Deterministic vault identifier.
    /// @return safe Deterministic Safe proxy address.
    /// @return threshold Strict-majority Safe signature threshold.
    function predictSafe(address creator, bytes32 vaultSalt, address[] calldata owners)
        external
        view
        returns (bytes32 vaultId, address safe, uint256 threshold);

    /// @notice Returns the immutable ordered owner list for a vault.
    /// @param vaultId Vault to query.
    /// @return owners Ordered Safe owner list.
    function getOwners(bytes32 vaultId) external view returns (address[] memory owners);

    /// @notice Returns the stored configuration and lifecycle data for a vault.
    function vaults(bytes32 vaultId)
        external
        view
        returns (
            address creator,
            uint96 escrowed,
            uint96 maxSpend,
            uint40 committedAt,
            uint32 registrationDuration,
            State state,
            bytes32 targetIntent,
            bytes32 ensCommitment,
            string memory vaultURI
        );

    /// @notice Returns the ETH owed to a member by a vault.
    function balanceOf(bytes32 vaultId, address member) external view returns (uint256);

    /// @notice Returns the total ETH owed across all vaults.
    function totalLiabilities() external view returns (uint256);
}
