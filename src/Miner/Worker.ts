
import { expose } from "threads/worker"
import Block from "../Core/Block";


const ProofOfWork = {
    proveWorkFor(jsonBlock: Block, difficulty: number) {
        let blockDifficulty = null;
        let start = process.hrtime();
        let block = jsonBlock;
    
        // INFO: Every cryptocurrency has a different way to prove work, this is a simple hash sequence
    
        // Loop incrementing the nonce to find the hash at desired difficulty
        do {
            block.timestamp = new Date().getTime() / 1000;
            block.nonce++;
            block.hash = block.toHash();
            blockDifficulty = block.getDifficulty();
        } while (blockDifficulty >= difficulty);
    
        console.info(`Block found: time '${process.hrtime(start)[0]} sec' dif '${difficulty}' hash '${block.hash}' nonce '${block.nonce}'`);
        return block;
    }
}

export type ProofOfWork = typeof ProofOfWork
expose(ProofOfWork);

