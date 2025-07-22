from web3 import Web3
import json
import os
import time # Import time for delays

# Connect to Ganache (default address and port)
w3 = Web3(Web3.HTTPProvider('http://127.0.0.1:8545'))

# Set the default account for transactions to the first account provided by Ganache
w3.eth.default_account = w3.eth.accounts[0]
print(f"Connecting to Ganache at http://127.0.0.1:8545...")
if not w3.is_connected():
    print("Error: Not connected to Ganache. Please ensure ganache-cli is running.")
    exit()
print(f"Successfully connected to Ganache. Client version: {w3.client_version}")
print(f"Using deployer account: {w3.eth.default_account}")
print(f"Current block number: {w3.eth.block_number}")
print(f"Chain ID: {w3.eth.chain_id}")

# Function to load compiled contract ABI and Bytecode
def load_contract_artifact(contract_name):
    """
    Loads the ABI from contract_name.json and bytecode from contract_name.bin
    for a given contract from the 'build/' directory.
    """
    abi_path = f'build/{contract_name}.json'
    bytecode_path = f'build/{contract_name}.bin' # Path to the .bin file

    print(f"\n--- Loading Artifacts for {contract_name} ---")
    print(f"Attempting to load ABI from: {abi_path}")
    try:
        with open(abi_path, 'r') as f:
            abi = json.load(f)
        print(f"SUCCESS: Loaded ABI for {contract_name}.")
    except FileNotFoundError:
        print(f"ERROR: ABI file '{abi_path}' not found in build/ directory.")
        print("Please ensure you have compiled your Solidity contracts and renamed the .abi files to .json.")
        exit()
    except json.JSONDecodeError:
        print(f"ERROR: Could not parse JSON from '{abi_path}'. Is it a valid JSON file?")
        exit()

    print(f"Attempting to load Bytecode from: {bytecode_path}")
    try:
        with open(bytecode_path, 'r') as f:
            bytecode = f.read().strip()
        print(f"SUCCESS: Loaded bytecode for {contract_name}.")
    except FileNotFoundError:
        print(f"ERROR: Bytecode file '{bytecode_path}' not found in build/ directory.")
        print("Please ensure you have compiled your Solidity contracts and the .bin files are present and correctly named.")
        exit()
    print(f"--- Finished Loading Artifacts for {contract_name} ---\n")
    return abi, bytecode

def deploy_contract(contract_name, abi, bytecode, *args): # Added contract_name parameter
    """
    Deploys a Solidity contract to the connected blockchain.
    """
    Contract = w3.eth.contract(abi=abi, bytecode=bytecode)
    print(f"Attempting to deploy contract '{contract_name}' with constructor args: {args}") # Use passed contract_name
    try:
        # Build transaction to estimate gas more accurately
        tx_build = Contract.constructor(*args).build_transaction({'from': w3.eth.default_account})
        estimated_gas = w3.eth.estimate_gas(tx_build)
        # Add a buffer to the estimated gas for more reliability
        tx_build['gas'] = estimated_gas + 100000 # Add 100k gas buffer
        print(f"Estimated gas for deployment: {estimated_gas}. Using {tx_build['gas']} gas.")

        tx_hash = w3.eth.send_transaction(tx_build)
        print(f"Deployment transaction sent. Hash: {tx_hash.hex()}")
        print("Waiting for transaction to be mined...")
        tx_receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
        
        if tx_receipt.status == 0:
            print(f"!!! ERROR: Contract deployment transaction reverted. Hash: {tx_hash.hex()}")
            print(f"Transaction receipt: {tx_receipt}")
            # Attempt to get revert reason (Ganache specific)
            try:
                trace = w3.manager.request_blocking("debug_traceTransaction", [tx_hash.hex()])
                if 'returnValue' in trace and trace['returnValue']:
                    revert_data = trace['returnValue']
                    if revert_data.startswith('0x08c379a0'): # Selector for Error(string)
                        revert_reason = bytes.fromhex(revert_data[10:]).decode('utf-8', errors='ignore').strip('\x00')
                        print(f"Ganache Revert Reason: {revert_reason}")
                    else:
                        print(f"Ganache Raw Revert Data: {revert_data}")
                elif 'error' in trace and 'message' in trace['error']:
                    print(f"Ganache Error Message: {trace['error']['message']}")
            except Exception as trace_e:
                print(f"Could not trace transaction for revert reason: {trace_e}")
            raise Exception("Contract deployment failed due to revert.")
        
        contract_address = tx_receipt.contractAddress
        print(f"SUCCESS: Contract deployed at: {contract_address} (Block: {tx_receipt.blockNumber})")
        return w3.eth.contract(address=contract_address, abi=abi)
    except Exception as e:
        print(f"FATAL ERROR: Failed to deploy contract. Details: {e}")
        exit(1) # Exit script on fatal deployment error

