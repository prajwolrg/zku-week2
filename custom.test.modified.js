// [assignment] please copy the entire modified custom.test.js here
const hre = require('hardhat')
const { ethers, waffle } = hre
const { loadFixture } = waffle
const { expect } = require('chai')
const { utils } = ethers

const Utxo = require('../src/utxo')
const { transaction, registerAndTransact, prepareTransaction, buildMerkleTree } = require('../src/index')
const { toFixedHex, poseidonHash } = require('../src/utils')
const { Keypair } = require('../src/keypair')
const { encodeDataForBridge } = require('./utils')

const MERKLE_TREE_HEIGHT = 5
const l1ChainId = 1
const MINIMUM_WITHDRAWAL_AMOUNT = utils.parseEther(process.env.MINIMUM_WITHDRAWAL_AMOUNT || '0.05')
const MAXIMUM_DEPOSIT_AMOUNT = utils.parseEther(process.env.MAXIMUM_DEPOSIT_AMOUNT || '1')

describe('Custom Tests', function () {
  this.timeout(20000)

  async function deploy(contractName, ...args) {
    const Factory = await ethers.getContractFactory(contractName)
    const instance = await Factory.deploy(...args)
    return instance.deployed()
  }

  async function fixture() {
    require('../scripts/compileHasher')
    const [sender, gov, l1Unwrapper, multisig] = await ethers.getSigners()
    const verifier2 = await deploy('Verifier2')
    const verifier16 = await deploy('Verifier16')
    const hasher = await deploy('Hasher')

    const token = await deploy('PermittableToken', 'Wrapped ETH', 'WETH', 18, l1ChainId)
    await token.mint(sender.address, utils.parseEther('10000'))

    const amb = await deploy('MockAMB', gov.address, l1ChainId)
    const omniBridge = await deploy('MockOmniBridge', amb.address)

    /** @type {TornadoPool} */
    const tornadoPoolImpl = await deploy(
      'TornadoPool',
      verifier2.address,
      verifier16.address,
      MERKLE_TREE_HEIGHT,
      hasher.address,
      token.address,
      omniBridge.address,
      l1Unwrapper.address,
      gov.address,
      l1ChainId,
      multisig.address,
    )

    const { data } = await tornadoPoolImpl.populateTransaction.initialize(
      MINIMUM_WITHDRAWAL_AMOUNT,
      MAXIMUM_DEPOSIT_AMOUNT,
    )
    const proxy = await deploy(
      'CrossChainUpgradeableProxy',
      tornadoPoolImpl.address,
      gov.address,
      data,
      amb.address,
      l1ChainId,
    )

    const tornadoPool = tornadoPoolImpl.attach(proxy.address)

    await token.approve(tornadoPool.address, utils.parseEther('10000'))

    return { tornadoPool, token, proxy, omniBridge, amb, gov, multisig }
  }

  it('[assignment] ii. deposit 0.1 ETH in L1 -> withdraw 0.08 ETH in L2 -> assert balances', async () => {
      // [assignment] complete code here

     const { tornadoPool, token, omniBridge } = await loadFixture(fixture);
     const keyPairApple = new Keypair(); // key pair of alice generated in /src/keypair.js
 
     // ********************************
     // Apple depositing 0.1 ether in L1
 
     const depositEther = utils.parseEther('0.1'); // convert eth into BigNumber instance of Wei
     const unspentDeposit = new Utxo({ amount: depositEther, keypair: keyPairApple});
 
     // data preparation for transaction
     const { args, extData } = await prepareTransaction({ tornadoPool, outputs: [unspentDeposit] });
     const bridgeData = encodeDataForBridge({ proof: args, extData});
     const bridgeTransaction = await tornadoPool.populateTransaction.onTokenBridged(token.address, unspentDeposit.amount, bridgeData);
 
     // imitating bridge where token is first sent to omnibridge and then to pool
     await token.transfer(omniBridge.address, depositEther);
     const transferTransaction = await token.populateTransaction.transfer(tornadoPool.address, depositEther);
 
     // execute the bridge transaction
     await omniBridge.execute([
       { who: token.address, callData: transferTransaction.data },       // sending token to pool
       { who: tornadoPool.address, callData: bridgeTransaction.data },    // calling bridgeTransaction
     ]);
 
     // ********************************
 
     // Apple withdrawing 0.08 ether in L2
     // **********************************
 
     const withdrawEther = utils.parseEther('0.08');
 
     // recepient address different from sender address i.e., Apple creating anonymity
     const recipient = '0x42EB768f2244C8811C63729A21A3569731535f06';
     const changedUnspentDeposit = new Utxo({ amount: depositEther.sub(withdrawEther), keypair: keyPairApple});
 
     // transaction creation for withdrawing amount
     await transaction({ tornadoPool, inputs: [unspentDeposit], outputs: [changedUnspentDeposit], recipient: recipient});
 
     // Checking balance after transaction
     // **********************************
 
     // asserting recepient balance to be 0.08
     const recipientBalance = await token.balanceOf(recipient);
     expect(recipientBalance).to.be.equal(utils.parseEther('0.08'));
 
     // asserting omniBridge balance to be 0
     const omniBridgeBalance = await token.balanceOf(omniBridge.address);
     expect(omniBridgeBalance).to.be.equal(0);
 
     // asserting pool balance to be 0.1-0.08 = 0.02
     const poolBalance = await token.balanceOf(tornadoPool.address);
     expect(poolBalance).to.be.equal(utils.parseEther('0.02'));
  })

  it('[assignment] iii. see assignment doc for details', async () => {
      // [assignment] complete code here
     // instantiation of alice keypair and hardhat waffle
     const { tornadoPool, token, omniBridge } = await loadFixture(fixture);
     const keyPairAlice = new Keypair();
 
     // Alice depositing 0.13 ether in L1
     // *********************************
 
     // creation of transaction by Alice
     const aliceDepositEther = utils.parseEther('0.13');
     const aliceUnspentDeposit = new Utxo({ amount: aliceDepositEther, keypair: keyPairAlice });
 
     // data preparation for transaction
     const { args, extData } = await prepareTransaction({ tornadoPool, outputs: [aliceUnspentDeposit] });
     const bridgeData = encodeDataForBridge({ proof: args, extData });
     const bridgeTransaction = await tornadoPool.populateTransaction.onTokenBridged(token.address, aliceUnspentDeposit.amount, bridgeData);
 
     // imitating bridge where token is first sent to omnibridge and then to pool
     await token.transfer(omniBridge.address, aliceDepositEther);
     const transferTransaction = await token.populateTransaction.transfer(tornadoPool.address, aliceDepositEther);
 
     // execute the bridge transaction
     await omniBridge.execute([
       { who: token.address, callData: transferTransaction.data }, // sending tokens to pool
       { who: tornadoPool.address, callData: bridgeTransaction.data }, // calling bridgeTransaction
     ]);
 
     // Alice sending Bob 0.06 ether in L2
     // **********************************
 
     // Bob giving Alice address to send some eth inside the shielded pool
     const bobKeypair = new Keypair(); // contains private and public keys
     const bobAddress = bobKeypair.address(); // contains only public key
 
     // Creating two transactions, one to transfer to Bob, one represent the remaining balance
     const bobSendAmount = utils.parseEther('0.06')
     const bobSendUtxo = new Utxo({ amount: bobSendAmount, keypair: Keypair.fromString(bobAddress) });
     const aliceChangeUtxo = new Utxo({ amount: aliceDepositEther.sub(bobSendAmount), keypair: aliceUnspentDeposit.keypair });
 
     // executing the transactions
     await transaction({ tornadoPool, inputs: [aliceUnspentDeposit], outputs: [bobSendUtxo, aliceChangeUtxo] });
 
     // Bob withdrawing all funds from L2
     // *********************************
 
     const bobBalanceUtxo = new Utxo({
       amount: bobSendAmount,
       keypair: bobKeypair,
       blinding: bobSendUtxo.blinding,
     });
     const bobRecipient = '0x6dC0c0be4c8B2dFE750156dc7d59FaABFb5B923D';
     await transaction({
       tornadoPool,
       inputs: [bobBalanceUtxo],
       recipient: bobRecipient,
     });
 
     // Alice withdrawing all funds from L1
     // ***********************************
 
     const aliceRecipient = '0x6635F83421Bf059cd8111f180f0727128685BaE4';
     await transaction({
       tornadoPool,
       inputs: [aliceChangeUtxo],
       recipient: aliceRecipient,
       isL1Withdrawal: true,
     });
 
     // checking balances after transaction
     // -----------------
 
     // Bob receiving all funds in his account in L2
     const bobRecipientBalance = await token.balanceOf(bobRecipient);
     expect(bobRecipientBalance).to.be.equal(utils.parseEther('0.06'));
 
     // Alice balance
     const aliceRecipientBalance = await token.balanceOf(aliceRecipient);
     expect(aliceRecipientBalance).to.be.equal(0);
 
     // omniBridge balance
     const omniBridgeBalance = await token.balanceOf(omniBridge.address);
     expect(omniBridgeBalance).to.be.equal(utils.parseEther('0.07'));
 
     // pool balance
     const poolBalance = await token.balanceOf(tornadoPool.address);
     expect(poolBalance).to.be.equal(0);

  })
})
