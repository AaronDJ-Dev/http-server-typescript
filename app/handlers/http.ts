import { Socket } from 'net';
import * as fs from 'fs';

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
            response += `Content-Length: ${body.length}\r\n`;
            response += '\r\n';
            response += body;
        }
        response += '\r\n';
        return response;
    }
    handleRawRequest(request: Socket): void {
        console.log('Received request');
        request.on('data', (data) => {
            const requestString = data.toString();
            const headers = this.extractHeaders(requestString);
            const { method, path, protocol } = this.extractPath(requestString);
            const body = this.extractBody(requestString);
            const isValidContentEncoding =
                headers['Accept-Encoding'] === 'gzip' ||
                headers['Accept-Encoding'] === 'deflate' ||
                headers['Accept-Encoding'] === 'br' ||
                headers['Accept-Encoding'] === 'zstd';
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
                        ...(isValidContentEncoding && {
                            'Content-Encoding': headers['Accept-Encoding'],
                        }),
                    });
                    break;
                case 'user-agent':
                    // Echo back the User-Agent header
                    response = this.formHTTPResponse(
                        200,
                        'OK',
                        headers['User-Agent'],
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
                console.log('Sending response:', response);
                request.write(response);
            } else {
                console.log('Response is undefined, not sending');
            }
            request.end();
            console.log('Sent response and closed connection');
        });
    }
}
