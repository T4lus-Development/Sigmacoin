
import Block from './Core/Block';
import { Transaction, TransactionType, TxIn, TxOut } from './Core/Transaction';

const PORT_HTTP: number =                                   3001;
const PORT_P2P: number =                                    6001;

const BLOCK_GENERATION_INTERVAL: number =                   60;                                             // in seconds
const DIFFICULTY_ADJUSTMENT_INTERVAL: number =              12;                                             // in blocks
const EXPECTED_NUMBER_OF_BLOCKS_PER_DAY: number =           24 * 60 * 60 / BLOCK_GENERATION_INTERVAL;

const BLOCK_REWARD: number =                                50;

const genesisBlock: Block = new Block(
    0, 
    '91a73664bc84c0baa1fc75ea6e4aa6d1d20c5df664c724e3159aefc2e1186627', 
    '', 
    1465154705, 
    [
        new Transaction(
            'e655f6a5f26dc9b4cac6e46f52336428287759cf81ef5ff10854f69d68f43fa3',
            TransactionType.REWARD,
            [new TxIn('', '', 0)],
            [new TxOut('04bfcab8722991ae774db48f934ca79cfb7dd991229153b9f732ba5334aafcd8e7266e47076996b55a14bf9913ee3145ce0cfc1372ada8ada74bd287450313534a', 50)]
        )
    ], 
    0, 
    0
);

const PRIVATE_KEY_LOCATION: string =                        'node/wallets/private_key';
const CHAIN_LOCATION: string =                              'node/chain/';

const DEFAULT_PEERS: string[] = [

];

export {
    PORT_HTTP,
    PORT_P2P,

    BLOCK_GENERATION_INTERVAL, 
    DIFFICULTY_ADJUSTMENT_INTERVAL,
    EXPECTED_NUMBER_OF_BLOCKS_PER_DAY,

    BLOCK_REWARD,

    genesisBlock,

    PRIVATE_KEY_LOCATION,
    CHAIN_LOCATION,

    DEFAULT_PEERS
}