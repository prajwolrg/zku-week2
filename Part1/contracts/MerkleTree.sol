//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import {PoseidonT3} from "./Poseidon.sol"; //an existing library to perform Poseidon hash on solidity
import "./verifier.sol"; //inherits with the MerkleTreeInclusionProof verifier contract

uint256 constant DEPTH_OF_TREE = 3;

contract MerkleTree is Verifier {
    uint256[] public hashes; // the Merkle tree in flattened array form
    uint256 public index = 0; // the current index of the first unfilled leaf
    uint256 public root; // the current Merkle root

    constructor() {
        // [assignment] initialize a Merkle tree of 8 with blank leaves

        hashes = new uint256[](2**(DEPTH_OF_TREE + 1) - 1); // calculating array size of tree nodes based on depth_of_tree

        uint256 j = 0;
        for (uint256 i = 2**DEPTH_OF_TREE; i > hashes.length; i++) {
            // Looping through each level of merkel tree
            hashes[i] = PoseidonT3.poseidon([hashes[j], hashes[j + 1]]);
            j += 2;
        }
        root = hashes[2 * (DEPTH_OF_TREE + 1) - 2];
    }

    function insertLeaf(uint256 hashedLeaf) public returns (uint256) {
        // [assignment] insert a hashed leaf into the Merkle tree
        require(index < 2**DEPTH_OF_TREE, "No more can be inserted.");
        hashes[0] = hashedLeaf;
        uint256 last_base_index = 0;
        for (uint256 i=0; i<DEPTH_OF_TREE; i++) {
        uint256 base_index = 2**DEPTH_OF_TREE;

            for (uint256 j=0; j<i; j++) {
                base_index += 2**(2-j);
            }
            uint256 required_index = base_index + index/2**(i+1);
            uint256 left_index = last_base_index + (required_index - base_index) * 2;
            uint256 right_index = last_base_index + (required_index - base_index) * 2 + 1;
            last_base_index = base_index;
        
            hashes[required_index] = PoseidonT3.poseidon(
                [hashes[left_index], hashes[right_index]]
            );        }
        root = hashes[2**(DEPTH_OF_TREE + 1) - 2];
        index++;
        return root;
    }
    function verify(
        uint256[2] memory a,
        uint256[2][2] memory b,
        uint256[2] memory c,
        uint256[1] memory input
    ) public view returns (bool) {
        // [assignment] verify an inclusion proof and check that the proof root matches current root
        return verifyProof(a,b,c,input);
    }

}
