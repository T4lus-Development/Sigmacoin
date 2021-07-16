
enum MessageType {
    HANDSHAKE_QUERY             = 0,
    HANDSHAKE_RESPONSE          = 1,
    QUERY_LATEST                = 2,
    QUERY_ALL                   = 3,
    RESPONSE_BLOCKCHAIN         = 4,
    QUERY_TRANSACTION_POOL      = 5,
    RESPONSE_TRANSACTION_POOL   = 6
}

class Message {
    public type: MessageType;
    public data: any;
}

export {
    Message,
    MessageType
}