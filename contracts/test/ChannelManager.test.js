const {keccak, bufferToHex, toBuffer} = require('ethereumjs-util');

const TestToken = artifacts.require('TestToken');
const ChannelManager = artifacts.require('ChannelManager');

const shouldRevert = async (promise) => {
    return await shouldReturnWithMessage(promise, "revert");
}

const shouldReturnWithMessage = async (promise, search) => {
    try {
        await promise;
        assert.fail("Expected message not received");
    } catch (error) {
        const revertFound = error.message.search(search) >= 0;
        assert(revertFound, `Expected "${search}", got ${error} instead`);
    }
}

const createSignatureMessage = (payloads) => {
    let buffers = payloads.map((item) => {
        return toBuffer(item);
    })

    return bufferToHex(keccak(Buffer.concat(buffers)));
}

contract('ChannelManager', (accounts) => {
  beforeEach(async function () {
        this.testToken = await TestToken.new("TestToken", "TEST", 10);
        await this.testToken.addMinter(accounts[0]);
        await this.testToken.mint(accounts[0], 1000)
        await this.testToken.mint(accounts[1], 1000)
        this.channelManager = await ChannelManager.new();
  });

  describe("ChannelManager", async () => {
    it("should allow you to create a channel", async function () {
      this.channelManager.createChannel(0, 0x1, 0x2, this.testToken.address, 10);
      var details = await this.channelManager.getChannelDetails(0);
      assert.equal(details[0], '0x0000000000000000000000000000000000000001');
      assert.equal(details[1], '0x0000000000000000000000000000000000000002');
      assert.equal(details[4], 0); // INITIALIZED

    });
  });

  describe("ChannelManager", async function () {
    it("should allow you to fund a channel", async function () {
      this.channelManager.createChannel(1, accounts[0], accounts[1], this.testToken.address, 10);
      await this.testToken.approve(this.channelManager.address, 10);
      await this.testToken.approve(this.channelManager.address, 10, {from: accounts[1]});
      var tx = await this.channelManager.fundChannel(1, {from: accounts[0]});
      shouldRevert(this.channelManager.fundChannel(1, {from: accounts[0]}));
      shouldRevert(this.channelManager.fundChannel(1, {from: accounts[3]}));

      var details = await this.channelManager.getChannelDetails(1);
      assert.equal(details[4], 1); // PARTYA_FUNDED
      var tx_b = await this.channelManager.fundChannel(1, {from: accounts[1]});
      details = await this.channelManager.getChannelDetails(1);
      assert.equal(details[4], 3); // ACTIVE
      });
  });

  describe("ChannelManager", async function () {
    it("should allow you to settle a channel", async function () {
      this.channelManager.createChannel(1, accounts[0], accounts[1], this.testToken.address, 10);
      await this.testToken.approve(this.channelManager.address, 10);
      await this.testToken.approve(this.channelManager.address, 10, {from: accounts[1]});
      await this.channelManager.fundChannel(1, {from: accounts[0]});
      await this.channelManager.fundChannel(1, {from: accounts[1]});
      let channelId = 10;
      let nonce = 1;
      let balanceA = 5;
      let payload = createSignatureMessage([channelId, nonce, balanceA, accounts[1]]);
      let signature = await web3.eth.sign(accounts[1], payload);

      // trying to settle with self signed state
      shouldRevert(this.channelManager.settle(channelId, nonce, balanceA, signature, {from: accounts[1]}));

      // Invalid signature because of modified arguments (balanceA, nonce)
      shouldRevert(this.channelManager.settle(channelId, nonce, balanceA, signature));
      shouldRevert(this.channelManager.settle(channelId, nonce+1, balanceA, signature));
      shouldRevert(this.channelManager.settle(channelId, nonce, balanceA+1, signature));

      let tx = await this.channelManager.settle(channelId, nonce, balanceA, signature);
      let details = await this.channelManager.getChannelDetails(channelId);
      assert.equal(details[4], 4); // PENDING_SETTLMENT

      // Calling the same tx twice
      shouldRevert(this.channelManager.settle(channelId, nonce, balanceA, signature, {from: accounts[0]}));

      nonce = 2;
      payload = createSignatureMessage([channelId, nonce, balanceA, accounts[1]]);
      signature = await web3.eth.sign(accounts[1], payload);
      tx = await this.channelManager.settle(channelId, nonce, balanceA, signature);
      details = await this.channelManager.getChannelDetails(channelId);
      assert.equal(details[5], nonce)
      assert.equal(details[4], balanceA)

      // Calling as partyB

      nonce = 3;
      payload = createSignatureMessage([channelId, nonce, balanceA, accounts[0]]);
      signature = await web3.eth.sign(accounts[1], payload);
      tx = await this.channelManager.settle(channelId, nonce, balanceA, signature);
      details = await this.channelManager.getChannelDetails(channelId);
      assert.equal(details[5], nonce)
      assert.equal(details[4], balanceA)

      });
  });





})
