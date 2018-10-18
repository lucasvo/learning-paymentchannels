const testTokenContractAbi = require('../contracts/build/contracts/TestToken.json')
const channelManagerContractAbi = require('../contracts/build/contracts/ChannelManager.json')

let config = {
    wallets: {
        alice: "0xd77c534aed04d7ce34cd425073a033db4fbe6a9d",
        bob: "0xc8dd3d66e112fae5c88fe6a677be24013e53c33e",
    },
    web3ProviderUrl: 'http://localhost:8545',
    networkId: 99999,
    testTokenAddress: testTokenContractAbi.networks[99999].address,
    channelManagerAddress: channelManagerContractAbi.networks[99999].address,
}

if (process.env['NODE_ROLE'] == "bob") {
    config.wallet = config.wallets.bob
    config.db = 'bob.db'
    config.port = 3001
} else {
    config.wallet = config.wallets.alice
    config.db = 'alice.db'
    config.port = 3000
}

module.exports = config
