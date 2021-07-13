import ExtendedError from './extendedError';
const statuses = require('statuses');

export default class HTTPError extends ExtendedError {
    constructor(status, message, context?, original?) {
        super(message, context, original);
        
        if (!message) 
            message = status + ' - ' + statuses[status];
        
        if (status) 
            this.status = status;
    }
}