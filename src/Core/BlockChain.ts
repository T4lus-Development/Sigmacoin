import {existsSync, readFileSync, unlinkSync, writeFileSync} from 'fs';
import * as CryptoJS from 'crypto-js';
import * as _ from 'lodash';

import * as Config from '../Config';
import Utils from '../Utils';
import Address from './Address';
import Block from './Block';
import {Transaction, UnspentTxOut} from './Transaction';
import TransactionPool from './TransactionPool';

import Wallet from '../Wallet/Wallet';

import P2pServer from '../P2P/P2pServer';

export default class BlockChain {
    private static instance: BlockChain;

    private chain: Block[] = [];
    private unspentTxOuts: UnspentTxOut[] = [];

    private constructor() {
        this.loadChain();
    }

    public static getInstance = (): BlockChain => {
        if (!BlockChain.instance) {
            BlockChain.instance = new BlockChain();
        }
        return BlockChain.instance;
    }

    public getBlockchain = (): Block[] => this.chain;

    public getUnspentTxOuts = (): UnspentTxOut[] => _.cloneDeep(this.unspentTxOuts);

    // and txPool should be only updated at the same time
    public setUnspentTxOuts = (newUnspentTxOut: UnspentTxOut[]) => {
        console.log('replacing unspentTxouts with: %s', newUnspentTxOut);
        this.unspentTxOuts = newUnspentTxOut;
    };

    public getLatestBlock = (): Block => this.chain[this.chain.length - 1];

    public getDifficulty = (aBlockchain: Block[]): number => {
        const latestBlock: Block = aBlockchain[this.chain.length - 1];
        if (latestBlock.index % Config.DIFFICULTY_ADJUSTMENT_INTERVAL === 0 && latestBlock.index !== 0) {
            return this.getAdjustedDifficulty(latestBlock, aBlockchain);
        } else {
            return latestBlock.difficulty;
        }
    };

    public getAdjustedDifficulty = (latestBlock: Block, aBlockchain: Block[]) => {
        const prevAdjustmentBlock: Block = aBlockchain[this.chain.length - Config.DIFFICULTY_ADJUSTMENT_INTERVAL];
        const timeExpected: number = Config.BLOCK_GENERATION_INTERVAL * Config.DIFFICULTY_ADJUSTMENT_INTERVAL;
        const timeTaken: number = latestBlock.timestamp - prevAdjustmentBlock.timestamp;

        if (timeTaken < timeExpected / 2) {
            return prevAdjustmentBlock.difficulty + 1;
        } else if (timeTaken > timeExpected * 2) {
            return prevAdjustmentBlock.difficulty - 1;
        } else {
            return prevAdjustmentBlock.difficulty;
        }
    };

    public generateNextBlock = () => {
        const coinbaseTx: Transaction = Transaction.getRewardTransaction(Wallet.getInstance().getPublic(), this.getLatestBlock().index + 1);
        const blockData: Transaction[] = [coinbaseTx].concat(TransactionPool.getInstance().getPool());
        return this.generateRawNextBlock(blockData);
    };

    public generateRawNextBlock = (blockData: Transaction[]) => {
        const previousBlock: Block = this.getLatestBlock();
        const difficulty: number = this.getDifficulty(this.getBlockchain());
        const nextIndex: number = previousBlock.index + 1;
        const nextTimestamp: number = Utils.getCurrentTimestamp();
        const newBlock: Block = this.findBlock(nextIndex, previousBlock.hash, nextTimestamp, blockData, difficulty);

        if (this.addBlockToChain(newBlock)) {
            P2pServer.getInstance().broadcastLatest();
            return newBlock;
        } else {
            return null;
        }
    };

    public generatenextBlockWithTransaction = (receiverAddress: string, amount: number) => {
        if (!Address.isValid(receiverAddress)) {
            throw Error('invalid address');
        }
        if (typeof amount !== 'number') {
            throw Error('invalid amount');
        }
        const coinbaseTx: Transaction = Transaction.getRewardTransaction(Wallet.getInstance().getPublic(), this.getLatestBlock().index + 1);
        const tx: Transaction = Wallet.getInstance().createTransaction(receiverAddress, amount, Wallet.getInstance().getPrivate(), this.getUnspentTxOuts(), TransactionPool.getInstance().getPool());
        const blockData: Transaction[] = [coinbaseTx, tx];
        return this.generateRawNextBlock(blockData);
    };

