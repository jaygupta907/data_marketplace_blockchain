// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0; 

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol"; 
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title DataBundle
 * @dev Manages the creation, purchase, and revenue distribution for composable data bundles.
 * Each bundle is represented as an ERC-721 NFT.
 */
contract DataBundle is ERC721, Ownable {
    // Struct to represent a data bundle
    struct Bundle {
        uint256 id;                 // Unique ID of the bundle (also its NFT ID)
        string name;                // Name of the bundle
        uint256 price;              // Price of the bundle in payment tokens
        uint256[] datasetIds;       // Array of IDs of constituent datasets
        mapping(uint256 => uint256) datasetWeights; // Weight for each dataset in revenue sharing
        uint256 totalWeight;        // Sum of all weights in the bundle
    }

    mapping(uint256 => Bundle) public bundles;
    uint256 public nextBundleId;

    mapping(uint256 => address) public datasetIdToOwner; // Maps dataset ID to its original owner

    IERC20 public paymentToken;

    // Events to log important actions
    event BundleCreated(uint256 indexed bundleId, string name, uint256 price);
    event DatasetAddedToBundle(uint256 indexed bundleId, uint256 indexed datasetId, uint256 weight);
    event BundlePurchased(uint256 indexed bundleId, address indexed buyer, uint256 amountPaid);
    event RevenueDistributed(uint256 indexed bundleId, uint256 indexed datasetId, address indexed recipient, uint256 amount);

    /**
     * @dev Constructor for the DataBundle contract.
     * @param _paymentTokenAddress The address of the ERC20 token contract used for payments.
     * Note: The contract owner is set to the deployer (msg.sender) by Ownable().
     */
    constructor(address _paymentTokenAddress, address /*_initialOwner*/) // Corrected: Commented out _initialOwner variable name
        ERC721("DataBundle", "DBUNDLE") // ERC721 constructor takes name and symbol
        Ownable() // Ownable() in OZ 4.x takes no args
    {
        paymentToken = IERC20(_paymentTokenAddress);
        nextBundleId = 1;
    }

    /**
     * @dev Allows the contract owner to create a new data bundle.
     * @param _name The name of the new bundle.
     * @param _price The price of the bundle in payment tokens.
     * @return The ID of the newly created bundle.
     */
    function createBundle(string memory _name, uint256 _price) public onlyOwner returns (uint256) {
        require(bytes(_name).length > 0, "DB: Bundle name cannot be empty.");
        require(_price > 0, "DB: Bundle price must be greater than zero.");

        uint256 bundleId = nextBundleId++;
        bundles[bundleId].id = bundleId;
        bundles[bundleId].name = _name;
        bundles[bundleId].price = _price;
        emit BundleCreated(bundleId, _name, _price);
        return bundleId;
    }

    /**
     * @dev Allows the contract owner to add a dataset to an existing bundle.
     * @param _bundleId The ID of the bundle to add the dataset to.
     * @param _datasetId The ID of the dataset to add.
     * @param _weight The weight of this dataset for revenue sharing (e.g., 70 for 70%).
     * @param _datasetOwner The address of the original owner of this dataset.
     */
    function addDatasetToBundle(uint256 _bundleId, uint256 _datasetId, uint256 _weight, address _datasetOwner) public onlyOwner {
        Bundle storage bundle = bundles[_bundleId];
        require(bundle.id != 0, "DB: Bundle does not exist.");
        require(_weight > 0, "DB: Weight must be greater than zero.");
        require(_datasetOwner != address(0), "DB: Dataset owner cannot be zero address.");

        // Prevent adding the same dataset multiple times to the same bundle
        for (uint256 i = 0; i < bundle.datasetIds.length; i++) {
            require(bundle.datasetIds[i] != _datasetId, "DB: Dataset already in bundle.");
        }

        bundle.datasetIds.push(_datasetId);
        bundle.datasetWeights[_datasetId] = _weight;
        bundle.totalWeight += _weight;
        datasetIdToOwner[_datasetId] = _datasetOwner; // Store owner for revenue distribution

        emit DatasetAddedToBundle(_bundleId, _datasetId, _weight);
    }

    /**
     * @dev Returns the list of dataset IDs and their weights for a given bundle.
     * This is a helper function for the UI to fetch bundle details.
     * @param _bundleId The ID of the bundle.
     * @return An array of dataset IDs and an array of their corresponding weights.
     */
    function getBundleDatasets(uint256 _bundleId) public view returns (uint256[] memory, uint256[] memory) {
        Bundle storage bundle = bundles[_bundleId];
        require(bundle.id != 0, "DB: Bundle does not exist.");

        uint256[] memory ids = new uint256[](bundle.datasetIds.length);
        uint256[] memory weights = new uint256[](bundle.datasetIds.length);

        for (uint256 i = 0; i < bundle.datasetIds.length; i++) {
            ids[i] = bundle.datasetIds[i];
            weights[i] = bundle.datasetWeights[bundle.datasetIds[i]];
        }
        return (ids, weights);
    }


    /**
     * @dev Allows a buyer to purchase a data bundle.
     * The buyer must approve the DataBundle contract to spend the required payment tokens.
     * Upon successful purchase, the bundle NFT is minted to the buyer, and
     * revenue is automatically distributed to constituent dataset owners.
     * @param _bundleId The ID of the bundle to purchase.
     */
    function buyBundle(uint256 _bundleId) public {
        Bundle storage bundle = bundles[_bundleId];
        require(bundle.id != 0, "DB: Bundle does not exist.");
        require(bundle.price > 0, "DB: Bundle price is zero.");
        require(bundle.totalWeight > 0, "DB: Bundle contains no datasets or total weight is zero.");

        require(paymentToken.transferFrom(msg.sender, address(this), bundle.price), "DB: Payment failed. Check allowance or balance.");

        _mint(msg.sender, _bundleId); // Mint the bundle NFT to the buyer

        _distributeRevenue(_bundleId, bundle.price);

        emit BundlePurchased(_bundleId, msg.sender, bundle.price);
    }

    /**
     * @dev Internal function to distribute revenue from a bundle purchase.
     * Revenue is distributed proportionally based on dataset weights.
     * @param _bundleId The ID of the bundle from which revenue is distributed.
     * @param _totalRevenue The total revenue received for this bundle purchase.
     */
    function _distributeRevenue(uint256 _bundleId, uint256 _totalRevenue) internal {
        Bundle storage bundle = bundles[_bundleId];
        require(bundle.totalWeight > 0, "DB: No datasets in bundle or total weight is zero for revenue distribution.");

        for (uint256 i = 0; i < bundle.datasetIds.length; i++) {
            uint256 datasetId = bundle.datasetIds[i];
            uint256 weight = bundle.datasetWeights[datasetId];
            address recipient = datasetIdToOwner[datasetId];

            uint256 amountToDistribute = (_totalRevenue * weight) / bundle.totalWeight;

            if (recipient != address(0) && amountToDistribute > 0) {
                require(paymentToken.transfer(recipient, amountToDistribute), "DB: Failed to distribute revenue to dataset owner.");
                emit RevenueDistributed(_bundleId, datasetId, recipient, amountToDistribute);
            }
        }
    }
}