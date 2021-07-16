import * as R from 'ramda';

import * as Exceptions from '../Exceptions';
import DB from '../DB';

import * as Config from '../Config';
import * as Utils from '../Utils';

import { Transaction } from "./Transaction";

export default class TransactionsPool {
    private static instance: TransactionsPool;

    private transactions: Transaction[] = [];
    private transactionsDb: DB;

    private constructor() {
        this.transactionsDb = new DB('transactions');

    }

    public static getInstance = (): TransactionsPool => {
        if (!TransactionsPool.instance) {
            TransactionsPool.instance = new TransactionsPool();
        }
        return TransactionsPool.instance;
    }

    

}