    // gets the unspent transaction outputs owned by the wallet
    public getMyUnspentTransactionOutputs = () => {
        return Wallet.getInstance().findUnspentTxOuts(Wallet.getInstance().getPublic(), this.getUnspentTxOuts());
    };

    public findBlock = (index: number, previousHash: string, timestamp: number, data: Transaction[], difficulty: number): Block => {
        let nonce = 0;
        while (true) {
            const hash: string = this.calculateHash(index, previousHash, timestamp, data, difficulty, nonce);
            if (this.hashMatchesDifficulty(hash, difficulty)) {
                return new Block(index, hash, previousHash, timestamp, data, difficulty, nonce);
            }
            nonce++;
        }
    };

    public calculateHashForBlock = (block: Block): string => {
        return this.calculateHash(block.index, block.previousHash, block.timestamp, block.data, block.difficulty, block.nonce);
    }
        
    public calculateHash = (index: number, previousHash: string, timestamp: number, data: Transaction[], difficulty: number, nonce: number): string => {
        return CryptoJS.SHA256(index + previousHash + timestamp + data + difficulty + nonce).toString();
    }

    public hasValidHash = (block: Block): boolean => {

        if (!this.hashMatchesBlockContent(block)) {
            console.log('invalid hash, got:' + block.hash);
            return false;
        }
    
        if (!this.hashMatchesDifficulty(block.hash, block.difficulty)) {
            console.log('block difficulty not satisfied. Expected: ' + block.difficulty + 'got: ' + block.hash);
        }
        return true;
    };
    
    public hashMatchesBlockContent = (block: Block): boolean => {
        const blockHash: string = this.calculateHashForBlock(block);
        return blockHash === block.hash;
    };
    
    public hashMatchesDifficulty = (hash: string, difficulty: number): boolean => {
        const hashInBinary: string = Utils.hexToBinary(hash);
        const requiredPrefix: string = '0'.repeat(difficulty);
        return hashInBinary.startsWith(requiredPrefix);
    };

    public getAccumulatedDifficulty = (aBlockchain: Block[]): number => {
        return aBlockchain
            .map((block) => block.difficulty)
            .map((difficulty) => Math.pow(2, difficulty))
            .reduce((a, b) => a + b);
    };

    //@TODO : Remove
    public getAccountBalance = (): number => {
        return Wallet.getInstance().getBalance(Wallet.getInstance().getPublic(), this.getUnspentTxOuts());
    };
    
    public sendTransaction = (address: string, amount: number): Transaction => {
        const tx: Transaction = Wallet.getInstance().createTransaction(address, amount, Wallet.getInstance().getPrivate(), this.getUnspentTxOuts(), TransactionPool.getInstance().getPool());
        TransactionPool.getInstance().addToPool(tx, this.getUnspentTxOuts());
        P2pServer.getInstance().broadCastTransactionPool();
        return tx;
    };

    public isValidBlockStructure = (block: Block): boolean => {
        return typeof block.index === 'number'
            && typeof block.hash === 'string'
            && typeof block.previousHash === 'string'
            && typeof block.timestamp === 'number'
            && typeof block.data === 'object';
    };

    public isValidNewBlock = (newBlock: Block, previousBlock: Block): boolean => {
        if (!this.isValidBlockStructure(newBlock)) {
            console.log('invalid block structure: %s', JSON.stringify(newBlock));
            return false;
        }
        if (previousBlock.index + 1 !== newBlock.index) {
            console.log('invalid index');
            return false;
        } else if (previousBlock.hash !== newBlock.previousHash) {
            console.log('invalid previoushash');
            return false;
        } else if (!Utils.isValidTimestamp(newBlock, previousBlock)) {
            console.log('invalid timestamp');
            return false;
        } else if (!this.hasValidHash(newBlock)) {
            return false;
        }
        return true;
    };

