import * as ecdsa from 'elliptic';

const ec = new ecdsa.ec('secp256k1');

export default class Address {
    
    static isValid = (address: string): boolean => {
        if (address.length !== 130) {
            console.log(address);
            console.log('invalid public key length');
            return false;
        } else if (address.match('^[a-fA-F0-9]+$') === null) {
            console.log('public key must contain only hex characters');
            return false;
        } else if (!address.startsWith('04')) {
            console.log('public key must start with 04');
            return false;
        }
        return true;
    };

    static getPublicKey = (aPrivateKey: string): string => {
        return ec.keyFromPrivate(aPrivateKey, 'hex').getPublic().encode('hex');
    };
}