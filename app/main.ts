import * as net from "net";
import fs from "node:fs";

const server = net.createServer((socket) => {
  socket.on("data", (data) => {
    let splitedData = data.toString().split("\r\n");
    const path = splitedData[0].split(" ")[1];
    const headers = splitedData.slice(1, -2);
    if (path === "/") {
      socket.write("HTTP/1.1 200 OK\r\n\r\n");
    } else if (path.indexOf("/echo/") === 0) {
      const query = path.slice(6);
      socket.write(
        `HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: ${query.length}\r\n\r\n${query}`
      );
    } else if (path.indexOf("/user-agent") === 0) {
      const agent = headers
        .find((h) => h.indexOf("User-Agent: ") === 0)!
        .slice(12);
      socket.write(
        `HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: ${agent.length}\r\n\r\n${agent}`
      );
    } else if (path.startsWith("/files/")) {
      const [_, __, fileName] = path.split("/");
      const args = process.argv.slice(2);
      const [___, absPath] = args;
      const filePath = absPath + "/" + fileName;
      try {
        const content = fs.readFileSync(filePath);
        socket.write(
          `HTTP/1.1 200 OK\r\nContent-Type: application/octet-stream\r\nContent-Length: ${content.length}\r\n\r\n${content}`
        );
      } catch (error) {
        socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
      }
    } else {
      socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
    }
    socket.end();
  });
});

console.log("Logs from your program will appear here!");

server.listen(4221, "localhost", () => {
  console.log("Server is running on port 4221");
});