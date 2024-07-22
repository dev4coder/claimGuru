// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract ClaimManagement {
    // Mapping from IMEI hash to claim status
    mapping(bytes32 => bool) private claims;

    // Event to be emitted when a claim is recorded
    event ClaimRecorded(bytes32 indexed imeiHash, bool status);

    // Record a new claim
    function recordClaim(string memory imei) public returns (bool) {
        bytes32 imeiHash = keccak256(abi.encodePacked(imei));
        
        // Check if the IMEI is already claimed
        require(!claims[imeiHash], "IMEI already claimed");

        // Record the claim
        claims[imeiHash] = true;

        // Emit the event
        emit ClaimRecorded(imeiHash, true);

        return true;
    }

    // Check if an IMEI is claimed
    function isClaimed(string memory imei) public view returns (bool) {
        bytes32 imeiHash = keccak256(abi.encodePacked(imei));
        return claims[imeiHash];
    }
}
