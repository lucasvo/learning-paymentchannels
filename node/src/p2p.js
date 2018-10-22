const PeerId = require('peer-id')
const PeerInfo = require('peer-info')
const Node = require('./libp2p-bundle')
const pull = require('pull-stream')
const series = require('async/series')
const async = require('async')
const libp2pCrypto = require('libp2p-crypto')
const keysPBM = libp2pCrypto.keys.keysPBM
const randomBytes = libp2pCrypto.randomBytes
const libp2pCryptoSecp256k1 = require('libp2p-crypto-secp256k1')(keysPBM, randomBytes)

const config = require('../config')

async function getPeerId() {
    let promise = new Promise(async (resolve, reject) => {
	PeerId.createFromJSON(require(config.p2pId), (err, id) => {
	      if (err) { return reject(err) }
	      resolve(id)
	})
    })
    return promise
}

async function startListener() {
    let promise = new Promise(async (resolve, reject) => {
	let peerId = await getPeerId()
	const listenerPeerInfo = new PeerInfo(peerId)
	listenerPeerInfo.multiaddrs.add('/ip4/127.0.0.1/tcp/'+config.p2pPort)
	listenerNode = new Node({
	    peerInfo: listenerPeerInfo
	})
	listenerNode.on('peer:connect', (peerInfo) => {
	    console.log('received message to me from:', peerInfo.id.toB58String())
	})
	listenerNode.handle('/message', (protocol, conn) => {
	    // TODO: Implement p2p protocol
	    pull(conn, conn)
	})
	listenerNode.start((err) => {
	    if (err) {
		reject()
		return
	    }
	    console.log('Listener ready, listening on:')
	    listenerNode.peerInfo.multiaddrs.forEach((ma) => {
		console.log('   ', ma.toString() + '/ipfs/' + peerId.toB58String())
		})

	    resolve(listenerNode)
	})
    })
    return promise
}

// sendMessage transmits a string to a peer
function sendMessage(p2pId, port, otherPeer, otherPeerPort, message) {
    async.parallel([
      (cb) => PeerId.createFromJSON(require(p2pId), cb),
      (cb) => PeerId.createFromJSON(require(otherPeer), cb)
    ], (err, ids) => {
      if (err) { throw err }

      // Dialer
      const dialerId = ids[0]
      const dialerPeerInfo = new PeerInfo(dialerId)
      dialerPeerInfo.multiaddrs.add('/ip4/0.0.0.0/tcp/0')
      const dialerNode = new Node({
	peerInfo: dialerPeerInfo
      })

      // Peer to Dial
      const listenerPeerInfo = new PeerInfo(ids[1])
      const listenerId = ids[1]
      const listenerMultiaddr = '/ip4/127.0.0.1/tcp/'+otherPeerPort+'/ipfs/' +
	  listenerId.toB58String()
      listenerPeerInfo.multiaddrs.add(listenerMultiaddr)

      dialerNode.start((err) => {
	if (err) { throw err }

	console.log('Dialer ready, listening on:')
	dialerPeerInfo.multiaddrs.forEach((ma) => console.log(ma.toString() +
	      '/ipfs/' + dialerId.toB58String()))

	console.log('Dialing to peer:', listenerMultiaddr.toString())
	dialerNode.dialProtocol(listenerPeerInfo, '/message', (err, conn) => {
	  if (err) { throw err }

	  pull(
	    pull.values([message]),
	    conn,
	    pull.collect((err, data) => {
	      if (err) { throw err }
	      console.log('received:', data.toString())
	    })
	  )
	})
      })
    })
}

module.exports = {
    startListener: startListener,
    sendMessage: sendMessage,
}
