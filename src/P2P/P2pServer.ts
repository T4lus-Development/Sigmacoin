
import * as WebSocket from 'ws';
import {Server} from 'ws';

import * as Config from '../Config';
import Utils from '../Utils';
import Block from '../Core/Block';
import { Transaction } from '../Core/Transaction';
import BlockChain from '../Core/BlockChain';
import TransactionPool from '../Core/TransactionPool';

import {Message, MessageType} from '../P2P/Message';


export default class P2pServer {
    private static instance: P2pServer;

    private sockets: WebSocket[] = [];

    private constructor() {
        const server: Server = new WebSocket.Server({port: Config.PORT_P2P});

        server.on('connection', (ws: WebSocket) => {
            this.initConnection(ws);
        });
        console.log('listening websocket p2p port on: ' + Config.PORT_P2P);
    }

    public static getInstance = (): P2pServer => {
        if (!P2pServer.instance) {
            P2pServer.instance = new P2pServer();
        }
        return P2pServer.instance;
    }

    public getSockets = () => {
        return this.sockets;
    }

    public initConnection = (ws: WebSocket) => {
        this.sockets.push(ws);
        this.initMessageHandler(ws);
        this.initErrorHandler(ws);
        this.write(ws, this.queryChainLengthMsg());
    
        // query transactions pool only some time after chain query
        setTimeout(() => {
            this.broadcast(this.queryTransactionPoolMsg());
        }, 500);
    };

    private initMessageHandler = (ws: WebSocket) => {
        ws.on('message', (data: string) => {
    
            try {
                const message: Message = Utils.JSONToObject<Message>(data);
                if (message === null) {
                    console.log('could not parse received JSON message: ' + data);
                    return;
                }
                console.log('Received message: %s', JSON.stringify(message));
                switch (message.type) {
                    case MessageType.QUERY_LATEST:
                        this.write(ws, this.responseLatestMsg());
                        break;
                    case MessageType.QUERY_ALL:
                        this.write(ws, this.responseChainMsg());
                        break;
                    case MessageType.RESPONSE_BLOCKCHAIN:
                        const receivedBlocks: Block[] = Utils.JSONToObject<Block[]>(message.data);
                        if (receivedBlocks === null) {
                            console.log('invalid blocks received: %s', JSON.stringify(message.data));
                            break;
                        }
                        this.handleBlockchainResponse(receivedBlocks);
                        break;
                    case MessageType.QUERY_TRANSACTION_POOL:
                        this.write(ws, this.responseTransactionPoolMsg());
                        break;
                    case MessageType.RESPONSE_TRANSACTION_POOL:
                        const receivedTransactions: Transaction[] = Utils.JSONToObject<Transaction[]>(message.data);
                        if (receivedTransactions === null) {
                            console.log('invalid transaction received: %s', JSON.stringify(message.data));
                            break;
                        }
                        receivedTransactions.forEach((transaction: Transaction) => {
                            try {
                                BlockChain.getInstance().handleReceivedTransaction(transaction);
                                // if no error is thrown, transaction was indeed added to the pool
                                // let's broadcast transaction pool
                                this.broadCastTransactionPool();
                            } catch (e) {
                                console.log(e.message);
                            }
                        });
                        break;
                }
            } catch (e) {
                console.log(e);
            }
        });
    };

    private write = (ws: WebSocket, message: Message): void => ws.send(JSON.stringify(message));
    private broadcast = (message: Message): void => this.sockets.forEach((socket) => this.write(socket, message));

    private queryChainLengthMsg = (): Message => ({'type': MessageType.QUERY_LATEST, 'data': null});
    private queryAllMsg = (): Message => ({'type': MessageType.QUERY_ALL, 'data': null});

    private responseChainMsg = (): Message => ({
        'type': MessageType.RESPONSE_BLOCKCHAIN, 'data': JSON.stringify(BlockChain.getInstance().getBlockchain())
    });
    
    private responseLatestMsg = (): Message => ({
        'type': MessageType.RESPONSE_BLOCKCHAIN,
        'data': JSON.stringify([BlockChain.getInstance().getLatestBlock()])
    });
    
    private queryTransactionPoolMsg = (): Message => ({
        'type': MessageType.QUERY_TRANSACTION_POOL,
        'data': null
    });
    
    private responseTransactionPoolMsg = (): Message => ({
        'type': MessageType.RESPONSE_TRANSACTION_POOL,
        'data': JSON.stringify(TransactionPool.getInstance().getPool())
    });
    
    private initErrorHandler = (ws: WebSocket) => {
        const closeConnection = (myWs: WebSocket) => {
            console.log('connection failed to peer: ' + myWs.url);
            this.sockets.splice(this.sockets.indexOf(myWs), 1);
        };
        ws.on('close', () => closeConnection(ws));
        ws.on('error', () => closeConnection(ws));
    };

    private handleBlockchainResponse = (receivedBlocks: Block[]) => {
        if (receivedBlocks.length === 0) {
            console.log('received block chain size of 0');
            return;
        }
        const latestBlockReceived: Block = receivedBlocks[receivedBlocks.length - 1];
        if (!BlockChain.getInstance().isValidBlockStructure(latestBlockReceived)) {
            console.log('block structuture not valid');
            return;
        }
        const latestBlockHeld: Block = BlockChain.getInstance().getLatestBlock();
        if (latestBlockReceived.index > latestBlockHeld.index) {
            console.log('blockchain possibly behind. We got: ' + latestBlockHeld.index + ' Peer got: ' + latestBlockReceived.index);
            if (latestBlockHeld.hash === latestBlockReceived.previousHash) {
                if (BlockChain.getInstance().addBlockToChain(latestBlockReceived)) {
                    this.broadcast(this.responseLatestMsg());
                }
            } else if (receivedBlocks.length === 1) {
                console.log('We have to query the chain from our peer');
                this.broadcast(this.queryAllMsg());
            } else {
                console.log('Received blockchain is longer than current blockchain');
                BlockChain.getInstance().replaceChain(receivedBlocks);
            }
        } else {
            console.log('received blockchain is not longer than received blockchain. Do nothing');
        }
    };

    public broadcastLatest = (): void => {
        this.broadcast(this.responseLatestMsg());
    };
    
    public connectToPeers = (newPeer: string): void => {
        const ws: WebSocket = new WebSocket(newPeer);
        ws.on('open', () => {
            this.initConnection(ws);
        });
        ws.on('error', () => {
            console.log('connection failed');
        });
    };
    
    public broadCastTransactionPool = () => {
        this.broadcast(this.responseTransactionPoolMsg());
    };
}