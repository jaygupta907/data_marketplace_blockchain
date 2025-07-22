// Helper function to convert Wei to Ether (assuming 18 decimals)
const toEther = (wei) => {
    if (typeof wei !== 'number' && typeof wei !== 'string') return 'N/A';
    return (Number(wei) / (10**18)).toFixed(2);
};

// Helper function to convert Ether to Wei (assuming 18 decimals)
const toWei = (ether) => {
    if (typeof ether !== 'number' && typeof ether !== 'string') return 0;
    return Math.round(Number(ether) * (10**18));
};

// --- Simulated Blockchain State ---
let initialState = {
// Ganache accounts (simulated addresses)
    accounts: {
        deployer: '0xDeployerAccountAddress00000000000000000000',
        dataOwner: '0xDataOwnerAccountAddress00000000000000000000',
        reviewer1: '0xReviewer1AccountAddress00000000000000000000',
        reviewer2: '0xReviewer2AccountAddress00000000000000000000',
        dataBuyer: '0xDataBuyerAccountAddress00000000000000000000',
        dummyDatasetOwner: '0xDummyOwnerAccountAddress00000000000000000000',
    },
    // MyToken contract (simulated balances)
    myToken: {
        totalSupply: toWei(1000000), // 1 Million MTK
        balances: {}, // Will be populated dynamically
    },
    // DataReview contract (simulated state)
    dataReview: {
        nextDatasetId: 1,
        datasets: {}, // {id: {owner, metadataURI, stakeAmount, reviewed, totalReviewScore, numReviews, stakeReleased}}
        reviewers: {}, // {address: {addr, reputation, exists}}
        reviewerStake: {}, // {address: amount}
    },
    // DataBundle contract (simulated state)
    dataBundle: {
        nextBundleId: 1,
        bundles: {}, // {id: {id, name, price, datasetIds: [], datasetWeights: {}, totalWeight, nftOwner}}
        datasetIdToOwner: {}, // {datasetId: ownerAddress}
    },
    // Contract addresses (simulated)
    contractAddresses: {
        MyToken: '0xMyTokenContractAddress00000000000000000000',
        DataReview: '0xDataReviewContractAddress00000000000000000000',
        DataBundle: '0xDataBundleContractAddress00000000000000000000',
    }
};

let currentState = {};
let simulationLog = [];
let currentStepIndex = 0;
let isSimulationRunning = false;

// --- UI Elements ---
const accountsDisplay = document.getElementById('accountsDisplay');
const datasetsDisplayBody = document.querySelector('#datasetsDisplay tbody');
const noDatasetsMessage = document.getElementById('noDatasetsMessage');
const reviewersDisplayBody = document.querySelector('#reviewersDisplay tbody');
const noReviewersMessage = document.getElementById('noReviewersMessage');
const bundlesDisplayBody = document.querySelector('#bundlesDisplay tbody');
const noBundlesMessage = document.getElementById('noBundlesMessage');
const bundleDatasetsDisplay = document.getElementById('bundleDatasetsDisplay');
const logArea = document.getElementById('logArea');
const startButton = document.getElementById('startButton');
const nextStepButton = document.getElementById('nextStepButton');
const resetButton = document.getElementById('resetButton');
const simulationStatus = document.getElementById('simulationStatus');

// --- Rendering Functions ---

function renderAccounts() {
    accountsDisplay.innerHTML = '';
    for (const role in currentState.accounts) {
        const address = currentState.accounts[role];
        const balance = currentState.myToken.balances[address] || 0;
        const div = document.createElement('div');
        div.className = 'account-item';
        div.innerHTML = `
            <strong>${role.replace(/([A-Z])/g, ' $1').trim()}:</strong>
            <span>${toEther(balance)} MTK</span>
            <small class="text-gray-500 text-xs">${address.substring(0, 6)}...${address.substring(address.length - 4)}</small>
        `;
        accountsDisplay.appendChild(div);
    }
}

