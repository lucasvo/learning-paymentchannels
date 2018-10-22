# Make it rain, add 1000 test tokens to bob & alice's wallet
curl http://localhost:3000/mint_tokens 	

# Create a channel
curl -v -X POST --header "Content-Type: application/json" --data '{ "id": "0x0000000000000000000000000000000000000000000000000000000000000007", "counterparty": "0xc8dd3d11e112fae5c88fe1a177be24013e53c33e", "amount": 100}' http://localhost:3000/channel/ | jsonpp

# Get channel details
curl http://localhost:3000/channel/0x0000000000000000000000000000000000000000000000000000000000000007/ | jsonpp

# Fund the channel
curl -X POST http://localhost:3000/channel/0x0000000000000000000000000000000000000000000000000000000000000007/fund/ | jsonpp


# Join the channel (bob)
curl -X POST http://localhost:3001/channel/0x0000000000000000000000000000000000000000000000000000000000000007/join/ | jsonpp

# Fund the channel (bob)
curl -X POST http://localhost:3001/channel/0x0000000000000000000000000000000000000000000000000000000000000007/fund/ | jsonpp
 
# Update the channel
curl -X POST --header "Content-Type: application/json" --data '{"amount":3}' http://localhost:3001/channel/0x0000000000000000000000000000000000000000000000000000000000000007/ 


