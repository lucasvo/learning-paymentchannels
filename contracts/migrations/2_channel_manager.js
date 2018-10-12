const TestToken = artifacts.require("TestToken");
const ChannelManager = artifacts.require("ChannelManager");

module.exports = function (deployer) {
  deployer.deploy(TestToken, "Token", "TEST", 10);
  deployer.deploy(ChannelManager);
}

