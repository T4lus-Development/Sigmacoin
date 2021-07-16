import * as crypto from 'crypto';
import * as elliptic from 'elliptic';

import * as Config from '../Config';

const ec = new elliptic.eddsa('ed25519');

export default class CryptoEdDSA {
    static generateSecret = (password) => {
        return crypto.pbkdf2Sync(password, Config.SALT, 10000, 512, 'sha512').toString('hex');
    }

    static generateKeyPairFromSecret = (secret) => {
        return ec.keyFromSecret(secret);
    }

    static signHash = (keyPair, messageHash) => {
        return keyPair.sign(messageHash).toHex().toLowerCase();
    }

    static verifySignature = (publicKey, signature, messageHash) => {
        let key = ec.keyFromPublic(publicKey);
        let verified = key.verify(messageHash, signature);

        return verified;
    }

    static toHex = (data) => {
        return elliptic.utils.toHex(data);
    }
}