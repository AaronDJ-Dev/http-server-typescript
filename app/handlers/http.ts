import { Socket } from 'net';
import * as fs from 'fs';
import * as zlib from 'zlib';

export default class HTTPHandler {
    private readonly directoryPath: string;
    constructor(directoryPath: string) {
        this.directoryPath = directoryPath;
    }
    private extractHeaders(request: string): { [key: string]: string } {
        const headers: { [key: string]: string } = {};
        const lines = request.split('\r\n');
        for (let i = 1; i < lines.length; i++) {
            if (lines[i] === '') {
                break;
            }
            const [key, value] = lines[i].split(': ');
            headers[key] = value;
        }
        return headers;
    }
    private extractPath(request: string): {
        method: string;
        path: string[];
        protocol: string;
    } {
        const lines = request.split('\r\n');
        const [method, path, protocol] = lines[0].split(' ');
        return {
            method,
            path: path.split('/').filter((value) => value !== ''),
            protocol,
        };
    }
    private extractBody(request: string): string {
        const lines = request.split('\r\n');
        for (let i = 1; i < lines.length; i++) {
            if (lines[i] === '') {
                return lines.slice(i + 1).join('\r\n');
            }
        }
        return '';
    }
    private formHTTPResponse(
        statusCode: number,
        statusString?: string,
        body?: string,
        headers?: { [key: string]: string },
    ): string {
        let response = `HTTP/1.1 ${statusCode} ${statusString || ''}\r\n`;
        if (headers) {
            for (const key in headers) {
                response += `${key}: ${headers[key]}\r\n`;
            }
        }
        if (body) {
            response += `Content-Length: ${Buffer.byteLength(body)}\r\n`;
            response += '\r\n';
            response += body;
        }
        response += '\r\n';
        return response;
    }
    private compressResponseBody(
        body: string,
        encoding: string,
        callback: (err: Error | null, result: Buffer) => void
    ): void {
        switch (encoding) {
            case 'gzip':
                zlib.gzip(body, callback);
                break;
            case 'deflate':
                zlib.deflate(body, callback);
                break;
            default:
                callback(null, Buffer.from(body));
        }
    }
    handleRawRequest(socket: Socket): void {
        console.log('Received request');
        socket.on('data', (data) => {
            const requestString = data.toString();
            const headers = this.extractHeaders(requestString);
            const { method, path, protocol } = this.extractPath(requestString);
            const body = this.extractBody(requestString);
            const acceptEncoding = headers['accept-encoding'] || '';
            const encodings = acceptEncoding.split(',').map((enc) => enc.trim());
            const supportedEncodings = ['gzip', 'deflate'];
            const selectedEncoding = encodings.find((enc) => supportedEncodings.includes(enc)) || '';

            console.log('Request headers:', headers);
            console.log('Request method:', method);
            console.log('Request path:', path);
            console.log('Request protocol:', protocol);
            console.log('Request body:', body);

            let response;
            switch (path[0]) {
                case 'echo':
                    // Echo back path[1]
                    response = this.formHTTPResponse(200, 'OK', path[1], {
                        'Content-Type': 'text/plain',
                        ...(selectedEncoding && { 'Content-Encoding': selectedEncoding }),
                    });
                    break;
                case 'user-agent':
                    // Echo back the User-Agent header
                    response = this.formHTTPResponse(
                        200,
                        'OK',
                        headers['user-agent'],
                        {
                            'Content-Type': 'text/plain',
                        },
                    );
                    break;
                case 'files': {
                    if (method === 'GET') {
                        // Get the filename from path[1]
                        const filename = path[1];
                        // Do we have a file in the directory with that name?
                        const dir = fs.readdirSync(this.directoryPath);
                        if (dir.includes(filename)) {
                            // If we do, read it and send it back
                            const file = fs.readFileSync(
                                `${this.directoryPath}/${filename}`,
                            );
                            response = this.formHTTPResponse(
                                200,
                                'OK',
                                file.toString(),
                                {
                                    'Content-Type': 'application/octet-stream',
                                },
                            );
                        } else {
                            // If we don't, send back a 404
                            response = this.formHTTPResponse(404, 'Not Found');
                        }
                    } else if (method === 'POST') {
                        // Write the body to a file with the name path[1]
                        const filename = path[1];
                        fs.writeFileSync(
                            `${this.directoryPath}/${filename}`,
                            body,
                        );
                        response = this.formHTTPResponse(201, 'Created');
                    }
                    break;
                }
                default:
                    if (path.length === 1) {
                        response = this.formHTTPResponse(404, 'Not Found');
                    } else {
                        response = this.formHTTPResponse(200, 'OK', path[1], {
                            'Content-Type': 'text/plain',
                        });
                    }
            }

            if (response) {
                const [statusLine, ...responseHeadersAndBody] = response.split('\r\n');
                const responseBodyIndex = responseHeadersAndBody.indexOf('');
                const responseBody = responseHeadersAndBody.slice(responseBodyIndex + 1).join('\r\n');
                const responseHeaders = responseHeadersAndBody.slice(0, responseBodyIndex).join('\r\n');

                if (selectedEncoding) {
                    this.compressResponseBody(responseBody, selectedEncoding, (err, compressedBody) => {
                        if (err) {
                            console.error('Error compressing response:', err);
                            socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
                        } else {
                            socket.write(statusLine + '\r\n' + responseHeaders + '\r\n' + `Content-Length: ${compressedBody.length}\r\n\r\n`);
                            socket.write(compressedBody);
                        }
                        socket.end();
                        console.log('Sent response and closed connection');
                    });
                } else {
                    socket.write(response);
                    socket.end();
                    console.log('Sent response and closed connection');
                }
            } else {
                console.log('Response is undefined, not sending');
            }
        });
    }
}
