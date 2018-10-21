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
    console.log(bufferToHex(Buffer.concat(buffers)));
    return bufferToHex(keccak(Buffer.concat(buffers)));
}

const leftpad = (str, len) => {
  str = String(str).substring(2);
  var i = -1;
  len = len - str.length;
  while (++i < len) {
    str = "0" + str;
  }
  return "0x"+str;
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
      this.channelManager.create(0, 0x1, 0x2, this.testToken.address, 10);
      var details = await this.channelManager.getDetails(0);
      assert.equal(details[0], '0x0000000000000000000000000000000000000001');
      assert.equal(details[1], '0x0000000000000000000000000000000000000002');
      assert.equal(details[4], 0); // INITIALIZED

    });
  });

  describe("ChannelManager", async function () {
    it("should allow you to fund a channel", async function () {
      this.channelManager.create(1, accounts[0], accounts[1], this.testToken.address, 10);
      await this.testToken.approve(this.channelManager.address, 10);
      await this.testToken.approve(this.channelManager.address, 10, {from: accounts[1]});
      var tx = await this.channelManager.fund(1, {from: accounts[0]});
      shouldRevert(this.channelManager.fund(1, {from: accounts[0]}));
      shouldRevert(this.channelManager.fund(1, {from: accounts[3]}));

      var details = await this.channelManager.getDetails(1);
      assert.equal(details[4], 1); // PARTYA_FUNDED
      var tx_b = await this.channelManager.fund(1, {from: accounts[1]});
      details = await this.channelManager.getDetails(1);
      assert.equal(details[4], 3); // ACTIVE
      });
  });

  describe("ChannelManager", async function () {
    it("should allow you to settle a channel", async function () {
      let channelId = leftpad("0x10", 64); // channelId must be padded properly

      this.channelManager.create(channelId, accounts[0], accounts[1], this.testToken.address, 10);
      await this.testToken.approve(this.channelManager.address, 10);
      await this.testToken.approve(this.channelManager.address, 10, {from: accounts[1]});
      await this.channelManager.fund(channelId, {from: accounts[0]});
      await this.channelManager.fund(channelId, {from: accounts[1]});

      let nonce = "0x1";
      let balanceA = "0x5";
      let payload = createSignatureMessage([leftpad(channelId, 64), leftpad(nonce, 8) , leftpad(balanceA, 8), accounts[1]]);
      let signature = await web3.eth.sign(accounts[1], payload);


      // trying to settle with self signed state
      shouldRevert(this.channelManager.settle(channelId, nonce, balanceA, signature, {from: accounts[1]}));

      // Invalid signature because of modified arguments (balanceA, nonce)
      shouldRevert(this.channelManager.settle(channelId, nonce+1, balanceA, signature));
      shouldRevert(this.channelManager.settle(channelId, nonce, balanceA+1, signature));

      let tx = await this.channelManager.settle(channelId, nonce, balanceA, signature, {from: accounts[0]});
      let details = await this.channelManager.getDetails(channelId);
      assert.equal(details[4], 4); // PENDING_SETTLMENT

      // Calling the same tx twice
      shouldRevert(this.channelManager.settle(channelId, nonce, balanceA, signature, {from: accounts[0]}));

      nonce = "0x2";
      balanceA = "0x6";
      payload = createSignatureMessage([channelId, leftpad(nonce, 8), leftpad(balanceA, 8), accounts[1]]);
      signature = await web3.eth.sign(accounts[1], payload);
      tx = await this.channelManager.settle(channelId, nonce, balanceA, signature, {from: accounts[0]});
      details = await this.channelManager.getDetails(channelId);
      assert.equal(details[6], 2) // nonce
      assert.equal(details[5], 6) // balanceA

      // Calling as partyB
      nonce = "0x3";
      payload = createSignatureMessage([channelId, leftpad(nonce, 8), leftpad(balanceA, 8), accounts[0]]);
      signature = await web3.eth.sign(accounts[0], payload);
      tx = await this.channelManager.settle(channelId, nonce, balanceA, signature, {from: accounts[1]});
      details = await this.channelManager.getDetails(channelId);
      assert.equal(details[6], 3) // nonce
      assert.equal(details[5], 6) // balanceA

      });
  });





})
