import * as net from 'net';
import HTTPHandler from './handlers/http';  // Adjust the import path as needed

const directoryPath = process.argv[3] || './'; // Default to current directory if not provided
const httpHandler = new HTTPHandler(directoryPath);

const server = net.createServer((socket) => {
    httpHandler.handleRawRequest(socket);
});

console.log("Logs from your program will appear here!");

server.listen(4221, 'localhost', () => {
    console.log('Server is running on port 4221');
});
