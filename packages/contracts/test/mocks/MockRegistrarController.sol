// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {MockBaseRegistrar} from "./MockBaseRegistrar.sol";
import {IETHRegistrarController} from "ens-contracts/ethregistrar/IETHRegistrarController.sol";
import {IPriceOracle} from "ens-contracts/ethregistrar/IPriceOracle.sol";

contract MockRegistrarController {
    error CommitmentNotFound(bytes32 commitment);
    error CommitmentTooNew(
        bytes32 commitment, uint256 minimumCommitmentTimestamp, uint256 currentTimestamp
    );
    error CommitmentTooOld(
        bytes32 commitment, uint256 maximumCommitmentTimestamp, uint256 currentTimestamp
    );
    error DurationTooShort(uint256 duration);
    error ForcedCommitRevert();
    error ForcedRegistrationRevert();
    error ForcedRentPriceRevert();
    error InsufficientValue();
    error NameNotAvailable(string label);
    error ResolverRequiredForReverseRecord();
    error ResolverRequiredWhenDataSupplied();
    error UnexpiredCommitmentExists(bytes32 commitment);

    MockBaseRegistrar public immutable REGISTRAR;

    uint256 internal immutable MINIMUM_COMMITMENT_AGE;
    uint256 internal immutable MAXIMUM_COMMITMENT_AGE;
    uint256 public immutable MIN_REGISTRATION_DURATION;

    mapping(bytes32 commitment => uint256 timestamp) public commitments;
    mapping(uint256 tokenId => bool unavailable) public forcedUnavailable;

    uint256 public basePrice;
    uint256 public premiumPrice;
    uint256 public registerCallCount;
    uint256 public totalRentCollected;
    uint256 public lastValue;
    uint256 public lastDuration;
    address public lastOwner;
    bytes32 public lastCommitment;
    string public lastLabel;

    bool public commitShouldRevert;
    bool public registerShouldRevert;
    bool public rentPriceShouldRevert;
    bool public preserveCommitment;
    bool public skipOwnerUpdate;
    address public registrationOwnerOverride;

    constructor(
        MockBaseRegistrar registrar_,
        uint256 minimumAge_,
        uint256 maximumAge_,
        uint256 minimumDuration_,
        uint256 basePrice_,
        uint256 premiumPrice_
    ) {
        REGISTRAR = registrar_;
        MINIMUM_COMMITMENT_AGE = minimumAge_;
        MAXIMUM_COMMITMENT_AGE = maximumAge_;
        MIN_REGISTRATION_DURATION = minimumDuration_;
        basePrice = basePrice_;
        premiumPrice = premiumPrice_;
    }

    function rentPrice(string calldata, uint256)
        external
        view
        returns (IPriceOracle.Price memory price)
    {
        if (rentPriceShouldRevert) revert ForcedRentPriceRevert();
        return IPriceOracle.Price({base: basePrice, premium: premiumPrice});
    }

    function available(string calldata label) external view returns (bool) {
        uint256 tokenId = uint256(keccak256(bytes(label)));
        return !forcedUnavailable[tokenId] && !REGISTRAR.exists(tokenId);
    }

    function makeCommitment(IETHRegistrarController.Registration calldata registration)
        public
        view
        returns (bytes32 commitment)
    {
        if (registration.data.length != 0 && registration.resolver == address(0)) {
            revert ResolverRequiredWhenDataSupplied();
        }
        if (registration.reverseRecord != 0 && registration.resolver == address(0)) {
            revert ResolverRequiredForReverseRecord();
        }
        if (registration.duration < MIN_REGISTRATION_DURATION) {
            revert DurationTooShort(registration.duration);
        }

        return keccak256(abi.encode(registration));
    }

    function commit(bytes32 commitment) external {
        if (commitShouldRevert) revert ForcedCommitRevert();
        // forge-lint: disable-next-line(block-timestamp)
        if (commitments[commitment] + MAXIMUM_COMMITMENT_AGE >= block.timestamp) {
            revert UnexpiredCommitmentExists(commitment);
        }

        commitments[commitment] = block.timestamp;
    }

    function register(IETHRegistrarController.Registration calldata registration) external payable {
        if (registerShouldRevert) revert ForcedRegistrationRevert();

        uint256 price = basePrice + premiumPrice;
        if (msg.value < price) revert InsufficientValue();

        uint256 tokenId = uint256(keccak256(bytes(registration.label)));
        if (forcedUnavailable[tokenId] || REGISTRAR.exists(tokenId)) {
            revert NameNotAvailable(registration.label);
        }

        bytes32 commitment = makeCommitment(registration);
        uint256 timestamp = commitments[commitment];

        // forge-lint: disable-next-line(block-timestamp)
        if (timestamp + MINIMUM_COMMITMENT_AGE > block.timestamp) {
            revert CommitmentTooNew(commitment, timestamp + MINIMUM_COMMITMENT_AGE, block.timestamp);
        }
        // forge-lint: disable-next-line(block-timestamp)
        if (timestamp + MAXIMUM_COMMITMENT_AGE <= block.timestamp) {
            if (timestamp == 0) revert CommitmentNotFound(commitment);
            revert CommitmentTooOld(commitment, timestamp + MAXIMUM_COMMITMENT_AGE, block.timestamp);
        }

        if (!preserveCommitment) delete commitments[commitment];

        address owner = registrationOwnerOverride == address(0)
            ? registration.owner
            : registrationOwnerOverride;
        if (!skipOwnerUpdate) REGISTRAR.setOwner(tokenId, owner);

        registerCallCount++;
        totalRentCollected += price;
        lastValue = msg.value;
        lastDuration = registration.duration;
        lastOwner = owner;
        lastCommitment = commitment;
        lastLabel = registration.label;
    }

    function setPrice(uint256 basePrice_, uint256 premiumPrice_) external {
        basePrice = basePrice_;
        premiumPrice = premiumPrice_;
    }

    function minCommitmentAge() external view returns (uint256) {
        return MINIMUM_COMMITMENT_AGE;
    }

    function maxCommitmentAge() external view returns (uint256) {
        return MAXIMUM_COMMITMENT_AGE;
    }

    function setCommitment(bytes32 commitment, uint256 timestamp) external {
        commitments[commitment] = timestamp;
    }

    function setUnavailable(uint256 tokenId, bool unavailable) external {
        forcedUnavailable[tokenId] = unavailable;
    }

    function setCommitShouldRevert(bool shouldRevert) external {
        commitShouldRevert = shouldRevert;
    }

    function setRegisterShouldRevert(bool shouldRevert) external {
        registerShouldRevert = shouldRevert;
    }

    function setRentPriceShouldRevert(bool shouldRevert) external {
        rentPriceShouldRevert = shouldRevert;
    }

    function setPreserveCommitment(bool preserve) external {
        preserveCommitment = preserve;
    }

    function setSkipOwnerUpdate(bool skip) external {
        skipOwnerUpdate = skip;
    }

    function setRegistrationOwnerOverride(address owner) external {
        registrationOwnerOverride = owner;
    }
}
