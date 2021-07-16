import * as R from 'ramda';
import * as superagent from 'superagent';

import * as Config from '../Config';
import * as Utils from '../Utils';

import Peer from './Peer';

import Blockchain from '../Core/Blockchain';
import Block from "../Core/Block";
import { Transaction } from "../Core/Transaction";


export default class Node {
    private static instance: Node;

    private peers = [];

    private constructor() {
        this.connectToPeers(Config.DEFAULT_PEERS);
    }

    public static getInstance = (): Node => {
        if (!Node.instance) {
            Node.instance = new Node();
        }
        return Node.instance;
    }

    public getPeers = () => this.peers

    public connectToPeer = (newPeer) => {
        this.connectToPeers([newPeer]);
        return newPeer;
    }

    public connectToPeers = (newPeers): void => {
        // Connect to every peer
        let me = `http://127.0.0.1:6001`;
        newPeers.forEach((peer) => {            
            // If it already has that peer, ignore.
            if (!this.peers.find((element) => { return element.url == peer.url; }) && peer.url != me) {
                this.sendPeer(peer, { url: me });
                console.info(`Peer ${peer.url} added to connections.`);
                this.peers.push(peer);
                this.initConnection(peer);
                this.broadcast(this.sendPeer, peer);
            } else {
                console.info(`Peer ${peer.url} not added to connections, because I already have.`);
            }
        }, this);
    }

    public initConnection = (peer) => {

        this.getLatestBlock(peer);
        this.getTransactions(peer);
    }

    public sendPeer = (peer, peerToSend) => {
        const URL = `${peer.url}/node/peers`;
        console.info(`Sending ${peerToSend.url} to peer ${URL}.`);
        return superagent
            .post(URL)
            .send(peerToSend)
            .catch((err) => {
                console.warn(`Unable to send me to peer ${URL}: ${err.message}`);
            });
    }

    public getLatestBlock = (peer) => {
        const URL = `${peer.url}/blockchain/blocks/latest`;
        let self = this;
        console.info(`Getting latest block from: ${URL}`);
        return superagent
            .get(URL)
            .then((res) => {
                // Check for what to do with the latest block
                self.checkReceivedBlock(Utils.JSONToObject<Block>(res.body));
                
            })
            .catch((err) => {
                console.warn(`Unable to get latest block from ${URL}: ${err.message}`);
            });
    }

    public sendLatestBlock = (peer, block: Block) => {
        const URL = `${peer.url}/blockchain/blocks/latest`;
        console.info(`Posting latest block to: ${URL}`);
        return superagent
            .put(URL)
            .send(block)
            .catch((err) => {
                console.warn(`Unable to post latest block to ${URL}: ${err.message}`);
            });
    }

    public getBlocks = (peer) => {
        const URL = `${peer.url}/blockchain/blocks`;
        let self = this;
        console.info(`Getting blocks from: ${URL}`);
        return superagent
            .get(URL)
            .then((res) => {
                // Check for what to do with the block list
                self.checkReceivedBlocks(Utils.JSONToObject<Block[]>(res.body));
                
            })
            .catch((err) => {
                console.warn(`Unable to get blocks from ${URL}: ${err.message}`);
            });
    }

    public sendTransaction = (peer, transaction: Transaction) => {
        const URL = `${peer.url}/blockchain/transactions`;
        console.info(`Sending transaction '${transaction.id}' to: '${URL}'`);
        return superagent
            .post(URL)
            .send(transaction)
            .catch((err) => {
                console.warn(`Unable to put transaction to ${URL}: ${err.message}`);
            });
    }

    public getTransactions = (peer) => {
        const URL = `${peer.url}/blockchain/transactions`;
        let self = this;
        console.info(`Getting transactions from: ${URL}`);
        return superagent
            .get(URL)
            .then((res) => {
                self.syncTransactions(Utils.JSONToObject<Transaction[]>(res.body));
            })
            .catch((err) => {
                console.warn(`Unable to get transations from ${URL}: ${err.message}`);
            });
    }

    public getConfirmation = (peer, transactionId) => {
        // Get if the transaction has been confirmed in that peer
        const URL = `${peer.url}/blockchain/blocks/transactions/${transactionId}`;        
        console.info(`Getting transactions from: ${URL}`);
        return superagent
            .get(URL)
            .then(() => {
                return true;
            })
            .catch(() => {
                return false;
            });
    }

    public getConfirmations = (transactionId) => {
        // Get from all peers if the transaction has been confirmed
        let foundLocally = Blockchain.getInstance().getTransactionFromBlocks(transactionId) != null ? true : false;
        return Promise.all(R.map((peer) => {
            return this.getConfirmation(peer, transactionId);
        }, this.peers))
            .then((values) => {
                return R.sum([foundLocally, ...values]);
            });
    }

    public broadcast = (fn, ...args) => {
        // Call the function for every peer connected
        console.info('Broadcasting');
        this.peers.map((peer) => {
            fn.apply(this, [peer, ...args]);
        }, this);
    }

    public syncTransactions = (transactions: Transaction[]) => {
        // For each received transaction check if we have it, if not, add.
        R.forEach((transaction) => {
            let transactionFound = Blockchain.getInstance().getTransactionById(transaction.id);

            if (transactionFound == null) {
                console.info(`Syncing transaction '${transaction.id}'`);
                Blockchain.getInstance().addTransaction(transaction);
            }
        }, transactions);
    }

    public checkReceivedBlock = (block: Block): boolean => {
        return this.checkReceivedBlocks([block]);
    }

    public checkReceivedBlocks= (blocks: Block[]) => {
        const receivedBlocks = blocks.sort((b1, b2) => (b1.index - b2.index));
        const latestBlockReceived = receivedBlocks[receivedBlocks.length - 1];
        const latestBlockHeld = Blockchain.getInstance().getLastBlock();

        // If the received blockchain is not longer than blockchain. Do nothing.
        if (latestBlockReceived.index <= latestBlockHeld.index) {
            console.info('Received blockchain is not longer than blockchain. Do nothing');
            return false;
        }

        console.info(`Blockchain possibly behind. We got: ${latestBlockHeld.index}, Peer got: ${latestBlockReceived.index}`);
        if (latestBlockHeld.hash === latestBlockReceived.previousHash) { // We can append the received block to our chain
            console.info('Appending received block to our chain');
            Blockchain.getInstance().addBlock(latestBlockReceived);
            return true;
        } else if (receivedBlocks.length === 1) { // We have to query the chain from our peer
            console.info('Querying chain from our peers');
            this.broadcast(this.getBlocks);
            return null;
        } else { // Received blockchain is longer than current blockchain
            console.info('Received blockchain is longer than current blockchain');
            Blockchain.getInstance().replaceChain(receivedBlocks);
            return true;
        }
    }

}