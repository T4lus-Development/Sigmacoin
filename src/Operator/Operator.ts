import * as R from 'ramda';

import * as Exceptions from '../Exceptions';
import DB from '../DB';

import * as Config from '../Config';
import * as Utils from '../Utils';

import Wallet from './Wallet';
import TransactionBuilder from './TransactionBuilder';

import Blockchain from '../Core/Blockchain';
import { Transaction } from "../Core/Transaction";

export default class Operator {
    private static instance: Operator;

    private wallets: Wallet[] = [];
    private walletsDb: DB;

    constructor() {
        this.walletsDb = new DB('wallets');

        // INFO: In this implementation the database is a file and every time data is saved it rewrites the file, probably it should be a more robust database for performance reasons
        //this.wallets = this.db.read(Wallets);
    }

    public static getInstance = (): Operator => {
        if (!Operator.instance) {
            Operator.instance = new Operator();
        }
        return Operator.instance;
    }

    public addWallet = (wallet) => {
        this.wallets.push(wallet);
        //this.walletsDb.write(this.wallets);
        return wallet;
    }

    public createWalletFromPassword = (password) => {
        let newWallet = Wallet.fromPassword(password);
        return this.addWallet(newWallet);
    }    

    public checkWalletPassword = (walletId, passwordHash) => {
        let wallet = this.getWalletById(walletId);
        if (wallet == null) throw new Exceptions.ArgumentError(`Wallet not found with id '${walletId}'`);

        return wallet.passwordHash == passwordHash;
    }

    public getWallets = () => {
        return this.wallets;
    }

    public getWalletById = (walletId) => {
        return R.find((wallet) => { return wallet.id == walletId; }, this.wallets);
    }

    public generateAddressForWallet = (walletId) => {
        let wallet = this.getWalletById(walletId);
        if (wallet == null) throw new Exceptions.ArgumentError(`Wallet not found with id '${walletId}'`);

        let address = wallet.generateAddress();
        //this.walletsDb.write(this.wallets);
        return address;
    }

    public getAddressesForWallet = (walletId) => {
        let wallet = this.getWalletById(walletId);
        if (wallet == null) throw new Exceptions.ArgumentError(`Wallet not found with id '${walletId}'`);

        let addresses = wallet.getAddresses();
        return addresses;
    }    

    public getBalanceForAddress = (addressId) => {        
        let utxo = Blockchain.getInstance().getUnspentTransactionsForAddress(addressId);

        if (utxo == null || utxo.length == 0) throw new Exceptions.ArgumentError(`No transactions found for address '${addressId}'`);
        return R.sum(R.map(R.prop('amount'), utxo));
    }

    public createTransaction = (walletId, fromAddressId, toAddressId, amount, changeAddressId): Transaction => {
        let utxo = Blockchain.getInstance().getUnspentTransactionsForAddress(fromAddressId);
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

        return Transaction.fromJson(tx.build());
    }
}