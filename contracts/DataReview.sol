// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0; // Keep pragma at ^0.8.0

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol"; // Path for OZ 4.x

/**
 * @title DataReview
 * @dev Implements a decentralized staked review and reputation system for datasets.
 * Data providers stake tokens when submitting datasets, and reviewers stake
 * tokens to be eligible to submit reviews.
 */
contract DataReview is Ownable {
    // Struct to represent a dataset submitted for review
    struct Dataset {
        uint256 id;                 // Unique ID of the dataset
        address owner;              // Address of the data provider
        string metadataURI;         // URI pointing to off-chain metadata (e.g., IPFS CID)
        uint256 stakeAmount;        // Amount of tokens staked by the data provider
        bool reviewed;              // True if the dataset has been sufficiently reviewed
        uint256 totalReviewScore;   // Sum of all review scores received
        uint256 numReviews;         // Number of reviews received
        bool stakeReleased;         // Flag to prevent double release of stake
    }

    // Struct to represent a reviewer
    struct Reviewer {
        address addr;           // Address of the reviewer
        uint256 reputation;     // Simple reputation score (can be expanded)
        bool exists;            // Flag to check if reviewer struct is initialized
    }

    mapping(uint256 => Dataset) public datasets;
    uint256 public nextDatasetId;

    mapping(address => Reviewer) public reviewers;
    mapping(address => uint256) public reviewerStake;

    IERC20 public token; // Using IERC20 as in OZ 4.x

    // Events to log important actions
    event DatasetSubmitted(uint256 indexed datasetId, address indexed owner, string metadataURI, uint256 stakeAmount);
    event ReviewerStaked(address indexed reviewer, uint256 amount);
    event ReviewSubmitted(uint256 indexed datasetId, address indexed reviewer, uint256 score);
    event ReputationUpdated(address indexed reviewer, uint256 newReputation);
    event DatasetReviewed(uint256 indexed datasetId, uint256 finalScore, uint256 numReviews);
    event DatasetStakeReleased(uint256 indexed datasetId, address indexed owner, uint256 amount);
    event ReviewerStakeWithdrawn(address indexed reviewer, uint256 amount);
    event DisputeResolved(uint256 indexed datasetId, bool isLegit);


    /**
     * @dev Constructor for the DataReview contract.
     * @param _tokenAddress The address of the ERC20 token contract used for staking.
     * Note: The contract owner is set to the deployer (msg.sender) by Ownable().
     */
    constructor(address _tokenAddress, address /*_initialOwner*/) Ownable() { // Corrected: Commented out _initialOwner variable name
        token = IERC20(_tokenAddress);
        nextDatasetId = 1;
    }

    receive() external payable {} // receive() syntax for Solidity 0.8.x

    function submitDataset(string memory _metadataURI, uint256 _stakeAmount) public {
        require(_stakeAmount > 0, "DR: Stake amount must be greater than zero.");
        require(token.transferFrom(msg.sender, address(this), _stakeAmount), "DR: Token transfer failed for stake. Check allowance or balance.");

        datasets[nextDatasetId] = Dataset({
            id: nextDatasetId,
            owner: msg.sender,
            metadataURI: _metadataURI,
            stakeAmount: _stakeAmount,
            reviewed: false,
            totalReviewScore: 0,
            numReviews: 0,
            stakeReleased: false
        });

        emit DatasetSubmitted(nextDatasetId, msg.sender, _metadataURI, _stakeAmount);
        nextDatasetId++;
    }

    function stakeForReview(uint256 _amount) public {
        require(_amount > 0, "DR: Stake amount must be greater than zero.");
        require(token.transferFrom(msg.sender, address(this), _amount), "DR: Token transfer failed for reviewer stake. Check allowance or balance.");

        if (!reviewers[msg.sender].exists) {
            reviewers[msg.sender].addr = msg.sender;
            reviewers[msg.sender].exists = true;
        }
        reviewerStake[msg.sender] += _amount;

        emit ReviewerStaked(msg.sender, _amount);
    }

    function withdrawReviewerStake() public {
        uint256 amount = reviewerStake[msg.sender];
        require(amount > 0, "DR: No stake to withdraw.");
        reviewerStake[msg.sender] = 0;
        require(token.transfer(msg.sender, amount), "DR: Failed to transfer stake back to reviewer.");
        emit ReviewerStakeWithdrawn(msg.sender, amount);
    }

    function submitReview(uint256 _datasetId, uint256 _score) public {
        require(datasets[_datasetId].owner != address(0), "DR: Dataset does not exist.");
        require(reviewerStake[msg.sender] > 0, "DR: Reviewer has no stake or is not eligible.");
        require(_score >= 0 && _score <= 100, "DR: Score must be between 0 and 100.");

        Dataset storage dataset = datasets[_datasetId];
        require(!dataset.reviewed, "DR: Dataset already reviewed.");

        dataset.totalReviewScore += _score;
        dataset.numReviews++;

        if (!reviewers[msg.sender].exists) {
            reviewers[msg.sender].addr = msg.sender;
            reviewers[msg.sender].exists = true;
        }
        reviewers[msg.sender].reputation += _score;
        emit ReviewSubmitted(_datasetId, msg.sender, _score);
        emit ReputationUpdated(msg.sender, reviewers[msg.sender].reputation);

        if (dataset.numReviews >= 3) {
            dataset.reviewed = true;
            uint256 finalAvgScore = dataset.totalReviewScore / dataset.numReviews;
            emit DatasetReviewed(_datasetId, finalAvgScore, dataset.numReviews);

            if (!dataset.stakeReleased) {
                releaseDatasetStake(dataset.id);
            }
        }
    }

    function releaseDatasetStake(uint256 _datasetId) public {
        Dataset storage dataset = datasets[_datasetId];
        require(dataset.owner != address(0), "DR: Dataset does not exist.");
        require(!dataset.stakeReleased, "DR: Dataset stake already released.");
        require(msg.sender == dataset.owner || msg.sender == owner() || dataset.reviewed, "DR: Not authorized to release stake or dataset not reviewed.");

        dataset.stakeReleased = true;
        require(token.transfer(dataset.owner, dataset.stakeAmount), "DR: Failed to transfer dataset stake back to owner.");
        emit DatasetStakeReleased(_datasetId, dataset.owner, dataset.stakeAmount);
    }

    function getReviewerReputation(address _reviewer) public view returns (uint256) {
        return reviewers[_reviewer].reputation;
    }

    function resolveDispute(uint256 _datasetId, bool _isLegit) public onlyOwner {
        Dataset storage dataset = datasets[_datasetId];
        require(dataset.owner != address(0), "DR: Dataset does not exist.");
        require(!dataset.stakeReleased, "DR: Dataset stake already released or slashed.");

        if (_isLegit) {
            releaseDatasetStake(_datasetId);
        } else {
            dataset.stakeReleased = true;
            // token.transfer(communityFundAddress, dataset.stakeAmount); // Example slashing
        }
        emit DisputeResolved(_datasetId, _isLegit);
    }
}