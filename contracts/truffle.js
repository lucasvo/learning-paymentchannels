module.exports = {
    networks: {
        development: { // running against ganache with default port
            host: "localhost",
            port: 8545,
            network_id: "*",
            from: "0xd77c534aed04d7ce34cd425073a033db4fbe6a9d", // first account with mnemonic configured in package.json
            gas: 4712388
        },
    }
};

