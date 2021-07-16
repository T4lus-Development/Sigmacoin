
import Crypto from './Crypto';
import CryptoEdDSA from './CryptoEdDSA';


const JSONToObject = <T>(data:any): T => {
    try {
        return JSON.parse(data);
    } catch (e) {
        console.log(e);
        return null;
    }
};

export {
    Crypto,
    CryptoEdDSA,

    JSONToObject
}