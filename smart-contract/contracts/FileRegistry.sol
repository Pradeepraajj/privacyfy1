// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract FileRegistry {
    address public admin;

    struct FileData {
        string cid;         // IPFS Content Identifier
        string fileName;    // Original name of the file
        bytes32 docHash;    // Unique fingerprint of the document
        bool isVerified;    // AI Verification Status
        uint256 timestamp;  // When it was anchored
    }

    // Mapping: Wallet Address => List of Verified Identity Records
    mapping(address => FileData[]) public userFiles;

    event FileVerified(address indexed owner, string cid, bytes32 docHash, bool status);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only the AI Backend can verify identities");
        _;
    }

    constructor() {
        admin = msg.sender; // The wallet that deploys this becomes the Admin
    }

    // Updated function: Now includes docHash and onlyAdmin protection
    function addVerifiedFile(
        address _user, 
        string memory _cid, 
        string memory _fileName, 
        bytes32 _docHash
    ) public onlyAdmin {
        FileData memory newFile = FileData({
            cid: _cid,
            fileName: _fileName,
            docHash: _docHash,
            isVerified: true,
            timestamp: block.timestamp
        });

        userFiles[_user].push(newFile);
        emit FileVerified(_user, _cid, _docHash, true);
    }

    function getFiles(address _user) public view returns (FileData[] memory) {
        return userFiles[_user];
    }
}