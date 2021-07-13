import * as CryptoJS from 'crypto-js';
import * as elliptic from 'elliptic';
import * as R from 'ramda';

import * as Exceptions from '../Exceptions';

import * as Config from '../Config';
import * as Utils from '../Utils';

import Address from './Address';
import BlockChain from './BlockChain';

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
    REGULAR = 0,
    FEE = 1,
    REWARD = 2
}

class Transaction {
    public id: string;
    public hash: string;
    public type: TransactionType;
    public txIns: TxIn[];
    public txOuts: TxOut[];

    public constructor(id?:string, type?:TransactionType, txIns?:TxIn[], txOuts?:TxOut[]) {
        this.id = id;
        this.type = type;
        this.txIns = txIns;
        this.txOuts = txOuts;
    }

    public toHash = () => {
        return Utils.Crypto.hash(this.id + this.type + JSON.stringify(this.txIns) + JSON.stringify(this.txOuts));
    }

    check() {
        if (this.hash != this.toHash()) {
            console.error(`Invalid transaction hash '${this.hash}'`);
            throw new Exceptions.TransactionAssertionError(`Invalid transaction hash '${this.hash}'`, this);
        }

        // Check if the signature of all input transactions are correct (transaction data is signed by the public key of the address)
        R.map((txInput) => {
            let txInputHash = Utils.Crypto.hash({
                transaction: txInput.transaction,
                index: txInput.index,
                address: txInput.address
            });
            let isValidSignature = Utils.CryptoEdDSA.verifySignature(txInput.address, txInput.signature, txInputHash);

            if (!isValidSignature) {
                console.error(`Invalid transaction input signature '${JSON.stringify(txInput)}'`);
                throw new Exceptions.TransactionAssertionError(`Invalid transaction input signature '${JSON.stringify(txInput)}'`, txInput);
            }
        }, this.txIns);


        if (this.type == TransactionType.REGULAR) {
            // Check if the sum of input transactions are greater than output transactions, it needs to leave some room for the transaction fee
            let sumOfInputsAmount = R.sum(R.map(R.prop('amount'), this.txIns));
            let sumOfOutputsAmount = R.sum(R.map(R.prop('amount'), this.txOuts));
            
            const totalTxInValues: number = this.txIns
                .map((txIn) => BlockChain.getInstance().getUnspentTxOuts().find((uTxO) => uTxO.txOutId === txIn.txOutId && uTxO.txOutIndex === txIn.txOutIndex).amount)
                .reduce((a, b) => (a + b), 0);
    
            const totalTxOutValues: number = this.txOuts
                .map((txOut) => txOut.amount)
                .reduce((a, b) => (a + b), 0);

            let negativeOutputsFound = 0;
            let i = 0;
            let outputsLen = this.txOuts.length;

            // Check for negative outputs
            for (i = 0; i < outputsLen; i++) {
                if (this.txOuts[i].amount < 0) {
                    negativeOutputsFound++;
                }
            }

            let isInputsAmountGreaterOrEqualThanOutputsAmount = R.gte(sumOfInputsAmount, sumOfOutputsAmount);

            if (!isInputsAmountGreaterOrEqualThanOutputsAmount) {
                console.error(`Invalid transaction balance: inputs sum '${sumOfInputsAmount}', outputs sum '${sumOfOutputsAmount}'`);
                throw new Exceptions.TransactionAssertionError(`Invalid transaction balance: inputs sum '${sumOfInputsAmount}', outputs sum '${sumOfOutputsAmount}'`, { sumOfInputsAmount, sumOfOutputsAmount });
            }

            let isEnoughFee = (sumOfInputsAmount - sumOfOutputsAmount) >= Config.FEE_PER_TRANSACTION; // 1 because the fee is 1 satoshi per transaction

            if (!isEnoughFee) {
                console.error(`Not enough fee: expected '${Config.FEE_PER_TRANSACTION}' got '${(sumOfInputsAmount - sumOfOutputsAmount)}'`);
                throw new Exceptions.TransactionAssertionError(`Not enough fee: expected '${Config.FEE_PER_TRANSACTION}' got '${(sumOfInputsAmount - sumOfOutputsAmount)}'`, { sumOfInputsAmount, sumOfOutputsAmount, FEE_PER_TRANSACTION: Config.FEE_PER_TRANSACTION });
            }
            if (negativeOutputsFound > 0) {
                console.error(`Transaction is either empty or negative, output(s) caught: '${negativeOutputsFound}'`);
                throw new Exceptions.TransactionAssertionError(`Transaction is either empty or negative, output(s) caught: '${negativeOutputsFound}'`);
            }
        }

        

        return true;
    }


    //------------------

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
        const txIns: TxIn[] = R.pipe(
            R.map((tx) => tx.txIns),
            R.flatten(),
            R.values()
        )(aTransactions);
    
        if (Transaction.hasDuplicates(txIns)) {
            return false;
        }
    
        // all but coinbase transactions
        const normalTransactions: Transaction[] = aTransactions.slice(1);
        return normalTransactions.map((tx) => Transaction.validateTransaction(tx, aUnspentTxOuts)).reduce((a, b) => (a && b), true);
    
    };

    static hasDuplicates = (txIns: TxIn[]): boolean => {
        const groups = R.countBy((txIn: TxIn) => txIn.txOutId + txIn.txOutIndex)(txIns);
        return R.pipe(
            R.map((value, key) => {
                if (value > 1) {
                    console.log('duplicate txIn: ' + key);
                    return true;
                } else {
                    return false;
                }
            }),
            R.includes(true)
        )(groups);
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