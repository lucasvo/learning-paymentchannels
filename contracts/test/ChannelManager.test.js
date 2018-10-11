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


contract('ChannelManager', function(accounts) {
  beforeEach(async function () {
        this.testToken = await TestToken.new("TestToken", "TEST", 10);
        await this.testToken.addMinter(accounts[0]);
        await this.testToken.mint(accounts[0], 1000)
        await this.testToken.mint(accounts[1], 1000)
        this.channelManager = await ChannelManager.new();
  });

  describe("ChannelManager", async function () {
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



})
