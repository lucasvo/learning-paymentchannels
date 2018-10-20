pragma solidity ^0.4.24;
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/ECRecovery.sol";

contract ChannelManager {
    using ECRecovery for bytes32;

    uint settlementBlockNumbers = 15; // 15 blocks = 3min

    enum ChannelState {
        INITIALIZED, // 0
        PARTYA_FUNDED, // 1
        PARTYB_FUNDED, // 2
        ACTIVE, // 3
        PENDING_SETTLEMENT, // 4
        SETTLED // 5
    } 
    struct Channel {
        address partyA;
        address partyB;
        ERC20 currency;
        uint32 balance;
        ChannelState state;
        uint32 settlementBlock; // The settlement blockheight is set whenever a settlement transaction is accepted
        uint32 nonce;
        uint32 balanceA; // balanceB = balance*2-balanceA
        bool withdrawn;
    }

    mapping(bytes32 => Channel) _channels;

    function create(bytes32 channelId, address partyA, address partyB, ERC20 currency, uint32 balance) public {
        // Abort if channelId is taken
        require(_channels[channelId].partyA == address(0), "channelId is already taken"); 
       
        
        // Validate provided Channel options
        require(partyA != address(0) && partyB != address(0), "parties must be non zero addresses");

        _channels[channelId] = Channel(partyA, partyB, currency, balance, ChannelState.INITIALIZED, 0, 0);
    }

    function getDetails(bytes32 channelId) public view returns (
        address partyA, address partyB, ERC20 currency, uint32 balance, ChannelState state) {
        Channel storage channel = _channels[channelId];
        return (channel.partyA, channel.partyB, channel.currency, channel.balance, channel.state);
    }

    // fundChannel will attempt to fund the channel by calling transferFrom on 
    // the currency by withdrawing from the specified from address 
    function fund(bytes32 channelId) public {
        Channel storage channel = _channels[channelId];
        
        // Verify the sender is one of the two party and can fund the channel 
        // - An initialized channel should only allow either A or B to fund
        // - A channel funded by A should only be fundable by B
        // - A channel funded by B should only be fundable by A
        require(
           (
                channel.state == ChannelState.INITIALIZED && (
                    channel.partyA == msg.sender || 
                    channel.partyB == msg.sender) 
            ) || 
            (channel.state == ChannelState.PARTYA_FUNDED && channel.partyB == msg.sender)||
            (channel.state == ChannelState.PARTYB_FUNDED && channel.partyA == msg.sender),
            "Can't fund channel"
        );

        channel.currency.transferFrom(msg.sender, this, channel.balance);

        if (channel.state == ChannelState.INITIALIZED) {
            if (msg.sender == channel.partyA) {
                channel.state = ChannelState.PARTYA_FUNDED;
            } else {
                channel.state = ChannelState.PARTYB_FUNDED;
            }
        } else {
            channel.state = ChannelState.ACTIVE;
        }
        _channels[channelId] = channel;
    }
    // The withdraw method transfers the final amount to both parties whenever it is 
    // called and enough blocks have been mined since the last settlement transaction
    function withdraw(bytes32 channelId)  public {
        Channel storage _channel = _channels[channelId];
        require(_channel.partyA == msg.sender || channel.partyB == msg.sender, 
                "Can only be called by one of the two members");

        require(_channel.state == ChannelState.PENDING_SETTLEMENT && 
                _channel.settlementBlock + settlementBlockNumbers > block.number, 
                "channel must be in pending settlement state and more than `settlementBlockNumbers` must have passed.");
        _channel.currency.transferFrom(this, channel.partyA, channel.balanceA);
        _channel.currency.transferFrom(this, channel.partyB, channel.balance*2-channel.balanceA);
        _channel.state = ChannelState.SETTLED;
        _channels[channelId] = _channel;
    }
}