function renderDatasets() {
    datasetsDisplayBody.innerHTML = '';
    const datasets = Object.values(currentState.dataReview.datasets);
    if (datasets.length === 0) {
        noDatasetsMessage.classList.remove('hidden');
    } else {
        noDatasetsMessage.classList.add('hidden');
        datasets.forEach(dataset => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${dataset.id}</td>
                <td>${dataset.owner.substring(0, 6)}...${dataset.owner.substring(dataset.owner.length - 4)}</td>
                <td>${toEther(dataset.stakeAmount)} MTK</td>
                <td>${dataset.reviewed ? '✅ Yes' : '❌ No'}</td>
                <td>${dataset.numReviews}</td>
                <td>${dataset.numReviews > 0 ? (dataset.totalReviewScore / dataset.numReviews).toFixed(1) : 'N/A'}</td>
                <td>${dataset.stakeReleased ? '✅ Yes' : '❌ No'}</td>
            `;
            datasetsDisplayBody.appendChild(tr);
        });
    }
}

function renderReviewers() {
    reviewersDisplayBody.innerHTML = '';
    const reviewers = Object.values(currentState.dataReview.reviewers).filter(r => r.exists);
    if (reviewers.length === 0) {
        noReviewersMessage.classList.remove('hidden');
    } else {
        noReviewersMessage.classList.add('hidden');
        reviewers.forEach(reviewer => {
            const stake = currentState.dataReview.reviewerStake[reviewer.addr] || 0;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${reviewer.addr.substring(0, 6)}...${reviewer.addr.substring(reviewer.addr.length - 4)}</td>
                <td>${reviewer.reputation}</td>
                <td>${toEther(stake)} MTK</td>
            `;
            reviewersDisplayBody.appendChild(tr);
        });
    }
}

