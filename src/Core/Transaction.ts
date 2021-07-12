import * as CryptoJS from 'crypto-js';
import * as elliptic from 'elliptic';
import * as _ from 'lodash';

import * as Config from '../Config';
import Utils from '../Utils';
import Address from './Address';

const ec = new elliptic.eddsa('ed25519');

class UnspentTxOut {
    public readonly txOutId: string;
    public readonly txOutIndex: number;
    public readonly address: string;
    public readonly amount: number;

    constructor(txOutId: string, txOutIndex: number, address: string, amount: number) {
        this.txOutId = txOutId;
        this.txOutIndex = txOutIndex;
        this.address = address;
        this.amount = amount;
    }
}

class TxIn {
    public txOutId: string;
    public txOutIndex: number;
    public signature: string;

    public constructor(signature:string, txOutId:string, txOutIndex:number) {
        this.signature = signature;
        this.txOutId = txOutId;
        this.txOutIndex = txOutIndex;
    }
}

class TxOut {
    public address: string;
    public amount: number;

    constructor(address: string, amount: number) {
        this.address = address;
        this.amount = amount;
    }
}

enum TransactionType {
    NORMAL = 0,
    FEE = 1,
    REWARD = 2
}

class Transaction {
    public id: string;
    public type: TransactionType;
    public txIns: TxIn[];
    public txOuts: TxOut[];

    public constructor(id?:string, type?:TransactionType, txIns?:TxIn[], txOuts?:TxOut[]) {
        this.id = id;
        this.type = type;
        this.txIns = txIns;
        this.txOuts = txOuts;
    }

    static getTransactionId = (transaction: Transaction): string => {
        const txInContent: string = transaction.txIns
            .map((txIn: TxIn) => txIn.txOutId + txIn.txOutIndex)
            .reduce((a, b) => a + b, '');
    
        const txOutContent: string = transaction.txOuts
            .map((txOut: TxOut) => txOut.address + txOut.amount)
            .reduce((a, b) => a + b, '');
    
        return CryptoJS.SHA256(txInContent + txOutContent).toString();
    };

    static validateTransaction = (transaction: Transaction, aUnspentTxOuts: UnspentTxOut[]): boolean => {
        if (!Transaction.isValidTransactionStructure(transaction)) {
            return false;
        }
    
        if (Transaction.getTransactionId(transaction) !== transaction.id) {
            console.log('invalid tx id: ' + transaction.id);
            return false;
        }
        const hasValidTxIns: boolean = transaction.txIns
            .map((txIn) => Transaction.validateTxIn(txIn, transaction, aUnspentTxOuts))
            .reduce((a, b) => a && b, true);
    
        if (!hasValidTxIns) {
            console.log('some of the txIns are invalid in tx: ' + transaction.id);
            return false;
        }
    
        const totalTxInValues: number = transaction.txIns
            .map((txIn) => Transaction.getTxInAmount(txIn, aUnspentTxOuts))
            .reduce((a, b) => (a + b), 0);
    
        const totalTxOutValues: number = transaction.txOuts
            .map((txOut) => txOut.amount)
            .reduce((a, b) => (a + b), 0);
    
        if (totalTxOutValues !== totalTxInValues) {
            console.log('totalTxOutValues !== totalTxInValues in tx: ' + transaction.id);
            return false;
        }
    
        return true;
    };

    static validateBlockTransactions = (aTransactions: Transaction[], aUnspentTxOuts: UnspentTxOut[], blockIndex: number): boolean => {
        const coinbaseTx = aTransactions[0];
        if (!Transaction.validateCoinbaseTx(coinbaseTx, blockIndex)) {
            console.log('invalid coinbase transaction: ' + JSON.stringify(coinbaseTx));
            return false;
        }
    
        // check for duplicate txIns. Each txIn can be included only once
        const txIns: TxIn[] = _(aTransactions)
            .map((tx) => tx.txIns)
            .flatten()
            .value();
    
        if (Transaction.hasDuplicates(txIns)) {
            return false;
        }
    
        // all but coinbase transactions
        const normalTransactions: Transaction[] = aTransactions.slice(1);
        return normalTransactions.map((tx) => Transaction.validateTransaction(tx, aUnspentTxOuts))
            .reduce((a, b) => (a && b), true);
    
    };

