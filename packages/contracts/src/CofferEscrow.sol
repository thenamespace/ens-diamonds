// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ISafeProxyFactory} from "./interfaces/ISafeProxyFactory.sol";
import {ISafe} from "./interfaces/ISafe.sol";

/// @title CofferEscrow
/// @notice Singleton escrow that pools ETH to buy premium ENS names. On
///         finalization it deploys a Safe owned by all contributors and funds it.
///         Immutable by design: no proxy, no admin, no pause, no upgrade path.
contract CofferEscrow {
    // ----------------------------- Types -----------------------------------
    enum PoolStatus {
        Funding,
        Funded,
        Finalized,
        Expired
    }

    struct Pool {
        string label; // plaintext .eth label, e.g. "defi" (no ".eth")
        address creator;
        uint96 targetAmount; // wei
        uint96 totalDeposited; // wei
        uint40 fundingDeadline; // unix ts
        uint40 fundedAt; // set when totalDeposited first hits target; reset to 0 if it later drops below
        uint8 threshold; // Safe threshold, set at creation
        address safe; // zero until finalized
    }

    // --------------------------- Constants ----------------------------------
    uint256 public constant EXECUTION_WINDOW = 7 days;
    uint96 public constant MIN_CONTRIBUTION = 0.01 ether;

    // --------------------------- Immutables ---------------------------------
    address public immutable safeProxyFactory;
    address public immutable safeSingleton;
    address public immutable safeFallbackHandler;

    // ---------------------------- Storage -----------------------------------
    mapping(uint256 => Pool) public pools;
    mapping(uint256 => mapping(address => uint96)) public deposits;
    mapping(uint256 => mapping(address => bool)) public invited;
    mapping(uint256 => address[]) internal contributors;
    uint256 public poolCount;

    uint256 private _locked = 1; // reentrancy guard state

    // ----------------------------- Events -----------------------------------
    event PoolCreated(
        uint256 indexed poolId,
        string label,
        address indexed creator,
        uint96 targetAmount,
        uint40 fundingDeadline,
        uint8 threshold,
        address[] invitees
    );
    event Deposited(uint256 indexed poolId, address indexed member, uint96 amount, uint96 totalDeposited);
    event Withdrawn(uint256 indexed poolId, address indexed member, uint96 amount, uint96 totalDeposited);
    event PoolFunded(uint256 indexed poolId);
    event PoolFinalized(
        uint256 indexed poolId, address indexed safe, address[] contributors, uint8 threshold, uint96 amount
    );

    // ----------------------------- Errors -----------------------------------
    error InvalidTarget();
    error InvalidDeadline();
    error LabelTooShort();
    error InvalidThreshold();
    error DuplicateInvitee();
    error NotInvited();
    error WrongStatus();
    error ZeroValue();
    error BelowMinimum();
    error Overshoot();
    error NoDeposit();
    error WithdrawLocked();
    error NotContributor();
    error BelowThreshold();
    error SafeDeployFailed();
    error TransferFailed();
    error Reentrancy();

    modifier nonReentrant() {
        if (_locked != 1) revert Reentrancy();
        _locked = 2;
        _;
        _locked = 1;
    }

    constructor(address _factory, address _singleton, address _fallbackHandler) {
        safeProxyFactory = _factory;
        safeSingleton = _singleton;
        safeFallbackHandler = _fallbackHandler;
    }

    // ----------------------------- Views ------------------------------------

    /// @notice Derived pool status (never stored). See spec §4.
    function status(uint256 poolId) public view returns (PoolStatus) {
        Pool storage p = pools[poolId];
        if (p.safe != address(0)) return PoolStatus.Finalized;
        if (p.totalDeposited == p.targetAmount) {
            if (block.timestamp <= uint256(p.fundedAt) + EXECUTION_WINDOW) {
                return PoolStatus.Funded;
            }
            return PoolStatus.Funding; // execution lock lapsed → withdrawable again
        }
        if (block.timestamp > p.fundingDeadline) return PoolStatus.Expired;
        return PoolStatus.Funding;
    }

    /// @notice Contributor addresses and their current deposit amounts.
    /// Implemented in the skeleton so test files referencing it always compile.
    function getContributors(uint256 poolId) external view returns (address[] memory addrs, uint96[] memory amounts) {
        addrs = contributors[poolId];
        amounts = new uint96[](addrs.length);
        for (uint256 i = 0; i < addrs.length; i++) {
            amounts[i] = deposits[poolId][addrs[i]];
        }
    }

    function createPool(
        string calldata label,
        uint96 targetAmount,
        uint40 fundingDeadline,
        uint8 threshold,
        address[] calldata invitees
    ) external returns (uint256 poolId) {
        if (targetAmount == 0) revert InvalidTarget();
        if (fundingDeadline <= block.timestamp) revert InvalidDeadline();
        if (bytes(label).length < 3) revert LabelTooShort();
        if (threshold < 1 || threshold > invitees.length + 1) revert InvalidThreshold();

        poolId = poolCount++;
        Pool storage p = pools[poolId];
        p.label = label;
        p.creator = msg.sender;
        p.targetAmount = targetAmount;
        p.fundingDeadline = fundingDeadline;
        p.threshold = threshold;

        invited[poolId][msg.sender] = true; // creator auto-invited

        for (uint256 i = 0; i < invitees.length; i++) {
            address invitee = invitees[i];
            if (invited[poolId][invitee]) revert DuplicateInvitee(); // also catches creator-in-invitees
            invited[poolId][invitee] = true;
        }

        emit PoolCreated(poolId, label, msg.sender, targetAmount, fundingDeadline, threshold, invitees);
    }

    function deposit(uint256 poolId) external payable {
        Pool storage p = pools[poolId];
        if (!invited[poolId][msg.sender]) revert NotInvited();
        if (status(poolId) != PoolStatus.Funding) revert WrongStatus();
        if (msg.value == 0) revert ZeroValue();

        uint96 remaining = p.targetAmount - p.totalDeposited;
        if (msg.value > remaining) revert Overshoot();
        uint96 amount = uint96(msg.value); // safe: msg.value <= remaining <= type(uint96).max

        bool isTopUp = deposits[poolId][msg.sender] > 0;
        bool isExactGap = amount == remaining;
        if (!isTopUp && !isExactGap && amount < MIN_CONTRIBUTION) revert BelowMinimum();

        if (!isTopUp) {
            contributors[poolId].push(msg.sender);
        }
        deposits[poolId][msg.sender] += amount;
        p.totalDeposited += amount;

        if (p.totalDeposited == p.targetAmount) {
            p.fundedAt = uint40(block.timestamp);
            emit PoolFunded(poolId);
        }

        emit Deposited(poolId, msg.sender, amount, p.totalDeposited);
    }

    function withdraw(uint256 poolId) external nonReentrant {
        Pool storage p = pools[poolId];
        PoolStatus s = status(poolId);
        if (s != PoolStatus.Funding && s != PoolStatus.Expired) revert WithdrawLocked();

        uint96 amount = deposits[poolId][msg.sender];
        if (amount == 0) revert NoDeposit();

        // effects
        deposits[poolId][msg.sender] = 0;
        p.totalDeposited -= amount;
        _removeContributor(poolId, msg.sender);
        if (p.totalDeposited < p.targetAmount && p.fundedAt != 0) {
            p.fundedAt = 0;
        }

        emit Withdrawn(poolId, msg.sender, amount, p.totalDeposited);

        // interaction
        (bool ok,) = msg.sender.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }

    function _removeContributor(uint256 poolId, address member) internal {
        address[] storage arr = contributors[poolId];
        uint256 len = arr.length;
        for (uint256 i = 0; i < len; i++) {
            if (arr[i] == member) {
                arr[i] = arr[len - 1];
                arr.pop();
                return;
            }
        }
    }
}