def main():
    print("\n--- Starting Full Contract Deployment Process ---")
    
    # 1. Deploy MyToken (ERC-20)
    print("\n[STEP 1/3] Deploying MyToken (ERC-20) contract...")
    token_abi, token_bytecode = load_contract_artifact("MyToken")
    initial_supply = 1_000_000 * (10**18) # 1 Million tokens with 18 decimals
    token_contract = deploy_contract("MyToken", token_abi, token_bytecode, initial_supply) # Pass "MyToken" as name
    print(f"MyToken deployed successfully at: {token_contract.address}")
    print(f"MyToken total supply: {w3.from_wei(token_contract.functions.totalSupply().call(), 'ether')} MTK")
    print(f"Deployer's MTK balance: {w3.from_wei(token_contract.functions.balanceOf(w3.eth.default_account).call(), 'ether')} MTK")
    time.sleep(1) # Small delay for readability

    # 2. Deploy DataReview contract, passing the deployed token's address AND the deployer as owner
    print("\n[STEP 2/3] Deploying DataReview contract...")
    data_review_abi, data_review_bytecode = load_contract_artifact("DataReview")
    # Pass token_contract.address and w3.eth.default_account (deployer) as initial owner for Ownable
    # Note: For OZ 4.x, Ownable's constructor doesn't take _initialOwner. It defaults to msg.sender.
    # We keep the argument in deploy_contract for consistency, but the contract constructor will ignore it.
    data_review_contract = deploy_contract("DataReview", data_review_abi, data_review_bytecode, token_contract.address, w3.eth.default_account) # Pass "DataReview"
    print(f"DataReview deployed successfully at: {data_review_contract.address}")
    print(f"DataReview owner: {data_review_contract.functions.owner().call()}")
    time.sleep(1)

    # 3. Deploy DataBundle contract, passing the deployed token's address AND the deployer as owner
    print("\n[STEP 3/3] Deploying DataBundle contract...")
    data_bundle_abi, data_bundle_bytecode = load_contract_artifact("DataBundle")
    # Pass token_contract.address and w3.eth.default_account (deployer) as initial owner for Ownable
    # Note: For OZ 4.x, Ownable's constructor doesn't take _initialOwner. It defaults to msg.sender.
    data_bundle_contract = deploy_contract("DataBundle", data_bundle_abi, data_bundle_bytecode, token_contract.address, w3.eth.default_account) # Pass "DataBundle"
    print(f"DataBundle deployed successfully at: {data_bundle_contract.address}")
    print(f"DataBundle owner: {data_bundle_contract.functions.owner().call()}")
    time.sleep(1)

    print("\n--- All Contracts Deployed Successfully! ---")
    print(f"MyToken Address:    {token_contract.address}")
    print(f"DataReview Address: {data_review_contract.address}")
    print(f"DataBundle Address: {data_bundle_contract.address}")

    # Save deployed contract addresses to a JSON file for easy access by other scripts
    contract_addresses = {
        'MyToken': token_contract.address,
        'DataReview': data_review_contract.address,
        'DataBundle': data_bundle_contract.address
    }
    with open('contract_addresses.json', 'w') as f:
        json.dump(contract_addresses, f, indent=4)
    print("\nContract addresses saved to contract_addresses.json for future interactions.")
    print("Deployment process finished.")

if __name__ == "__main__":
    main()