    static hasDuplicates = (txIns: TxIn[]): boolean => {
        const groups = _.countBy(txIns, (txIn: TxIn) => txIn.txOutId + txIn.txOutIndex);
        return _(groups)
            .map((value, key) => {
                if (value > 1) {
                    console.log('duplicate txIn: ' + key);
                    return true;
                } else {
                    return false;
                }
            })
            .includes(true);
    };

    static validateCoinbaseTx = (transaction: Transaction, blockIndex: number): boolean => {
        if (transaction == null) {
            console.log('the first transaction in the block must be coinbase transaction');
            return false;
        }
        if (Transaction.getTransactionId(transaction) !== transaction.id) {
            console.log('invalid coinbase tx id: ' + transaction.id);
            return false;
        }
        if (transaction.txIns.length !== 1) {
            console.log('one txIn must be specified in the coinbase transaction');
            return;
        }
        if (transaction.txIns[0].txOutIndex !== blockIndex) {
            console.log('the txIn signature in coinbase tx must be the block height');
            return false;
        }
        if (transaction.txOuts.length !== 1) {
            console.log('invalid number of txOuts in coinbase transaction');
            return false;
        }
        if (transaction.txOuts[0].amount !== Config.BLOCK_REWARD) {
            console.log('invalid coinbase amount in coinbase transaction');
            return false;
        }
        return true;
    };

    static validateTxIn = (txIn: TxIn, transaction: Transaction, aUnspentTxOuts: UnspentTxOut[]): boolean => {
        const referencedUTxOut: UnspentTxOut = aUnspentTxOuts.find((uTxO) => uTxO.txOutId === txIn.txOutId && uTxO.txOutIndex === txIn.txOutIndex);
        if (referencedUTxOut == null) {
            console.log('referenced txOut not found: ' + JSON.stringify(txIn));
            return false;
        }
        const address = referencedUTxOut.address;
    
        const key = ec.keyFromPublic(address, 'hex');
        const validSignature: boolean = key.verify(transaction.id, txIn.signature);
        if (!validSignature) {
            console.log('invalid txIn signature: %s txId: %s address: %s', txIn.signature, transaction.id, referencedUTxOut.address);
            return false;
        }
        return true;
    };

    static getTxInAmount = (txIn: TxIn, aUnspentTxOuts: UnspentTxOut[]): number => {
        return Transaction.findUnspentTxOut(txIn.txOutId, txIn.txOutIndex, aUnspentTxOuts).amount;
    };

    static findUnspentTxOut = (transactionId: string, index: number, aUnspentTxOuts: UnspentTxOut[]): UnspentTxOut => {
        return aUnspentTxOuts.find((uTxO) => uTxO.txOutId === transactionId && uTxO.txOutIndex === index);
    };

    static getRewardTransaction = (address: string, blockIndex: number): Transaction => {
        const t = new Transaction();
        const txIn: TxIn = new TxIn('', '', blockIndex);
    
        t.txIns = [txIn];
        t.txOuts = [new TxOut(address, Config.BLOCK_REWARD)];
        t.type = TransactionType.REWARD;
        t.id = Transaction.getTransactionId(t);
        return t;
    };

