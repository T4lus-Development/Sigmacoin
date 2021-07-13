import * as R from 'ramda';

import * as Exceptions from '../Exceptions';

import * as Config from '../Config';
import * as Utils from '../Utils';

export default class TransactionBuilder {
    
    private secretKey:string = null;
    
    constructor() {
        this.listOfUTXO = null;
        this.outputAddresses = null;
        this.totalAmount = null;
        this.changeAddress = null;
        this.feeAmount = 0;
        this.secretKey = null;
        this.type = 'regular';
    }

    public from(listOfUTXO) {
        this.listOfUTXO = listOfUTXO;
        return this;
    }

    public to(address, amount) {
        this.outputAddress = address;
        this.totalAmount = amount;
        return this;
    }

    public change(changeAddress) {
        this.changeAddress = changeAddress;
        return this;
    }

    public fee(amount) {
        this.feeAmount = amount;
        return this;
    }

    public sign(secretKey) {
        this.secretKey = secretKey;
        return this;
    }

    public type(type) {
        this.type = type;
    }

    public build() {
        // Check required information
        if (this.listOfUTXO == null) throw new Exceptions.ArgumentError('It\'s necessary to inform a list of unspent output transactions.');
        if (this.outputAddress == null) throw new Exceptions.ArgumentError('It\'s necessary to inform the destination address.');
        if (this.totalAmount == null) throw new Exceptions.ArgumentError('It\'s necessary to inform the transaction value.');

        // Calculates the change amount
        let totalAmountOfUTXO = R.sum(R.pluck('amount', this.listOfUTXO));
        let changeAmount = totalAmountOfUTXO - this.totalAmount - this.feeAmount;

        // For each transaction input, calculates the hash of the input and sign the data.
        let self = this;
        let inputs = R.map((utxo) => {
            let txiHash = Utils.Crypto.hash({
                transaction: utxo.transaction,
                index: utxo.index,
                address: utxo.address
            });
            utxo.signature = Utils.CryptoEdDSA.signHash(Utils.CryptoEdDSA.generateKeyPairFromSecret(self.secretKey), txiHash);
            return utxo;
        }, this.listOfUTXO);

        let outputs = [];

        // Add target receiver
        outputs.push({
            amount: this.totalAmount,
            address: this.outputAddress
        });

        // Add change amount
        if (changeAmount > 0) {
            outputs.push({
                amount: changeAmount,
                address: this.changeAddress
            });
        } else {
            throw new Exceptions.ArgumentError('The sender does not have enough to pay for the transaction.');
        }        

        // The remaining value is the fee to be collected by the block's creator.        

        return Transaction.fromJson({
            id: CryptoUtil.randomId(64),
            hash: null,
            type: this.type,
            data: {
                inputs: inputs,
                outputs: outputs
            }
        });
    }
}