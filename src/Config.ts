

const SALT: string =                                        '0ffaa74d206930aaece253f090c88dbe6685b9e66ec49ad988d84fd7dff230d1';

const PORT_HTTP: number =                                   3001;
const PORT_P2P: number =                                    6001;

// Proof-of-work difficulty settings
const BLOCK_REWARD: number =                                50;
const BASE_DIFFICULTY: number =                             Number.MAX_SAFE_INTEGER;
const EVERY_X_BLOCKS: number =                              5;
const POW_CURVE: number =                                   5;

const TRANSACTIONS_PER_BLOCK: number =                      25;
const FEE_PER_TRANSACTION: number =                         0.5;


const GENESIS_BLOCK = 
{
    'index': 0, 
    'hash': '91a73664bc84c0baa1fc75ea6e4aa6d1d20c5df664c724e3159aefc2e1186627', 
    'previousHash': '', 
    'timestamp': 1465154705, 
    'nonce': 0,
    'transactions': [
        {
            'id' : '63ec3ac02f822450039df13ddf7c3c0f19bab4acd4dc928c62fcd78d5ebc6dba',
            'hash': 'e655f6a5f26dc9b4cac6e46f52336428287759cf81ef5ff10854f69d68f43fa3',
            'type': 0,
            'data': {
                'inputs': [],
                'outputs': []
            }
        }    
    ]
};


const PRIVATE_KEY_LOCATION: string =                        'node/wallets/private_key';
const CHAIN_LOCATION: string =                              'node/chain/';

const DEFAULT_PEERS: string[] = [

];

export {
    SALT,

    PORT_HTTP,
    PORT_P2P,

    BLOCK_REWARD,
    BASE_DIFFICULTY,
    EVERY_X_BLOCKS,
    POW_CURVE,

    TRANSACTIONS_PER_BLOCK,
    FEE_PER_TRANSACTION,

    GENESIS_BLOCK,

    PRIVATE_KEY_LOCATION,
    CHAIN_LOCATION,

    DEFAULT_PEERS
}