    static signTxIn = (transaction: Transaction, txInIndex: number, privateKey: string, aUnspentTxOuts: UnspentTxOut[]): string => {
        const txIn: TxIn = transaction.txIns[txInIndex];

        const dataToSign = transaction.id;
        const referencedUnspentTxOut: UnspentTxOut = Transaction.findUnspentTxOut(txIn.txOutId, txIn.txOutIndex, aUnspentTxOuts);
        if (referencedUnspentTxOut == null) {
            console.log('could not find referenced txOut');
            throw Error();
        }
        const referencedAddress = referencedUnspentTxOut.address;

        if (Address.getPublicKey(privateKey) !== referencedAddress) {
            console.log('trying to sign an input with private key that does not match the address that is referenced in txIn');
            throw Error();
        }
        const key = ec.keyFromPrivate(privateKey, 'hex');
        const signature: string = Utils.toHexString(key.sign(dataToSign).toDER());

        return signature;
    };

    static updateUnspentTxOuts = (aTransactions: Transaction[], aUnspentTxOuts: UnspentTxOut[]): UnspentTxOut[] => {
        const newUnspentTxOuts: UnspentTxOut[] = aTransactions
            .map((t) => {
                return t.txOuts.map((txOut, index) => new UnspentTxOut(t.id, index, txOut.address, txOut.amount));
            })
            .reduce((a, b) => a.concat(b), []);
    
        const consumedTxOuts: UnspentTxOut[] = aTransactions
            .map((t) => t.txIns)
            .reduce((a, b) => a.concat(b), [])
            .map((txIn) => new UnspentTxOut(txIn.txOutId, txIn.txOutIndex, '', 0));
    
        const resultingUnspentTxOuts = aUnspentTxOuts
            .filter(((uTxO) => !Transaction.findUnspentTxOut(uTxO.txOutId, uTxO.txOutIndex, consumedTxOuts)))
            .concat(newUnspentTxOuts);
    
        return resultingUnspentTxOuts;
    };

    static processTransactions = (aTransactions: Transaction[], aUnspentTxOuts: UnspentTxOut[], blockIndex: number) => {

        if (!Transaction.validateBlockTransactions(aTransactions, aUnspentTxOuts, blockIndex)) {
            console.log('invalid block transactions');
            return null;
        }
        return Transaction.updateUnspentTxOuts(aTransactions, aUnspentTxOuts);
    };

    static isValidTxInStructure = (txIn: TxIn): boolean => {
        if (txIn == null) {
            console.log('txIn is null');
            return false;
        } else if (typeof txIn.signature !== 'string') {
            console.log('invalid signature type in txIn');
            return false;
        } else if (typeof txIn.txOutId !== 'string') {
            console.log('invalid txOutId type in txIn');
            return false;
        } else if (typeof  txIn.txOutIndex !== 'number') {
            console.log('invalid txOutIndex type in txIn');
            return false;
        } else {
            return true;
        }
    };
    
    static isValidTxOutStructure = (txOut: TxOut): boolean => {
        if (txOut == null) {
            console.log('txOut is null');
            return false;
        } else if (typeof txOut.address !== 'string') {
            console.log('invalid address type in txOut');
            return false;
        } else if (!Address.isValid(txOut.address)) {
            console.log('invalid TxOut address');
            return false;
        } else if (typeof txOut.amount !== 'number') {
            console.log('invalid amount type in txOut');
            return false;
        } else {
            return true;
        }
    };
    
    static isValidTransactionStructure = (transaction: Transaction) => {
        if (typeof transaction.id !== 'string') {
            console.log('transactionId missing');
            return false;
        }
        if (!(transaction.txIns instanceof Array)) {
            console.log('invalid txIns type in transaction');
            return false;
        }
        if (!transaction.txIns
                .map(Transaction.isValidTxInStructure)
                .reduce((a, b) => (a && b), true)) {
            return false;
        }
    
        if (!(transaction.txOuts instanceof Array)) {
            console.log('invalid txIns type in transaction');
            return false;
        }
    
        if (!transaction.txOuts
                .map(Transaction.isValidTxOutStructure)
                .reduce((a, b) => (a && b), true)) {
            return false;
        }
        return true;
    };
}

export {
    Transaction,
    TransactionType,
    TxIn,
    TxOut,
    UnspentTxOut
}