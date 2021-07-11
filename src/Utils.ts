import Block from './Core/Block';

export default class Utils {
    static hexToBinary = (s: string): string => {
        let ret: string = '';
        const lookupTable = {
            '0': '0000', '1': '0001', '2': '0010', '3': '0011', '4': '0100',
            '5': '0101', '6': '0110', '7': '0111', '8': '1000', '9': '1001',
            'a': '1010', 'b': '1011', 'c': '1100', 'd': '1101',
            'e': '1110', 'f': '1111'
        };
        for (let i: number = 0; i < s.length; i = i + 1) {
            if (lookupTable[s[i]]) {
                ret += lookupTable[s[i]];
            } else {
                return null;
            }
        }
        return ret;
    };

    static toHexString = (byteArray): string => {
        return Array.from(byteArray, (byte: any) => {
            return ('0' + (byte & 0xFF).toString(16)).slice(-2);
        }).join('');
    };

    static JSONToObject = <T>(data: string): T => {
        try {
            return JSON.parse(data);
        } catch (e) {
            console.log(e);
            return null;
        }
    };

    static getCurrentTimestamp = (): number => Math.round(new Date().getTime() / 1000);

    static isValidTimestamp = (newBlock: Block, previousBlock: Block): boolean => {
        return ( previousBlock.timestamp - 60 < newBlock.timestamp ) && newBlock.timestamp - 60 < Utils.getCurrentTimestamp();
    };
}
