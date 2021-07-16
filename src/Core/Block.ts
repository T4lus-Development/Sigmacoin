import * as R from 'ramda';

import * as Config from '../Config';
import * as Utils from '../Utils';

import { Transaction } from './Transaction';

/*
{ // Block
    "index": 0, // (first block: 0)
    "previousHash": "0", // (hash of previous block, first block is 0) (64 bytes)
    "timestamp": 1465154705, // number of seconds since January 1, 1970
    "nonce": 0, // nonce used to identify the proof-of-work step.
    "transactions": [ // list of transactions inside the block
        { // transaction 0
            "id": "63ec3ac02f...8d5ebc6dba", // random id (64 bytes)
            "hash": "563b8aa350...3eecfbd26b", // hash taken from the contents of the transaction: sha256 (id + data) (64 bytes)
            "type": "regular", // transaction type (regular, fee, reward)
            "data": {
                "inputs": [], // list of input transactions
                "outputs": [] // list of output transactions
            }
        }
    ],
    "hash": "c4e0b8df46...199754d1ed" // hash taken from the contents of the block: sha256 (index + previousHash + timestamp + nonce + transactions) (64 bytes)
}
*/

export default class Block {
    public index: number;
    public hash: string;
    public previousHash: string;
    public timestamp: number;
    public nonce: number;
    public transactions: Transaction[] = [];

    public toHash = () => {
        // INFO: There are different implementations of the hash algorithm, for example: https://en.bitcoin.it/wiki/Hashcash
        return Utils.Crypto.hash(this.index + this.previousHash + this.timestamp + JSON.stringify(this.transactions) + this.nonce);
    }

    public getDifficulty = () => {
        // 14 is the maximum precision length supported by javascript
        return parseInt(this.hash.substring(0, 14), 16);
    }

    public static genesis = () => {
        // The genesis block is fixed
        return Utils.JSONToObject<Block>(JSON.stringify(Config.GENESIS_BLOCK));
    }

    public static fromJson = (data) => {
        let block: Block = Utils.JSONToObject<Block>(JSON.stringify(data))

        block.hash = block.toHash();
        return block;
    }

}