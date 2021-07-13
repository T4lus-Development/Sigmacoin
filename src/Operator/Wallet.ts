import * as R from 'ramda';

import * as Utils from '../Utils';

class keyPairs {
    public index;
    public publicKey;
    public secretKey;
}

export default class Wallet {

    public id;
    public passwordHash;
    private secret = null;
    private keyPairs:keyPairs[] = [];

    constructor() {

    }

    public generateAddress = () => {
        // If secret is null means it is a brand new wallet
        if (this.secret == null) {
            this.generateSecret();
        }

        let lastKeyPair = R.last(this.keyPairs);
        
        // Generate next seed based on the first secret or a new secret from the last key pair.
        let seed = (lastKeyPair == null ?  this.secret : Utils.CryptoEdDSA.generateSecret(R.propOr(null, 'secretKey', lastKeyPair)));
        let keyPairRaw = Utils.CryptoEdDSA.generateKeyPairFromSecret(seed);
        
        let newKeyPair = new keyPairs();
        newKeyPair.index = this.keyPairs.length + 1;
        newKeyPair.secretKey = Utils.CryptoEdDSA.toHex(keyPairRaw.getSecret());
        newKeyPair.publicKey = Utils.CryptoEdDSA.toHex(keyPairRaw.getPublic());

        this.keyPairs.push(newKeyPair);
        this.save();
        return newKeyPair.publicKey;
    }

    public generateSecret = () => {
        this.secret = Utils.CryptoEdDSA.generateSecret(this.passwordHash);
        return this.secret;
    }

    public getAddressByIndex = (index) => {
        return R.propOr(null, 'publicKey', R.find(R.propEq('index', index), this.keyPairs));
    }

    public getAddressByPublicKey = (publicKey) => {
        return R.propOr(null, 'publicKey', R.find(R.propEq('publicKey', publicKey), this.keyPairs));
    }

    public getSecretKeyByAddress = (address) => {
        return R.propOr(null, 'secretKey', R.find(R.propEq('publicKey', address), this.keyPairs));
    }

    public getAddresses = () => {
        return R.map(R.prop('publicKey'), this.keyPairs);
    }

    public save = (): Wallet => {

        return this;
    }

    public load = (): Wallet => {

        return this;
    }

    public static fromPassword = (password): Wallet => {
        let wallet = new Wallet();

        wallet.id = Utils.Crypto.randomId();
        wallet.passwordHash = Utils.Crypto.hash(password);
        return wallet;
    }

    public static fromHash = (passwordHash): Wallet => {
        let wallet = new Wallet();

        wallet.id = Utils.Crypto.randomId();
        wallet.passwordHash = passwordHash;
        return wallet;
    }

    public static fromJson = (data): Wallet => {
        let wallet = new Wallet();

        R.forEachObjIndexed((value, key) => { wallet[key] = value; }, data);
        return wallet;
    }

}