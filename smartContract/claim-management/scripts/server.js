const express = require('express');
const { ethers } = require('hardhat');
require('dotenv').config();

const contractABI = require('../artifacts/contracts/ClaimManagement.sol/ClaimManagement.json').abi;
const contractAddress = '0xCA0b87DE1F016F6e6e217c21bB6f52392c9eAE04'; // Replace with your contract address

const app = express();
app.use(express.json());

const provider = new ethers.providers.JsonRpcProvider('https://rpc.api.moonbase.moonbeam.network');
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const contract = new ethers.Contract(contractAddress, contractABI, wallet);

// Endpoint to record a claim
app.post('/recordClaim', async (req, res) => {
    try {
        const { imei } = req.body;
        const tx = await contract.recordClaim(imei);
        await tx.wait();
        res.json({ message: 'Transaction successful', tx });
    } catch (error) {
        console.error('Error recording claim:', error);
        res.status(500).json({ error: 'Error recording claim' });
    }
});

// Endpoint to check if an IMEI is claimed
app.get('/isClaimed/:imei', async (req, res) => {
    try {
        const { imei } = req.params;
        const claimed = await contract.isClaimed(imei);
        res.json({ claimed });
    } catch (error) {
        console.error('Error checking claim status:', error);
        res.status(500).json({ error: 'Error checking claim status' });
    }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running on port ${PORT}`);
});