    /*
    Checks if the given blockchain is valid. Return the unspent txOuts if the chain is valid
    */
    public isValidChain = (blockchainToValidate: Block[]): UnspentTxOut[] => {
        console.log('isValidChain:');
        console.log(JSON.stringify(blockchainToValidate));
        const isValidGenesis = (block: Block): boolean => {
            return JSON.stringify(block) === JSON.stringify(Config.genesisBlock);
        };

        if (!isValidGenesis(blockchainToValidate[0])) {
            return null;
        }
        /*
        Validate each block in the chain. The block is valid if the block structure is valid
        and the transaction are valid
        */
        let aUnspentTxOuts: UnspentTxOut[] = [];

        for (let i = 0; i < blockchainToValidate.length; i++) {
            const currentBlock: Block = blockchainToValidate[i];
            if (i !== 0 && !this.isValidNewBlock(blockchainToValidate[i], blockchainToValidate[i - 1])) {
                return null;
            }

            aUnspentTxOuts = Transaction.processTransactions(currentBlock.data, aUnspentTxOuts, currentBlock.index);
            if (aUnspentTxOuts === null) {
                console.log('invalid transactions in blockchain');
                return null;
            }
        }
        return aUnspentTxOuts;
    };

    public addBlockToChain = (newBlock: Block): boolean => {
        if (newBlock == Config.genesisBlock || this.isValidNewBlock(newBlock, this.getLatestBlock())) {
            const retVal: UnspentTxOut[] = Transaction.processTransactions(newBlock.data, this.getUnspentTxOuts(), newBlock.index);
            if (retVal === null) {
                console.log('block is not valid in terms of transactions');
                return false;
            } else {
                this.chain.push(newBlock);
                this.setUnspentTxOuts(retVal);
                TransactionPool.getInstance().updatePool(this.unspentTxOuts);

                writeFileSync(Config.CHAIN_LOCATION + newBlock.index + '.block', JSON.stringify(newBlock));
                writeFileSync(Config.CHAIN_LOCATION + 'chain.idx', newBlock.index.toString());

                return true;
            }
        }
        return false;
    };

    public replaceChain = (newBlocks: Block[]) => {
        const aUnspentTxOuts = this.isValidChain(newBlocks);
        const validChain: boolean = aUnspentTxOuts !== null;
        if (validChain && this.getAccumulatedDifficulty(newBlocks) > this.getAccumulatedDifficulty(this.getBlockchain())) {
            console.log('Received blockchain is valid. Replacing current blockchain with received blockchain');
            this.chain = newBlocks;
            this.setUnspentTxOuts(aUnspentTxOuts);
            TransactionPool.getInstance().updatePool(this.unspentTxOuts);
            P2pServer.getInstance().broadcastLatest();
            this.saveChain();
        } else {
            console.log('Received blockchain invalid');
        }
    };

    public handleReceivedTransaction = (transaction: Transaction) => {
        TransactionPool.getInstance().addToPool(transaction, this.getUnspentTxOuts());
    };

    public loadChain = () => {
        if (!existsSync(Config.CHAIN_LOCATION + 'chain.idx')) {
            this.chain = [Config.genesisBlock];
            this.unspentTxOuts = Transaction.processTransactions(this.chain[0].data, [], 0); // the unspent txOut of genesis block is set to unspentTxOuts on startup

            writeFileSync(Config.CHAIN_LOCATION + '0.block', JSON.stringify(Config.genesisBlock));
            writeFileSync(Config.CHAIN_LOCATION + 'chain.idx', '0');
            return;
        }

        const blockIndex = Number.parseInt(readFileSync(Config.CHAIN_LOCATION + 'chain.idx', 'utf8').toString());
        for (let i = 0; i <= blockIndex; i++)
        {
            this.chain.push(
                Utils.JSONToObject<Block>(readFileSync(Config.CHAIN_LOCATION + i + '.block', 'utf8').toString())
            );
        }
    }

    public saveChain = () => {
        writeFileSync(Config.CHAIN_LOCATION + 'chain.idx', this.chain.length.toString());            
        this.chain.forEach((block) => {
            writeFileSync(Config.CHAIN_LOCATION + block.index + '.block', JSON.stringify(block));
        }); 
    }

}