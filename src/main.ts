
import Blockchain from './Core/Blockchain';
import HttpServer from './Http/HttpServer';
import Miner from './Miner/Miner';
import Node from './Node/Node';
import Operator from './Operator/Operator';



Blockchain.getInstance();
HttpServer.getInstance().listen('127.0.0.1', 3001);
Miner.getInstance();
Node.getInstance();
Operator.getInstance();