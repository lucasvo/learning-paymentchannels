const express = require('express')
const Web3 = require('web3')
const contract = require('truffle-contract')
const bodyParser = require('body-parser')
const Datastore = require('nedb-promises')

const testTokenContractAbi = require('../../contracts/build/contracts/TestToken.json')
const channelManagerContractAbi = require('../../contracts/build/contracts/ChannelManager.json')
const config = require('../config')
const p2p = require('./p2p')

// Setting up express.js App
const app = express()
app.use(bodyParser.json()) // for parsing application/json
const db = Datastore.create(config.db)
let p2pNode = null;

// Getting the channel state from the local db, create if it doesn't exist
async function getChannel(id, create) {
    // Get Channel from local key value store
    let docs = await db.find({'id':id})
    let record = null
    if (docs.length > 0) {
        record = docs[0]
    } else if (docs.length == 0 && create) {
        record = {'id': id}
    } else {// no record found and not creating either
        return null
    }
    // Get channel status on chain and update record
    return channelManager.methods.getDetails(record.id).call().then((data) => {
        record.partyA = data[0]
        record.partyB = data[1]
        record.amount = data[3]
        record.state = data[4]
        return record
    }).catch((err) => {
        return null
    })
}

// Update channel state on local db
async function updateChannel(channel) {
    return db.update({id: channel.id}, channel)
}

// the channel state enum is defined in the ChannelManager contract
channelState = {
    0: 'initialized',
    1: 'partyA_funded',
    2: 'partyB_funded',
    3: 'active',
    4: 'pending_settlement',
    5: 'settled',
}
function channelJson(channel) {
    // Map channel state to human readable form
    channel.state = channelState[channel.state]
    return channel
}


// Contracts
var web3 = new Web3(
    new Web3.providers.HttpProvider(config.web3ProviderUrl)
)
const testToken = new web3.eth.Contract(testTokenContractAbi['abi'], config.testTokenAddress)
const channelManager = new web3.eth.Contract(channelManagerContractAbi['abi'], config.channelManagerAddress)


// Mint ERC20 TestToken
// This is simply a helper to mint 1000 test tokens for both alice & bob. TestToken makes use of open-zeppelin's mintable ERC20 contract which exposes a minter role and a mint method to do this.
app.get('/mint_tokens', async function (req, res) {
    let txOpts = {from: config.contacts.alice.account, gas: 200000}
    await testToken.methods.addMinter(config.contacts.alice.account).send(txOpts)
    await testToken.methods.mint(config.contacts.alice.account, 1000).send(txOpts)
    await testToken.methods.mint(config.contacts.bob.account, 1000).send(txOpts)
    res.send("Minted")
})

// Creates a channel
// Expects the following JSON Payload:
// { "channelId": "0x01", "counterparty": "0xc8dd3d66e112fae5c88fe6a677be24013e53c33e", "amount": 100}
app.post('/channel/', async function (req, res) {
    // Helper: automatically pad channel id to 64 characters + "0x"
    let id = web3.utils.padLeft(req.body.id, 64)
    channel = {
        id: req.body.id,
        counterparty: req.body.counterparty,
        balance: req.body.amount,
        amount: req.body.amount,
        state: 0,
        nonce: 0,
        messages: {},
    }

    let channelTx = await channelManager.methods.create(
        id,
        config.wallet,
        req.body.counterparty,
        config.testTokenAddress,
        req.body.amount
    ).send({from: config.wallet, gas: 200000})
    await db.insert(channel)
    res.json(channelJson(channel))
})

// Joins a channel by fetching details from Ethereum and storing it in the local database
app.post('/channel/:id/join/', async function (req, res) {
    let channel = await getChannel(req.params.id, true)
    channel.balance = channel.amount
    if (channel.partyA == config.wallet) {
        channel.counterparty = channel.partyB
    } else {
        channel.counterparty = channel.partyA
    }
    await db.insert(channel)
    res.json(channelJson(channel))
})

app.post('/channel/:id/fund/', async function (req, res) {
    let channel = await getChannel(req.params.id)
    if (channel == null) {
        res.status(400).json({"error": "can't get channel info"})
        return
    }
    await testToken.methods.approve(config.channelManagerAddress, channel.amount)
        .send({from: config.wallet, gas: 200000}).then(function (resp) {
            console.log("testToken approved")
            console.log("Calling fund from", config.wallet)
            return channelManager.methods.fund(channel.id).send({from: config.wallet, gas: 200000})
        }).then(async function (resp) {
            console.log("Channel funded")
            channel = await getChannel(channel.id)
            res.json(channelJson(channel))
            return
        }).catch(function (err) {
            console.log("ERR", err)
            res.status(400).json({"error": "Unknown error"})
        })
})

// Get channel status
app.get('/channel/:id/', async function (req, res) {
    console.log("Get channel details", req.params.id)
    let channel = await getChannel(req.params.id)
    res.json(channelJson(channel))
})

// messageString creates the signature input
function messageString(channel, nonce, balance, sender) {
    // Pad and convert to bytes
    let payload = web3.utils.hexToBytes(web3.utils.padLeft(channel, 64));
    payload += web3.utils.hexToBytes(web3.utils.padLeft(nonce, 8))
    payload += web3.utils.hexToBytes(web3.utils.padLeft(balance, 8))
    payload += sender
    return payload
}

// Update the channel with a new balance
app.post('/channel/:channelId/', async function (req, res) {
    console.log("Update channel", req.params.id)

    let amount = req.body.amount
    let channel = await getChannel(req.params.channelId)
    if (amount > channel.balance) {
        res.send({"error": "Channel balance insufficient"})
    }
    if (channel.state != 3) { // 3 = active
        res.send({"error": "Channel not active"})
    }
    channel.nonce = channel.nonce+1
    channel.balance = amount

    let signature = web3.eth.sign(config.wallet, messageString(channel.id, channel.balance, channel.nonce, config.wallet))

    let message = {
        channel: channel.id,
        balanceA: amount,
        nonce: nonce,
        signature: signature, // signature is channel, balance, nonce, address
    }

    p2p.sendMessage(config.p2pId, config.p2pPort, config.otherPeer, config.otherPeerPort, JSON.stringify(message))

    channel.messages[nonce] = message
    updateChannel(channel)
    res.json(message);
})

// Settle the channel on chain
app.post('/channel/:channelId/settle/', (req, res) => {
    res.send('Not implemented');
})

app.listen(config.port, () => console.log(`Node listening on port ${config.port}!`))

// Setting up p2p
p2pNode = p2p.startListener()

