import * as R from 'ramda';
import * as express from 'express';
import * as  bodyParser from 'body-parser';
import * as swaggerUi from 'swagger-ui-express';
import * as path from 'path';
import * as timeago from 'timeago.js';

import * as Exceptions from '../Exceptions';

import * as Config from '../Config';
import * as Utils from '../Utils';

import Blockchain from '../Core/Blockchain';
import Block from "../Core/Block";
import { Transaction } from "../Core/Transaction";

import Miner from '../Miner/Miner';
import Node from '../Node/Node';
import Operator from '../Operator/Operator';

const swaggerConfig = require('./swagger/swagger.json');

export default class HttpServer {
    private static instance: HttpServer;

    private app: any;
    private server: any;

    public static getInstance = (): HttpServer => {
        if (!HttpServer.instance) {
            HttpServer.instance = new HttpServer();
        }
        return HttpServer.instance;
    }

    constructor() {
        this.app = express();

        const projectWallet = (wallet) => {
            return {
                id: wallet.id,
                addresses: R.map((keyPair) => {
                    return keyPair.publicKey;
                }, wallet.keyPairs)
            };
        };

        this.app.use(bodyParser.json());

        this.app.set('view engine', 'pug');
        this.app.set('views', path.join(__dirname, 'swagger/views'));
        this.app.locals.formatters = {
            time: (rawTime) => {
                const timeInMS = new Date(rawTime * 1000);
                return `${timeInMS.toLocaleString()} - ${timeago.format(timeInMS)}`;
            },
            hash: (hashString) => {
                return hashString != '0' ? `${hashString.substr(0, 5)}...${hashString.substr(hashString.length - 5, 5)}` : '<empty>';
            },
            amount: (amount) => amount.toLocaleString()
        };
        this.app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerConfig));

        this.app.get('/blockchain', (req, res) => {
            if (req.headers['accept'] && req.headers['accept'].includes('text/html'))
                res.render('blockchain/index.pug', {
                    pageTitle: 'Blockchain',
                    blocks: Blockchain.getInstance().getAllBlocks()
                });
            else
                throw new Exceptions.HTTPError(400, 'Accept content not supported');
        });

        this.app.get('/blockchain/blocks', (req, res) => {
            res.status(200).send(Blockchain.getInstance().getAllBlocks());
        });

        this.app.get('/blockchain/blocks/latest', (req, res) => {
            let lastBlock = Blockchain.getInstance().getLastBlock();
            if (lastBlock == null) throw new Exceptions.HTTPError(404, 'Last block not found');

            res.status(200).send(lastBlock);
        });

        this.app.put('/blockchain/blocks/latest', (req, res) => {
            let requestBlock = Block.fromJson(req.body);
            let result = Node.getInstance().checkReceivedBlock(requestBlock);

            if (result == null) res.status(200).send('Requesting the blockchain to check.');
            else if (result) res.status(200).send(requestBlock);
            else throw new Exceptions.HTTPError(409, 'Blockchain is update.');
        });

        this.app.get('/blockchain/blocks/:hash([a-zA-Z0-9]{64})', (req, res) => {
            let blockFound = Blockchain.getInstance().getBlockByHash(req.params.hash);
            if (blockFound == null) throw new Exceptions.HTTPError(404, `Block not found with hash '${req.params.hash}'`);

            res.status(200).send(blockFound);
        });

        this.app.get('/blockchain/blocks/:index', (req, res) => {
            let blockFound = Blockchain.getInstance().getBlockByIndex(parseInt(req.params.index));
            if (blockFound == null) throw new Exceptions.HTTPError(404, `Block not found with index '${req.params.index}'`);

            res.status(200).send(blockFound);
        });

        this.app.get('/blockchain/blocks/transactions/:transactionId([a-zA-Z0-9]{64})', (req, res) => {
            let transactionFromBlock = Blockchain.getInstance().getTransactionFromBlocks(req.params.transactionId);
            if (transactionFromBlock == null) throw new Exceptions.HTTPError(404, `Transaction '${req.params.transactionId}' not found in any block`);

            res.status(200).send(transactionFromBlock);
        });

        this.app.get('/blockchain/transactions', (req, res) => {
            if (req.headers['accept'] && req.headers['accept'].includes('text/html'))
                res.render('blockchain/transactions/index.pug', {
                    pageTitle: 'Unconfirmed Transactions',
                    transactions: Blockchain.getInstance().getAllTransactions()
                });
            else
                res.status(200).send(Blockchain.getInstance().getAllTransactions());
        });

        this.app.post('/blockchain/transactions', (req, res) => {
            let requestTransaction = Transaction.fromJson(req.body);
            let transactionFound = Blockchain.getInstance().getTransactionById(requestTransaction.id);

            if (transactionFound != null) throw new Exceptions.HTTPError(409, `Transaction '${requestTransaction.id}' already exists`);

            try {
                let newTransaction = Blockchain.getInstance().addTransaction(requestTransaction);
                res.status(201).send(newTransaction);
            } catch (ex) {
                if (ex instanceof Exceptions.TransactionAssertionError) throw new Exceptions.HTTPError(400, ex.message, requestTransaction, ex);
                else throw ex;
            }
        });

        this.app.get('/blockchain/transactions/unspent', (req, res) => {
            res.status(200).send(Blockchain.getInstance().getUnspentTransactionsForAddress(req.query.address));
        });

        this.app.get('/operator/wallets', (req, res) => {
            let wallets = Operator.getInstance().getWallets();

            let projectedWallets = R.map(projectWallet, wallets);

            res.status(200).send(projectedWallets);
        });

        this.app.post('/operator/wallets', (req, res) => {
            let password = req.body.password;
            if (R.match(/\w+/g, password).length <= 4) throw new Exceptions.HTTPError(400, 'Password must contain more than 4 words');

            let newWallet = Operator.getInstance().createWalletFromPassword(password);

            let projectedWallet = projectWallet(newWallet);

            res.status(201).send(projectedWallet);
        });

        this.app.get('/operator/wallets/:walletId', (req, res) => {
            let walletFound = Operator.getInstance().getWalletById(req.params.walletId);
            if (walletFound == null) throw new Exceptions.HTTPError(404, `Wallet not found with id '${req.params.walletId}'`);

            let projectedWallet = projectWallet(walletFound);

            res.status(200).send(projectedWallet);
        });

        this.app.post('/operator/wallets/:walletId/transactions', (req, res) => {
            let walletId = req.params.walletId;
            let password = req.headers.password;

            if (password == null) throw new Exceptions.HTTPError(401, 'Wallet\'s password is missing.');
            let passwordHash = Utils.Crypto.hash(password);

            try {
                if (!Operator.getInstance().checkWalletPassword(walletId, passwordHash)) throw new Exceptions.HTTPError(403, `Invalid password for wallet '${walletId}'`);

                let newTransaction = Operator.getInstance().createTransaction(walletId, req.body.fromAddress, req.body.toAddress, req.body.amount, req.body['changeAddress'] || req.body.fromAddress);

                newTransaction.check();

                let transactionCreated = Blockchain.getInstance().addTransaction(Transaction.fromJson(newTransaction));
                res.status(201).send(transactionCreated);
            } catch (ex) {
                if (ex instanceof Exceptions.ArgumentError || ex instanceof Exceptions.TransactionAssertionError) throw new Exceptions.HTTPError(400, ex.message, walletId, ex);
                else throw ex;
            }
        });

        this.app.get('/operator/wallets/:walletId/addresses', (req, res) => {
            let walletId = req.params.walletId;
            try {
                let addresses = Operator.getInstance().getAddressesForWallet(walletId);
                res.status(200).send(addresses);
            } catch (ex) {
                if (ex instanceof Exceptions.ArgumentError) throw new Exceptions.HTTPError(400, ex.message, walletId, ex);
                else throw ex;
            }
        });

        this.app.post('/operator/wallets/:walletId/addresses', (req, res) => {
            let walletId = req.params.walletId;
            let password = req.headers.password;

            if (password == null) throw new Exceptions.HTTPError(401, 'Wallet\'s password is missing.');
            let passwordHash = Utils.Crypto.hash(password);

            try {
                if (!Operator.getInstance().checkWalletPassword(walletId, passwordHash)) throw new Exceptions.HTTPError(403, `Invalid password for wallet '${walletId}'`);

                let newAddress = Operator.getInstance().generateAddressForWallet(walletId);
                res.status(201).send({ address: newAddress });
            } catch (ex) {
                if (ex instanceof Exceptions.ArgumentError) throw new Exceptions.HTTPError(400, ex.message, walletId, ex);
                else throw ex;
            }
        });

        this.app.get('/operator/:addressId/balance', (req, res) => {
            let addressId = req.params.addressId;

            try {
                let balance = Operator.getInstance().getBalanceForAddress(addressId);
                res.status(200).send({ balance: balance });
            } catch (ex) {
                if (ex instanceof Exceptions.ArgumentError) throw new Exceptions.HTTPError(404, ex.message, { addressId }, ex);
                else throw ex;
            }
        });

        this.app.get('/node/peers', (req, res) => {
            res.status(200).send(Node.getInstance().getPeers());
        });

        this.app.post('/node/peers', (req, res) => {
            let newPeer = Node.getInstance().connectToPeer(req.body);
            res.status(201).send(newPeer);
        });

        this.app.get('/node/transactions/:transactionId([a-zA-Z0-9]{64})/confirmations', (req, res) => {
            Node.getInstance().getConfirmations(req.params.transactionId)
                .then((confirmations) => {
                    res.status(200).send({ confirmations: confirmations });
                });
        });

        this.app.post('/miner/mine', (req, res, next) => {
            Miner.getInstance().mine(req.body.rewardAddress, req.body['feeAddress'] || req.body.rewardAddress)
                .then((newBlock) => {
                    newBlock = Block.fromJson(newBlock);
                    Blockchain.getInstance().addBlock(newBlock);
                    res.status(201).send(newBlock);
                })
                .catch((ex) => {
                    if (ex instanceof Exceptions.BlockAssertionError && ex.message.includes('Invalid index')) next(new Exceptions.HTTPError(409, 'A new block were added before we were able to mine one'), null, ex);
                    else next(ex);
                });
        });

        this.app.use(function (err, req, res, next) {  // eslint-disable-line no-unused-vars
            if (err instanceof Exceptions.HTTPError) res.status(err.status);
            else res.status(500);
            res.send(err.message + (err.cause ? ' - ' + err.cause.message : ''));
        });
    }

    public listen = (host, port) => {
        return new Promise((resolve, reject) => {
            this.server = this.app.listen(port, host, (err) => {
                if (err) reject(err);
                console.info(`Listening http on port: ${this.server.address().port}, to access the API documentation go to http://${host}:${this.server.address().port}/api-docs/`);
                resolve(this);
            });
        });
    }

    public stop = () => {
        return new Promise((resolve, reject) => {
            this.server.close((err) => {
                if (err) reject(err);
                console.info('Closing http');
                resolve(this);
            });
        });
    }
}