function renderBundles() {
    bundlesDisplayBody.innerHTML = '';
    const bundles = Object.values(currentState.dataBundle.bundles);
    if (bundles.length === 0) {
        noBundlesMessage.classList.remove('hidden');
    } else {
        noBundlesMessage.classList.add('hidden');
        bundles.forEach(bundle => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${bundle.id}</td>
                <td>${bundle.name}</td>
                <td>${toEther(bundle.price)}</td>
                <td>${bundle.totalWeight}</td>
                <td>${bundle.nftOwner ? bundle.nftOwner.substring(0, 6) + '...' + bundle.nftOwner.substring(bundle.nftOwner.length - 4) : 'N/A'}</td>
            `;
            tr.style.cursor = 'pointer';
            tr.classList.add('hover:bg-blue-50');
            tr.onclick = () => renderBundleDatasetsDetail(bundle.id);
            bundlesDisplayBody.appendChild(tr);
        });
    }
    // Clear detailed bundle view when bundles are re-rendered
    bundleDatasetsDisplay.innerHTML = '<p class="text-gray-600 mt-4 text-center">Select a bundle above to see its constituent datasets.</p>';
}

function renderBundleDatasetsDetail(bundleId) {
    const bundle = currentState.dataBundle.bundles[bundleId];
    if (!bundle) {
        bundleDatasetsDisplay.innerHTML = `<p class="text-red-500 mt-4 text-center">Bundle ${bundleId} not found.</p>`;
        return;
    }

    let detailHtml = `
        <h3 class="mt-4">Details for Bundle ID: ${bundle.id} - "${bundle.name}"</h3>
        <table class="mt-2">
            <thead>
                <tr>
                    <th>Dataset ID</th>
                    <th>Weight</th>
                    <th>Original Owner</th>
                </tr>
            </thead>
            <tbody>
    `;
    if (bundle.datasetIds.length === 0) {
        detailHtml += `<tr><td colspan="3" class="text-center text-gray-500">No datasets added to this bundle yet.</td></tr>`;
    } else {
        bundle.datasetIds.forEach(datasetId => {
            const weight = bundle.datasetWeights[datasetId];
            const owner = currentState.dataBundle.datasetIdToOwner[datasetId] || 'Unknown';
            detailHtml += `
                <tr>
                    <td>${datasetId}</td>
                    <td>${weight}</td>
                    <td>${owner.substring(0, 6)}...${owner.substring(owner.length - 4)}</td>
                </tr>
            `;
        });
    }
    detailHtml += `
            </tbody>
        </table>
    `;
    bundleDatasetsDisplay.innerHTML = detailHtml;
}

function renderLog() {
    logArea.innerHTML = '';
    simulationLog.forEach(msg => {
        const p = document.createElement('p');
        p.textContent = msg;
        logArea.appendChild(p);
    });
    logArea.scrollTop = logArea.scrollHeight; // Auto-scroll to bottom
}

function renderUI() {
    renderAccounts();
    renderDatasets();
    renderReviewers();
    renderBundles();
    renderLog();
}

function updateSimulationStatus(message, type = 'info') {
    simulationStatus.textContent = message;
    simulationStatus.className = `status-message ${type === 'success' ? 'status-success' : type === 'error' ? 'status-error' : 'status-info'} w-full max-w-md`;
}

// --- Simulation Logic ---

// Deep copy utility
const deepCopy = (obj) => JSON.parse(JSON.stringify(obj));

function initializeSimulation() {
    currentState = deepCopy(initialState);

    // Set initial balances for deployer (total supply)
    currentState.myToken.balances[currentState.accounts.deployer] = currentState.myToken.totalSupply;

    currentStepIndex = 0;
    simulationLog = [];
    isSimulationRunning = false;

    startButton.disabled = false;
    nextStepButton.disabled = true;
    resetButton.disabled = false;
    updateSimulationStatus('Click "Start Simulation" to begin.');
    renderUI();
}

function simulateTransaction(sender, description, updates) {
    simulationLog.push(`[${currentStepIndex + 1}/${simulationSteps.length}] ${description}`);
    updates(); // Apply state changes
}

const simulationSteps = [
    // Step 1: Initial Token Distribution
    () => {
        const deployer = currentState.accounts.deployer;
        const dataOwner = currentState.accounts.dataOwner;
        const reviewer1 = currentState.accounts.reviewer1;
        const reviewer2 = currentState.accounts.reviewer2;
        const dataBuyer = currentState.accounts.dataBuyer;
        const dummyDatasetOwner = currentState.accounts.dummyDatasetOwner;
        const transferAmount = toWei(200); // 200 MTK

        simulateTransaction(deployer, `STEP 1: Initial Token Distribution to participants.`, () => {
            currentState.myToken.balances[deployer] -= transferAmount * 5; // 5 recipients
            currentState.myToken.balances[dataOwner] = (currentState.myToken.balances[dataOwner] || 0) + transferAmount;
            currentState.myToken.balances[reviewer1] = (currentState.myToken.balances[reviewer1] || 0) + transferAmount;
            currentState.myToken.balances[reviewer2] = (currentState.myToken.balances[reviewer2] || 0) + transferAmount;
            currentState.myToken.balances[dataBuyer] = (currentState.myToken.balances[dataBuyer] || 0) + transferAmount;
            currentState.myToken.balances[dummyDatasetOwner] = (currentState.myToken.balances[dummyDatasetOwner] || 0) + transferAmount;
        });
        updateSimulationStatus('STEP 1: Initial MTK tokens distributed. Balances updated.', 'success');
    },
    // Step 2.1: Data Owner submits a dataset
    () => {
        const dataOwner = currentState.accounts.dataOwner;
        const dataReviewAddress = currentState.contractAddresses.DataReview;
        const datasetStakeAmount = toWei(10); // 10 MTK

        simulateTransaction(dataOwner, `STEP 2.1: Data Owner (${dataOwner.substring(0, 6)}...) submits dataset.`, () => {
            // Simulate approve
            // Simulate transferFrom to DataReview contract
            currentState.myToken.balances[dataOwner] -= datasetStakeAmount;
            currentState.myToken.balances[dataReviewAddress] = (currentState.myToken.balances[dataReviewAddress] || 0) + datasetStakeAmount;

            const newDatasetId = currentState.dataReview.nextDatasetId++;
            currentState.dataReview.datasets[newDatasetId] = {
                id: newDatasetId,
                owner: dataOwner,
                metadataURI: "ipfs://QmHealthcareDataHash123",
                stakeAmount: datasetStakeAmount,
                reviewed: false,
                totalReviewScore: 0,
                numReviews: 0,
                stakeReleased: false
            };
            currentState.dataReview.reviewerStake[dataOwner] = (currentState.dataReview.reviewerStake[dataOwner] || 0); // Initialize if not exists
        });
        updateSimulationStatus('STEP 2.1: Dataset 1 submitted by Data Owner. Stake locked.', 'success');
    },
    // Step 2.2: Reviewers stake tokens
    () => {
        const reviewer1 = currentState.accounts.reviewer1;
        const reviewer2 = currentState.accounts.reviewer2;
        const dataReviewAddress = currentState.contractAddresses.DataReview;
        const reviewerStakeAmount = toWei(5); // 5 MTK

        simulateTransaction(reviewer1, `STEP 2.2: Reviewer 1 (${reviewer1.substring(0, 6)}...) stakes tokens.`, () => {
            // Simulate approve and transferFrom
            currentState.myToken.balances[reviewer1] -= reviewerStakeAmount;
            currentState.myToken.balances[dataReviewAddress] += reviewerStakeAmount;
            if (!currentState.dataReview.reviewers[reviewer1]) {
                currentState.dataReview.reviewers[reviewer1] = { addr: reviewer1, reputation: 0, exists: true };
            }
            currentState.dataReview.reviewerStake[reviewer1] = (currentState.dataReview.reviewerStake[reviewer1] || 0) + reviewerStakeAmount;
        });

        simulateTransaction(reviewer2, `STEP 2.2: Reviewer 2 (${reviewer2.substring(0, 6)}...) stakes tokens.`, () => {
            // Simulate approve and transferFrom
            currentState.myToken.balances[reviewer2] -= reviewerStakeAmount;
            currentState.myToken.balances[dataReviewAddress] += reviewerStakeAmount;
            if (!currentState.dataReview.reviewers[reviewer2]) {
                currentState.dataReview.reviewers[reviewer2] = { addr: reviewer2, reputation: 0, exists: true };
            }
            currentState.dataReview.reviewerStake[reviewer2] = (currentState.dataReview.reviewerStake[reviewer2] || 0) + reviewerStakeAmount;
        });
        updateSimulationStatus('STEP 2.2: Reviewers staked tokens and are now eligible to review.', 'success');
    },
    // Step 2.3: Reviewers submit reviews for dataset_id_1 (3 reviews to trigger 'reviewed' status)
    () => {
        const reviewer1 = currentState.accounts.reviewer1;
        const reviewer2 = currentState.accounts.reviewer2;
        const datasetId1 = 1; // Assuming first dataset submitted is ID 1
        const dataset = currentState.dataReview.datasets[datasetId1];

        simulateTransaction(reviewer1, `STEP 2.3: Reviewer 1 (${reviewer1.substring(0, 6)}...) submits review for Dataset ${datasetId1} (Score: 80).`, () => {
            dataset.totalReviewScore += 80;
            dataset.numReviews++;
            currentState.dataReview.reviewers[reviewer1].reputation += 80;
        });

        simulateTransaction(reviewer2, `STEP 2.3: Reviewer 2 (${reviewer2.substring(0, 6)}...) submits review for Dataset ${datasetId1} (Score: 90).`, () => {
            dataset.totalReviewScore += 90;
            dataset.numReviews++;
            currentState.dataReview.reviewers[reviewer2].reputation += 90;
        });

        simulateTransaction(reviewer1, `STEP 2.3: Reviewer 1 (${reviewer1.substring(0, 6)}...) submits third review for Dataset ${datasetId1} (Score: 75).`, () => {
            dataset.totalReviewScore += 75;
            dataset.numReviews++;
            currentState.dataReview.reviewers[reviewer1].reputation += 75;
            if (dataset.numReviews >= 3) {
                dataset.reviewed = true;
                // Simulate auto-release of stake
                if (!dataset.stakeReleased) {
                    dataset.stakeReleased = true;
                    currentState.myToken.balances[dataset.owner] += dataset.stakeAmount;
                    currentState.myToken.balances[currentState.contractAddresses.DataReview] -= dataset.stakeAmount;
                }
            }
        });
        updateSimulationStatus('STEP 2.3: Reviews submitted. Dataset 1 reviewed and stake released to owner.', 'success');
    },
    // Step 2.5: Reviewer withdraws stake
    () => {
        const reviewer1 = currentState.accounts.reviewer1;
        const dataReviewAddress = currentState.contractAddresses.DataReview;
        const stakeToWithdraw = currentState.dataReview.reviewerStake[reviewer1];

        simulateTransaction(reviewer1, `STEP 2.5: Reviewer 1 (${reviewer1.substring(0, 6)}...) withdraws stake.`, () => {
            if (stakeToWithdraw > 0) {
                currentState.myToken.balances[reviewer1] += stakeToWithdraw;
                currentState.myToken.balances[dataReviewAddress] -= stakeToWithdraw;
                currentState.dataReview.reviewerStake[reviewer1] = 0;
            }
        });
        updateSimulationStatus('STEP 2.5: Reviewer 1 withdrew their staked tokens.', 'success');
    },
    // Step 2.6: Submit another dataset by dummy_dataset_owner for bundling later
    () => {
        const dummyDatasetOwner = currentState.accounts.dummyDatasetOwner;
        const dataReviewAddress = currentState.contractAddresses.DataReview;
        const datasetStakeAmount2 = toWei(8); // 8 MTK

        simulateTransaction(dummyDatasetOwner, `STEP 2.6: Dummy Data Owner (${dummyDatasetOwner.substring(0, 6)}...) submits Dataset 2.`, () => {
            // Simulate approve and transferFrom
            currentState.myToken.balances[dummyDatasetOwner] -= datasetStakeAmount2;
            currentState.myToken.balances[dataReviewAddress] += datasetStakeAmount2;

            const newDatasetId = currentState.dataReview.nextDatasetId++;
            currentState.dataReview.datasets[newDatasetId] = {
                id: newDatasetId,
                owner: dummyDatasetOwner,
                metadataURI: "ipfs://QmFinancialDataHash456",
                stakeAmount: datasetStakeAmount2,
                reviewed: false,
                totalReviewScore: 0,
                numReviews: 0,
                stakeReleased: false
            };
        });
        updateSimulationStatus('STEP 2.6: Dataset 2 submitted by Dummy Data Owner. Stake locked.', 'success');
    },
    // Step 3.1: Create a data bundle
    () => {
        const deployer = currentState.accounts.deployer;
        const bundlePrice = toWei(50); // 50 MTK

        simulateTransaction(deployer, `STEP 3.1: Deployer (${deployer.substring(0, 6)}...) creates a new data bundle.`, () => {
            const newBundleId = currentState.dataBundle.nextBundleId++;
            currentState.dataBundle.bundles[newBundleId] = {
                id: newBundleId,
                name: "Comprehensive AI Training Bundle",
                price: bundlePrice,
                datasetIds: [],
                datasetWeights: {},
                totalWeight: 0,
                nftOwner: null // No owner yet, minted on purchase
            };
        });
        updateSimulationStatus('STEP 3.1: New data bundle created.', 'success');
    },
    // Step 3.2: Add datasets to the bundle with revenue-sharing weights
    () => {
        const deployer = currentState.accounts.deployer;
        const bundleId = 1; // Assuming first bundle created is ID 1
        const datasetId1 = 1;
        const datasetId2 = 2;
        const dataOwner = currentState.accounts.dataOwner;
        const dummyDatasetOwner = currentState.accounts.dummyDatasetOwner;

        simulateTransaction(deployer, `STEP 3.2: Deployer adds Dataset ${datasetId1} (weight 70) to Bundle ${bundleId}.`, () => {
            const bundle = currentState.dataBundle.bundles[bundleId];
            bundle.datasetIds.push(datasetId1);
            bundle.datasetWeights[datasetId1] = 70;
            bundle.totalWeight += 70;
            currentState.dataBundle.datasetIdToOwner[datasetId1] = dataOwner;
        });

        simulateTransaction(deployer, `STEP 3.2: Deployer adds Dataset ${datasetId2} (weight 30) to Bundle ${bundleId}.`, () => {
            const bundle = currentState.dataBundle.bundles[bundleId];
            bundle.datasetIds.push(datasetId2);
            bundle.datasetWeights[datasetId2] = 30;
            bundle.totalWeight += 30;
            currentState.dataBundle.datasetIdToOwner[datasetId2] = dummyDatasetOwner;
        });
        updateSimulationStatus('STEP 3.2: Datasets added to the bundle with specified weights.', 'success');
    },
    // Step 3.4: Data Buyer purchases the bundle
    () => {
        const dataBuyer = currentState.accounts.dataBuyer;
        const dataBundleAddress = currentState.contractAddresses.DataBundle;
        const bundleId = 1;
        const bundle = currentState.dataBundle.bundles[bundleId];
        const bundlePrice = bundle.price;

        simulateTransaction(dataBuyer, `STEP 3.4: Data Buyer (${dataBuyer.substring(0, 6)}...) purchases Bundle ${bundleId}.`, () => {
            // Simulate approve and transferFrom to DataBundle contract
            currentState.myToken.balances[dataBuyer] -= bundlePrice;
            currentState.myToken.balances[dataBundleAddress] = (currentState.myToken.balances[dataBundleAddress] || 0) + bundlePrice;

            // Simulate NFT minting
            bundle.nftOwner = dataBuyer;

            // Simulate revenue distribution
            const totalRevenue = bundlePrice;
            const datasetId1 = 1;
            const datasetId2 = 2;
            const dataOwner = currentState.accounts.dataOwner;
            const dummyDatasetOwner = currentState.accounts.dummyDatasetOwner;

            const dataset1Weight = bundle.datasetWeights[datasetId1];
            const dataset2Weight = bundle.datasetWeights[datasetId2];
            const totalWeight = bundle.totalWeight;

            const amountToDistribute1 = Math.floor((totalRevenue * dataset1Weight) / totalWeight);
            const amountToDistribute2 = Math.floor((totalRevenue * dataset2Weight) / totalWeight);

            currentState.myToken.balances[dataOwner] += amountToDistribute1;
            currentState.myToken.balances[dummyDatasetOwner] += amountToDistribute2;
            currentState.myToken.balances[dataBundleAddress] -= (amountToDistribute1 + amountToDistribute2); // Deduct distributed amount
        });
        updateSimulationStatus('STEP 3.4: Bundle purchased. NFT minted to buyer, revenue distributed.', 'success');
    },
    // Step 3.5: Verify bundle NFT ownership
    () => {
        const bundleId = 1;
        const bundle = currentState.dataBundle.bundles[bundleId];
        const expectedOwner = currentState.accounts.dataBuyer;

        simulateTransaction(null, `STEP 3.5: Verifying NFT ownership for Bundle ${bundleId}.`, () => {
            if (bundle.nftOwner === expectedOwner) {
                simulationLog.push(`SUCCESS: Owner of Bundle NFT ${bundleId} is ${bundle.nftOwner.substring(0, 6)}... (Correct).`);
            } else {
                simulationLog.push(`WARNING: Owner of Bundle NFT ${bundleId} is ${bundle.nftOwner.substring(0, 6)}... (Expected: ${expectedOwner.substring(0, 6)}...).`);
            }
        });
        updateSimulationStatus('STEP 3.5: Bundle NFT ownership verified.', 'success');
    }
];

function nextStep() {
    if (currentStepIndex < simulationSteps.length) {
        simulationSteps[currentStepIndex]();
        currentStepIndex++;
        renderUI();
        if (currentStepIndex === simulationSteps.length) {
            nextStepButton.disabled = true;
            startButton.disabled = true;
            updateSimulationStatus('Simulation complete!', 'success');
        }
    }
}

// --- Event Listeners ---
startButton.addEventListener('click', () => {
    if (!isSimulationRunning) {
        isSimulationRunning = true;
        startButton.disabled = true;
        nextStepButton.disabled = false;
        updateSimulationStatus('Simulation started. Click "Next Step" to proceed.', 'info');
        nextStep(); // Execute the first step immediately
    }
});

nextStepButton.addEventListener('click', nextStep);

resetButton.addEventListener('click', () => {
    initializeSimulation();
    updateSimulationStatus('Simulation reset. Ready to start again.', 'info');
});

// Initial render on load
initializeSimulation();
