
import * as fs from 'fs-extra';
import * as path from 'path';

export default class Db {
    public dbName: string;
    public length: number; 

    constructor(dbName) {
        this.dbName = dbName;

        this.init();
    }

    public init = () => {
        fs.ensureDirSync('data/' + this.dbName);
    }


    public load = () => {

    }

    public save = () => {
        
    }
}