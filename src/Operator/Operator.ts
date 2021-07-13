import * as R from 'ramda';

import * as Exceptions from '../Exceptions';

import * as Config from '../Config';
import * as Utils from '../Utils';

import Wallet from './Wallet';
import TransactionBuilder from './TransactionBuilder';

import BlockChain from '../Core/BlockChain';
import { Transaction } from '../Core/Transaction';


export default class Operator {
    private static instance: Operator;

    private wallets:Wallet[] = [];

    constructor() {
        //load Local wallets
    }

    public static getInstance = (): Operator => {
        if (!Operator.instance) {
            Operator.instance = new Operator();
        }
        return Operator.instance;
    }

    addWallet(wallet: Wallet) {
        this.wallets.push(wallet);
        return wallet;
    }

    createWalletFromPassword(password) {
        let newWallet = Wallet.fromPassword(password).save();

        return this.addWallet(newWallet);
    }    

    checkWalletPassword(walletId, passwordHash) {
        let wallet = this.getWalletById(walletId);
        if (wallet == null) 
            throw new Exceptions.ArgumentError(`Wallet not found with id '${walletId}'`);

        return wallet.passwordHash == passwordHash;
    }

    getWallets() {
        return this.wallets;
    }

    getWalletById(walletId) {
        return R.find((wallet) => { return wallet.id == walletId; }, this.wallets);
    }

    generateAddressForWallet(walletId) {
        let wallet = this.getWalletById(walletId);
        if (wallet == null) 
            throw new Exceptions.ArgumentError(`Wallet not found with id '${walletId}'`);

        let address = wallet.generateAddress();
        return address;
    }

    getAddressesForWallet(walletId) {
        let wallet = this.getWalletById(walletId);
        if (wallet == null) 
            throw new Exceptions.ArgumentError(`Wallet not found with id '${walletId}'`);

        let addresses = wallet.getAddresses();
        return addresses;
    }    

    getBalanceForAddress(addressId) {        
        let utxo = BlockChain.getInstance().getUnspentTransactionsForAddress(addressId);
        if (utxo == null || utxo.length == 0) 
            throw new Exceptions.ArgumentError(`No transactions found for address '${addressId}'`);

        return R.sum(R.map(R.prop('amount'), utxo));
    }

    createTransaction(walletId, fromAddressId, toAddressId, amount, changeAddressId): Transaction  {
        let utxo = BlockChain.getInstance().getUnspentTransactionsForAddress(fromAddressId);
        let wallet = this.getWalletById(walletId);
    
        if (wallet == null) throw new Exceptions.ArgumentError(`Wallet not found with id '${walletId}'`);
    
        let secretKey = wallet.getSecretKeyByAddress(fromAddressId);
    
        if (secretKey == null) throw new Exceptions.ArgumentError(`Secret key not found with Wallet id '${walletId}' and address '${fromAddressId}'`);
    
        let tx = new TransactionBuilder();
        tx.from(utxo);
        tx.to(toAddressId, amount);
        tx.change(changeAddressId || fromAddressId);
        tx.fee(Config.FEE_PER_TRANSACTION);
        tx.sign(secretKey);        
    
        console.log(Utils.JSONToObject<Transaction>(tx.build()));

        return new Transaction();
    }
}