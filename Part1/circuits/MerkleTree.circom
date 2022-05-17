pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/switcher.circom";


template CheckRoot(n) { // compute the root of a MerkleTree of n Levels 
    signal input leaves[2**n - 1];
    signal output root;

    //[assignment] insert your code here to calculate the Merkle root from 2^n leaves
   var leafHashing = 2**n / 2; 
   var totalHashing = 2**n - 1;
 
   // initialization for components
   component intermediateHashes[totalHashing];
 
   // compute poseidon hashes in leaf level of Merkel Tree
   for (var i=0; i<leafHashing; i++) {
       intermediateHashes[i] = Poseidon(2); // component instantiation to Posedion template
 
       intermediateHashes[i].inputs[0] <== leaves[i*2];
       intermediateHashes[i].inputs[1] <== leaves[i*2+1];
   }
 
   // compute Poseidon hashes above leaf level of Merkel tree
   var j = 0;
   for (var i=leafHashing; i<totalHashing; i++) {
       intermediateHashes[i] = Poseidon(2);
 
       intermediateHashes[i].inputs[0] <== intermediateHashes[j*2].out;
       intermediateHashes[i].inputs[1] <== intermediateHashes[j*2+1].out;
 
       j++;
   }
 
   root <== intermediateHashes[totalHashing-1].out;

}

template MerkleTreeInclusionProof(n) {
    signal input leaf;
    signal input path_elements[n];
    signal input path_index[n]; // path index are 0's and 1's indicating whether the current element is on the left or right
    signal output root; // note that this is an OUTPUT signal

    //[assignment] insert your code here to compute the root from a leaf and elements along the path    component intermediateHashes[n];
    component switchers[n];
    component intermediateHashes[n];

    signal levels[n+1];
    levels[0] <== leaf;

    for (var i=0; i<n; i++) {
        intermediateHashes[i] = Poseidon(2);

        switchers[i] = Switcher();
        switchers[i].sel <== path_index[i];
        switchers[i].L <== levels[0];
        switchers[i].R <== path_elements[i];
        
        intermediateHashes[i].inputs[0] <== switchers[i].outL;
        intermediateHashes[i].inputs[1] <== switchers[i].outR;

        levels[i+1] <== intermediateHashes[i].out;
    }

    root <== levels[n];


}