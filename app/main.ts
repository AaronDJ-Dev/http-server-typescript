import * as net from 'net';

const server = net.createServer((socket: any) => {
    console.log('Client is connected');
    socket.on('data', (data: any) => {
        const dataStr = data.toString();
        console.log('Data received: ', dataStr);
        const path = dataStr.split('\r\n')[0].split(' ')[1];
        console.log('path', path);
        const query = path.split('/')[2];
        console.log('pathBody', query);
        if (path === '/') {
            socket.write('HTTP/1.1 200 OK\r\n\r\n');
        } else if (path === `/echo/${query}`) {
            socket.write(`HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: ${query.length}\r\n\r\n${query}`)
        } else {
            socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
        }
        console.log('Client diconnecting');
        socket.end();
    });
});

console.log("Logs from your program will appear here!");

server.listen(4221, 'localhost', () => {
    console.log('Server is running on port 4221');
});