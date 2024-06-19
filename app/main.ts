import * as net from 'net';
import * as path from 'path';
import HTTPHandler from './handlers/http';  // Adjust the import path as needed

// Function to display help message
function displayHelp() {
    console.log(`Usage: node main.js [--directory <directory>] [--help | -h]
Options:
  --directory <directory>  Serve files from the specified directory.
  --help, -h               Show this help message and exit.
`);
    process.exit(0);
}

// Parse command line arguments
const args = process.argv.slice(2);
let directory = process.cwd(); // Default directory
if (args.includes("--help") || args.includes("-h")) {
    displayHelp();
}
const directoryFlagIndex = args.indexOf("--directory");
if (directoryFlagIndex !== -1 && directoryFlagIndex < args.length - 1) {
    directory = args[directoryFlagIndex + 1];
} else if (directoryFlagIndex !== -1) {
    console.error("Error: --directory flag requires a directory path");
    displayHelp();
}

// Create an instance of HTTPHandler
const httpHandler = new HTTPHandler(directory);

const server = net.createServer((socket) => {
    httpHandler.handleRawRequest(socket);
});

server.on("error", (err) => {
    throw err;
});

server.listen(4221, () => {
    console.log("Server is running on port 4221");
});
