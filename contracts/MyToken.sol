// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0; 

// Import OpenZeppelin ERC20 contract for standard token functionality
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MyToken
 * @dev A simple ERC-20 token for use in the decentralized marketplace.
 * It's used for staking and payments.
 */
contract MyToken is ERC20 {
    /**
     * @dev Constructor that mints an initial supply of tokens to the deployer.
     * @param initialSupply The total supply of tokens to mint initially.
     */
    constructor(uint256 initialSupply) ERC20("MyToken", "MTK") { // No 'public' keyword needed in 0.8.x
        // Mint the initial supply to the address that deploys this contract
        _mint(msg.sender, initialSupply);
    }
}