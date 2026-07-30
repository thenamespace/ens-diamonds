// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

interface IENSDiamonds {
    enum State {
        Funding,
        Committed,
        Acquired,
        Cancelled,
        Failed
    }

    struct Vault {
        address creator;
        uint96 escrowed;
        uint96 maxSpend;
        uint40 committedAt;
        uint32 registrationDuration;
        State state;
        bytes32 targetIntent;
        bytes32 ensCommitment;
    }

    struct SafeConfig {
        address predicted;
        uint256 threshold;
        uint256 saltNonce;
        bytes initializer;
    }

    event VaultCreated(
        bytes32 indexed vaultId,
        address indexed creator,
        uint96 maxSpend,
        uint32 registrationDuration,
        address[] owners,
        bytes32 targetIntent,
        bytes32 ensCommitment,
        uint256 creatorDeposit
    );
    event Deposited(bytes32 indexed vaultId, address indexed member, uint256 amount);
    event Withdrawn(
        bytes32 indexed vaultId, address indexed member, address indexed recipient, uint256 amount
    );
    event VaultCancelled(bytes32 indexed vaultId);
    event AcquisitionCommitted(
        bytes32 indexed vaultId,
        bytes32 ensCommitment,
        address indexed predictedSafe,
        uint256 committedAt,
        uint256 threshold
    );
    event NameAcquired(
        bytes32 indexed vaultId,
        bytes32 indexed labelhash,
        address indexed safe,
        uint256 protocolPrice,
        uint256 refundableBalance
    );
    event AcquisitionExpired(bytes32 indexed vaultId);
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

    function createVault(
        bytes32 vaultSalt,
        uint96 maxSpend,
        uint32 registrationDuration,
        address[] calldata owners,
        bytes32 targetIntent,
        bytes32 ensCommitment
    ) external payable returns (bytes32 vaultId);

    function deposit(bytes32 vaultId) external payable;

    function withdraw(bytes32 vaultId, uint256 amount, address payable recipient) external;

    function cancel(bytes32 vaultId) external;

    function beginAcquisition(bytes32 vaultId) external;

    function purchase(
        bytes32 vaultId,
        string calldata normalizedLabel,
        bytes32 targetSalt,
        bytes32 ensSecret
    ) external;

    function expireAcquisition(bytes32 vaultId) external;

    function claim(bytes32 vaultId, address payable recipient) external;

    function predictSafe(address creator, bytes32 vaultSalt, address[] calldata owners)
        external
        view
        returns (bytes32 vaultId, address safe, uint256 threshold);

    function getOwners(bytes32 vaultId) external view returns (address[] memory owners);

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
            bytes32 ensCommitment
        );

    function balanceOf(bytes32 vaultId, address member) external view returns (uint256);

    function totalLiabilities() external view returns (uint256);
}
