import * as Utils from '../Utils';

import { Transaction } from "./Transaction";

export default class Block {

    public index: number;
    public hash: string;
    public previousHash: string;
    public timestamp: number;
    public data: Transaction[];
    public difficulty: number;
    public nonce: number;

    constructor(index: number, hash: string, previousHash: string, timestamp: number, data: Transaction[], difficulty: number, nonce: number) {
        this.index = index;
        this.previousHash = previousHash;
        this.timestamp = timestamp;
        this.data = data;
        this.hash = hash;
        this.difficulty = difficulty;
        this.nonce = nonce;
    }

    public toHash = () => {
        // INFO: There are different implementations of the hash algorithm, for example: https://en.bitcoin.it/wiki/Hashcash
        return Utils.Crypto.hash(this.index + this.previousHash + this.timestamp + JSON.stringify(this.data) + this.nonce);
    }

    public getDifficulty = () => {
        // 14 is the maximum precision length supported by javascript
        return parseInt(this.hash.substring(0, 14), 16);
    }
}