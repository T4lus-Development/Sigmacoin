# Sigmacoin


```
npm install
npm start
```

#### HTTP Server
Provides an API to manage the blockchain, wallets, addresses, transaction creation, mining request and peer connectivity.
It's the starting point to interact with Sigmacoin, and every node provides a swagger API to make this interaction easier. Available endpoints:

##### Blockchain

|Status|Method|URL|Description|
|------|------|---|-----------|
|:heavy_check_mark:|GET|/blockchain/blocks|Get all blocks|
|:heavy_check_mark:|GET|/blockchain/blocks/{index}|Get block by index|
|:heavy_check_mark:|GET|/blockchain/blocks/{hash}|Get block by hash|
|:heavy_check_mark:|GET|/blockchain/blocks/latest|Get the latest block|
|:heavy_check_mark:|GET|/blockchain/transactions/{id}|Get a transaction from some block|
|:heavy_check_mark:|GET|/blockchain/transactions|Get unconfirmed transactions|
|:heavy_check_mark:|POST|/blockchain/transactions|Create a transaction|
|:heavy_check_mark:|GET|/blockchain/transactions/unspent|Get unspent transactions|

##### Operator

|Status|Method|URL|Description|
|------|------|---|-----------|
||GET|/operator/wallets|Get all wallets|
||POST|/operator/wallets|Create a wallet from a password|
||GET|/operator/wallets/{walletId}|Get wallet by id|
||GET|/operator/wallets/{walletId}/addresses|Get all addresses of a wallet|
||POST|/operator/wallets/{walletId}/transactions|Create a new transaction|
||POST|/operator/wallets/{walletId}/addresses|Create a new address|
||GET|/operator/{addressId}/balance|Get the balance of a given address|

##### Node

|Status|Method|URL|Description|
|------|------|---|-----------|
|:heavy_check_mark:|GET|/node/peers|Get all peers connected to node|
|:heavy_check_mark:|POST|/node/peers|Connects a new peer to node|
||GET|/node/transactions/{transactionId}/confirmations|Get how many confirmations a block has|

##### Miner

|Status|Method|URL|Description|
|------|------|---|-----------|
|:heavy_check_mark:|POST|/miner/mine|Mine a new block|


##### Swagger

|Status|Method|URL|Description|
|------|------|---|-----------|
|:heavy_check_mark:|GET|/api|swagger interface|
