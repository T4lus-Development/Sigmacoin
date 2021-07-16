

export default class Peer {

    private host: string;
    private port: number;

    public url: string;

    constructor(host: string, port: number) {
        this.host = host;
        this.port = port;

        this.url = `http://${this.host}:${this.port}`;
    }

}