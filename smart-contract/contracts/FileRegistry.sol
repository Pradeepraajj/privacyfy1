// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract FileRegistry {
    // 1. Define the structure of a File
    struct FileData {
        string cid;         // IPFS Content Identifier
        string fileName;    // Original name of the file
        uint256 timestamp;  // When it was uploaded
    }

    // 2. Mapping: Wallet Address => List of Files
    mapping(address => FileData[]) public userFiles;

    // 3. Event: Logs activity so the frontend knows when an upload happens
    event FileUploaded(address indexed owner, string cid, string fileName, uint256 timestamp);

    // 4. Function to add a file (Store Data)
    function addFile(string memory _cid, string memory _fileName) public {
        FileData memory newFile = FileData({
            cid: _cid,
            fileName: _fileName,
            timestamp: block.timestamp
        });

        userFiles[msg.sender].push(newFile);
        emit FileUploaded(msg.sender, _cid, _fileName, block.timestamp);
    }

    // 5. Function to retrieve files (Read Data)
    function getFiles() public view returns (FileData[] memory) {
        return userFiles[msg.sender];
    }
}