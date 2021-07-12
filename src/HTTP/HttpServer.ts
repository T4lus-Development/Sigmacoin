import * as  bodyParser from 'body-parser';
import * as express from 'express';
import * as swaggerUi from 'swagger-ui-express';
import * as _ from 'lodash';
import * as path from 'path';

import * as Config from '../Config';

import BlockChain from '../Core/BlockChain';
import TransactionPool from '../Core/TransactionPool';
import Block from '../Core/Block';
import {UnspentTxOut} from '../Core/Transaction';

import Wallet from '../Wallet/Wallet';
import P2pServer from '../P2P/P2pServer';

const swaggerConfig = require('./swagger.json');

export default class HttpServer {
    private static instance: HttpServer;


    private constructor() {
        const app = express();
        
        app.use(bodyParser.json());
        app.set('view engine', 'pug');
        app.set('views', path.join(__dirname, 'views'));

        app.use((err, req, res, next) => {
            if (err) {
                res.status(400).send(err.message);
            }
        });

        app.locals.formatters = {
            time: (rawTime) => {
                const timeInMS = new Date(rawTime * 1000);
                return `${timeInMS.toLocaleString()}`; // - ${timeago().format(timeInMS)}
            },
            hash: (hashString) => {
                return hashString != '0' ? `${hashString.substr(0, 5)}...${hashString.substr(hashString.length - 5, 5)}` : '<empty>';
            },
            amount: (amount) => amount.toLocaleString()
        };

        app.use('/api', swaggerUi.serve, swaggerUi.setup(swaggerConfig));

        app.get('/blockchain', (req, res) => {
            if (req.headers['accept'] && req.headers['accept'].includes('text/html'))
                res.render('blockchain/index.pug', {
                    pageTitle: 'Blockchain',
                    blocks: BlockChain.getInstance().getBlockchain()
                });
            else
                res.status(400).send();
        });

        app.get('/blockchain/blocks', (req, res) => {
            res.send(BlockChain.getInstance().getBlockchain());
        });

        app.get('/blockchain/blocks/latest', (req, res) => {
            let lastBlock = BlockChain.getInstance().getLatestBlock();
            if (lastBlock == null)
                res.status(404).send('Last block not found');
            res.status(200).send(lastBlock);
        });

        app.get('/blockchain/block/:index', (req, res) => {
            const block = _.find(BlockChain.getInstance().getBlockchain(), {'index' : req.params.index});
            res.send(block);
        });

        app.get('/blockchain/block/:hash([a-zA-Z0-9]{64})', (req, res) => {
            const block = _.find(BlockChain.getInstance().getBlockchain(), {'hash' : req.params.hash});
            res.send(block);
        });

        app.get('/blockchain/transactions', (req, res) => {
            if (req.headers['accept'] && req.headers['accept'].includes('text/html'))
                res.render('blockchain/transactions/index.pug', {
                    pageTitle: 'Unconfirmed Transactions',
                    transactions: TransactionPool.getInstance().getPool()
                });
            else
                res.status(200).send(TransactionPool.getInstance().getPool());
        });

        app.post('/blockchain/transactions', (req, res) => {
            try {
                const address = req.body.address;
                const amount = req.body.amount;

                if (address === undefined || amount === undefined) {
                    throw Error('invalid address or amount');
                }
                const resp = BlockChain.getInstance().sendTransaction(address, amount);
                res.send(resp);
            } catch (e) {
                console.log(e.message);
                res.status(400).send(e.message);
            }
        });

        app.get('/blockchain/transactions/:id([a-zA-Z0-9]{64})', (req, res) => {
            const tx = _(BlockChain.getInstance().getBlockchain())
                .map((blocks) => blocks.data)
                .flatten()
                .find({'id': req.params.id});
            res.send(tx);
        });

        app.get('/blockchain/transactions/unspent', (req, res) => {
            res.send(BlockChain.getInstance().getUnspentTxOuts());
        });

        app.get('/address/:address', (req, res) => {
            const unspentTxOuts: UnspentTxOut[] =
                _.filter(BlockChain.getInstance().getUnspentTxOuts(), (uTxO) => uTxO.address === req.params.address);
            res.send({'unspentTxOuts': unspentTxOuts});
        });

        app.get('/myUnspentTransactionOutputs', (req, res) => {
            res.send(BlockChain.getInstance().getMyUnspentTransactionOutputs());
        });

        app.post('/miner/mine', (req, res) => {
            const newBlock: Block = BlockChain.getInstance().generateNextBlock();
            if (newBlock === null) {
                res.status(400).send('could not generate block');
            } else {
                res.send(newBlock);
            }
        });

        app.post('/miner/mineRawBlock', (req, res) => {
            if (req.body.data == null) {
                res.send('data parameter is missing');
                return;
            }
            const newBlock: Block = BlockChain.getInstance().generateRawNextBlock(req.body.data);
            if (newBlock === null) {
                res.status(400).send('could not generate block');
            } else {
                res.send(newBlock);
            }
        });

        app.get('/balance', (req, res) => {
            const balance: number = BlockChain.getInstance().getAccountBalance();
            res.send({'balance': balance});
        });

        app.get('/address', (req, res) => {
            const address: string = Wallet.getInstance().getPublic();
            res.send({'address': address});
        });

        app.post('/mineTransaction', (req, res) => {
            const address = req.body.address;
            const amount = req.body.amount;
            try {
                const resp = BlockChain.getInstance().generatenextBlockWithTransaction(address, amount);
                res.send(resp);
            } catch (e) {
                console.log(e.message);
                res.status(400).send(e.message);
            }
        });

        

        app.get('/transactionPool', (req, res) => {
            res.send(TransactionPool.getInstance().getPool());
        });

        app.get('/node/peers', (req, res) => {
            res.send(P2pServer.getInstance().getSockets().map((s: any) => s._socket.remoteAddress + ':' + s._socket.remotePort));
        });
        app.post('/node/peers', (req, res) => {
            P2pServer.getInstance().connectToPeers(req.body.peer);
            res.send();
        });

        app.post('/stop', (req, res) => {
            res.send({'msg' : 'stopping server'});
            process.exit();
        });

        app.listen(Config.PORT_HTTP, () => {
            console.log('Listening http on port: ' + Config.PORT_HTTP);
        });
    }

    public static getInstance(): HttpServer {
        if (!HttpServer.instance) {
            HttpServer.instance = new HttpServer();
        }
        return HttpServer.instance;
    }
}