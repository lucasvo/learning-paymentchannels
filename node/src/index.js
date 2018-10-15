const express = require('express')
const Web3 = require('web3')
const contract = require('truffle-contract')
const bodyParser = require('body-parser')
const Datastore = require('nedb-promises')

const testTokenContractAbi = require('../../contracts/build/contracts/TestToken.json')
const channelManagerContractAbi = require('../../contracts/build/contracts/ChannelManager.json')
const config = require('../config.js')

// Setting up express.js App
const app = express()
app.use(bodyParser.json()) // for parsing application/json
const db = Datastore.create(config.db)

// Getting the channel state from the local store
async function getChannel(id) {
    // Get Channel from local key value store
    let docs = await db.find({'id':id})
    if (docs.length == 0) {
        return null
    }
    let record = docs[0]

    // Get channel status on chain and update record
    return channelManager.methods.getChannelDetails(record.id).call().then((data) => {
        record.partyA = resp[0]
        record.partyB = resp[1]
        record.amount = resp[3]
        record.state = resp[4]
        return record
    }).catch((err) => {
        return null
    })
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

// Creates a channel and funds it
// Expects the following JSON Payload:
// { "channelId": "0x01", "counterparty": "0xc8dd3d66e112fae5c88fe6a677be24013e53c33e", "amount": 100}
app.post('/channel/', async function (req, res) {
    let id = web3.utils.hexToUtf8(req.body.channelId)
    if (id.length != 32) {
        res.json({"error": "Invalid length for ID"})
        return
    }
    channel = {
        id: req.body.channelId,
        counterparty: req.body.counterparty,
        balance: req.body.amount,
        amount: req.body.amount,
        state: 0,
        nonce: 0,
        messages: {},
    }

    let channelTx = await channelManager.methods.createChannel(
        req.body.channelId,
        config.wallet,
        req.body.counterparty,
        config.testTokenAddress,
        req.body.amount
    ).send({from: config.wallet, gas: 100000})
    await db.insert(channel)
    res.json(channelJson(channel))
})

app.post('/channel/:channelId/fund/', async function (req, res) {
    let channel = await getChannel(req.params.channelId)
    await testToken.methods.approve(config.channelManagerAddress, channel.amount)
    await channelManager.methods.fundChannel(channel.id).send({from: config.wallet})
    channel = await getChannel(channel.id)
    res.json(channelJson(channel))
})

// Get channel status
app.get('/channel/:channelId/', async function (req, res) {
    let channel = await getChannel(req.params.channelId)
    res.json(channelJson(channel))
})



// messageString creates the signature input
function messageString(channel, nonce, balance, sender) {
    let payload = channel;
    payload += web3.utils.padLeft(nonce, 64)
    payload += web3.utils.padLeft(balance, 64)
    payload += sender
    return payload
}


// Update the channel with a new balance
app.post('/channel/:channelId/', (req, res) => {
    let amount = req.boyd.amount
    let channel = await getChannel(req.params.channelId)
    if (amount > channel.balance) {
        res.send({"error": "Channel balance insufficient"})
    }
    if (channel.state != 3) { // 3 = active
        res.send({"error": "Channel not active"})
    }
    channel.nonce = channel.nonce+1
    channel.balance = channel.balance-amount

    let signature = web3.eth.sign(config.wallet, messageString(channel.id, channel.balance, channel.nonce, config.wallet))

    message = {
        channel: channel.id,
        balance: channel.balance-amount,
        nonce: nonce,
        signature: signature, // signature is channel, balance, nonce
    }
    // TODO: transmit signature to counterparty
    res.json(message);
})

// Settle the channel on chain
app.post('/channel/:channelId/settle', (req, res) => {
    res.send('Not implemented');
})

app.listen(config.port, () => console.log(`Node listening on port ${config.port}!`))
