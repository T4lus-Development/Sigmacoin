import * as _ from 'lodash';
import {Transaction, TxIn, UnspentTxOut} from './Transaction';

export default class TransactionPool {
    private static instance: TransactionPool;

    private transactionPool: Transaction[] = [];

    public static getInstance = (): TransactionPool => {
        if (!TransactionPool.instance) {
            TransactionPool.instance = new TransactionPool();
        }
        return TransactionPool.instance;
    }

    public getPool = () => {
        return _.cloneDeep(this.transactionPool);
    };

    public addToPool = (tx: Transaction, unspentTxOuts: UnspentTxOut[]) => {

        if (!Transaction.validateTransaction(tx, unspentTxOuts)) {
            throw Error('Trying to add invalid tx to pool');
        }
    
        if (!this.isValidTxForPool(tx)) {
            throw Error('Trying to add invalid tx to pool');
        }
        console.log('adding to txPool: %s', JSON.stringify(tx));
        this.transactionPool.push(tx);
    };

    public updatePool = (unspentTxOuts: UnspentTxOut[]) => {
        const invalidTxs = [];
        for (const tx of this.transactionPool) {
            for (const txIn of tx.txIns) {
                if (!this.hasTxIn(txIn, unspentTxOuts)) {
                    invalidTxs.push(tx);
                    break;
                }
            }
        }
        if (invalidTxs.length > 0) {
            console.log('removing the following transactions from txPool: %s', JSON.stringify(invalidTxs));
            this.transactionPool = _.without(this.transactionPool, ...invalidTxs);
        }
    };

    private hasTxIn = (txIn: TxIn, unspentTxOuts: UnspentTxOut[]): boolean => {
        const foundTxIn = unspentTxOuts.find((uTxO: UnspentTxOut) => {
            return uTxO.txOutId === txIn.txOutId && uTxO.txOutIndex === txIn.txOutIndex;
        });
        return foundTxIn !== undefined;
    };

    private getTxPoolIns = (): TxIn[] => {
        return _(this.transactionPool)
            .map((tx) => tx.txIns)
            .flatten()
            .value();
    };

    private isValidTxForPool = (tx: Transaction): boolean => {
        const txPoolIns: TxIn[] = this.getTxPoolIns();
    
        const containsTxIn = (txIns: TxIn[], txIn: TxIn) => {
            return _.find(txPoolIns, ((txPoolIn) => {
                return txIn.txOutIndex === txPoolIn.txOutIndex && txIn.txOutId === txPoolIn.txOutId;
            }));
        };
    
        for (const txIn of tx.txIns) {
            if (containsTxIn(txPoolIns, txIn)) {
                console.log('txIn already found in the txPool');
                return false;
            }
        }
        return true;
    };
}