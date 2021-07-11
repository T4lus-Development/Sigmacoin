

import BlockChain from './Core/BlockChain';
import TransactionPool from './Core/TransactionPool';
import Wallet from './Wallet/Wallet';
import HttpServer from './HTTP/HttpServer';
import P2pServer from './P2P/P2pServer';


BlockChain.getInstance();
TransactionPool.getInstance();
Wallet.getInstance();
HttpServer.getInstance();
P2pServer.getInstance();

