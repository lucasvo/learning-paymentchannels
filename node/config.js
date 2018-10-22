const testTokenContractAbi = require('../contracts/build/contracts/TestToken.json')
const channelManagerContractAbi = require('../contracts/build/contracts/ChannelManager.json')

let config = {
    contacts: {
        alice: {
            account: "0xd77c534aed04d7ce34cd425073a033db4fbe6a9d",
            peerId: "/ip4/127.0.0.1/tcp/10333/ipfs/QmcrQZ6RJdpYuGvZqD5QEHAv6qX4BrQLJLQPQUrTrzdcgm/ipfs/QmcrQZ6RJdpYuGvZqD5QEHAv6qX4BrQLJLQPQUrTrzdcgm",
        },
        bob: {
            account: "0xc8dd3d66e112fae5c88fe6a677be24013e53c33e",
            peerId: "/ip4/127.0.0.1/tcp/10334/ipfs/Qma3GsJmB47xYuyahPZPSadh1avvxfyYQwk8R3UnFrQ6aP/ipfs/Qma3GsJmB47xYuyahPZPSadh1avvxfyYQwk8R3UnFrQ6aP",
        }
    },
    web3ProviderUrl: 'http://localhost:8545',
    networkId: 99999,
    testTokenAddress: testTokenContractAbi.networks[99999].address,
    channelManagerAddress: channelManagerContractAbi.networks[99999].address,
}

if (process.env['NODE_ROLE'] == "bob") {
    config.wallet = "0xc8dd3d66e112fae5c88fe6a677be24013e53c33e"
    config.key = '0x17e063fa17dd8274b09c14b253697d9a20afff74ace3c04fdb1b9c814ce0ada5'
    config.db = 'bob.db'
    config.port = 3001
    config.p2pId = '../alice_id.json'
    config.p2pPort = 10334
    config.otherPeer = '../bob_id.json'
    config.otherPeerPort = '10333'
} else {
    config.wallet = "0xd77c534aed04d7ce34cd425073a033db4fbe6a9d"
    config.key = '0xb5fffc3933d93dc956772c69b42c4bc66123631a24e3465956d80b5b604a2d13'
    config.db = 'alice.db'
    config.port = 3000
    config.p2pId = '../bob_id.json'
    config.p2pPort = '10333'
    config.otherPeer = '../alice_id.json'
    config.otherPeerPort = '10334'
}

module.exports = config
