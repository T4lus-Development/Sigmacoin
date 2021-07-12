import * as elliptic from 'elliptic';
import {existsSync, readFileSync, unlinkSync, writeFileSync} from 'fs';
import * as _ from 'lodash';

import * as Config from '../Config';

import Address from '../Core/Address';
import {Transaction, TransactionType, TxIn, TxOut, UnspentTxOut} from '../Core/Transaction';

const ec = new elliptic.eddsa('ed25519');

export default class Wallet {
    private static instance: Wallet;


    private constructor() {
        // let's not override existing private keys
        if (existsSync(Config.PRIVATE_KEY_LOCATION)) {
            return;
        }
        const newPrivateKey = this.generatePrivateKey();

        writeFileSync(Config.PRIVATE_KEY_LOCATION, newPrivateKey);
        console.log('new wallet with private key created to : %s', Config.PRIVATE_KEY_LOCATION);
    }

    public static getInstance(): Wallet {
        if (!Wallet.instance) {
            Wallet.instance = new Wallet();
        }
        return Wallet.instance;
    }

    public getPrivate = (): string => {
        const buffer = readFileSync(Config.PRIVATE_KEY_LOCATION, 'utf8');
        return buffer.toString();
    };

    public getPublic = (): string => {
        const privateKey = this.getPrivate();
        const key = ec.keyFromPrivate(privateKey, 'hex');
        return key.getPublic().encode('hex');
    };
    
    public generatePrivateKey = (): string => {
        const keyPair = ec.genKeyPair();
        const privateKey = keyPair.getPrivate();
        return privateKey.toString(16);
    };

    public deleteWallet = () => {
        if (existsSync(Config.PRIVATE_KEY_LOCATION)) {
            unlinkSync(Config.PRIVATE_KEY_LOCATION);
        }
    };
    
    public getBalance = (address: string, unspentTxOuts: UnspentTxOut[]): number => {
        return _(this.findUnspentTxOuts(address, unspentTxOuts))
            .map((uTxO: UnspentTxOut) => uTxO.amount)
            .sum();
    };
    
    public findUnspentTxOuts = (ownerAddress: string, unspentTxOuts: UnspentTxOut[]) => {
        return _.filter(unspentTxOuts, (uTxO: UnspentTxOut) => uTxO.address === ownerAddress);
    };
    
    public findTxOutsForAmount = (amount: number, myUnspentTxOuts: UnspentTxOut[]) => {
        let currentAmount = 0;
        const includedUnspentTxOuts = [];
        for (const myUnspentTxOut of myUnspentTxOuts) {
            includedUnspentTxOuts.push(myUnspentTxOut);
            currentAmount = currentAmount + myUnspentTxOut.amount;
            if (currentAmount >= amount) {
                const leftOverAmount = currentAmount - amount;
                return {includedUnspentTxOuts, leftOverAmount};
            }
        }
    
        const eMsg = 'Cannot create transaction from the available unspent transaction outputs. Required amount:' + amount + '. Available unspentTxOuts:' + JSON.stringify(myUnspentTxOuts);
        throw Error(eMsg);
    };
    
    public createTxOuts = (receiverAddress: string, myAddress: string, amount, leftOverAmount: number) => {
        const txOut1: TxOut = new TxOut(receiverAddress, amount);
        if (leftOverAmount === 0) {
            return [txOut1];
        } else {
            const leftOverTx = new TxOut(myAddress, leftOverAmount);
            return [txOut1, leftOverTx];
        }
    };
    
    public filterTxPoolTxs = (unspentTxOuts: UnspentTxOut[], transactionPool: Transaction[]): UnspentTxOut[] => {
        const txIns: TxIn[] = _(transactionPool)
            .map((tx: Transaction) => tx.txIns)
            .flatten()
            .value();
        const removable: UnspentTxOut[] = [];
        for (const unspentTxOut of unspentTxOuts) {
            const txIn = _.find(txIns, (aTxIn: TxIn) => {
                return aTxIn.txOutIndex === unspentTxOut.txOutIndex && aTxIn.txOutId === unspentTxOut.txOutId;
            });
    
            if (txIn === undefined) {
    
            } else {
                removable.push(unspentTxOut);
            }
        }
    
        return _.without(unspentTxOuts, ...removable);
    };
    
    public createTransaction = (receiverAddress: string, amount: number, privateKey: string, unspentTxOuts: UnspentTxOut[], txPool: Transaction[]): Transaction => {
    
        console.log('txPool: %s', JSON.stringify(txPool));
        const myAddress: string = Address.getPublicKey(privateKey);
        const myUnspentTxOutsA = unspentTxOuts.filter((uTxO: UnspentTxOut) => uTxO.address === myAddress);
    
        const myUnspentTxOuts = this.filterTxPoolTxs(myUnspentTxOutsA, txPool);
    
        // filter from unspentOutputs such inputs that are referenced in pool
        const {includedUnspentTxOuts, leftOverAmount} = this.findTxOutsForAmount(amount, myUnspentTxOuts);
    
        const toUnsignedTxIn = (unspentTxOut: UnspentTxOut) => {
            const txIn: TxIn = new TxIn('', unspentTxOut.txOutId, unspentTxOut.txOutIndex);
            return txIn;
        };
    
        const unsignedTxIns: TxIn[] = includedUnspentTxOuts.map(toUnsignedTxIn);
    
        const tx: Transaction = new Transaction();
        tx.txIns = unsignedTxIns;
        tx.txOuts = this.createTxOuts(receiverAddress, myAddress, amount, leftOverAmount);
        tx.id = Transaction.getTransactionId(tx);
        tx.type = TransactionType.NORMAL;
    
        tx.txIns = tx.txIns.map((txIn: TxIn, index: number) => {
            txIn.signature = Transaction.signTxIn(tx, index, privateKey, unspentTxOuts);
            return txIn;
        });
    
        return tx;
    };

}