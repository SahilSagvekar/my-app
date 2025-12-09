import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server } from 'socket.io';
import jwt from "jsonwebtoken";
import { Judson } from 'next/font/google';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  const io = new Server(httpServer, {
    cors: {
      origin: '*',
    },
  });

//  io.on('connection', (socket) => {
//   console.log('✅ User connected:', socket.id);
//    console.log('Auth token:', socket.handshake.auth.token);

//   // Get token from handshake
//   const token = socket.handshake.auth.token;
  
//   if (token) {
//     try {
//       // const jwt = require('jsonwebtoken');
//       const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
//       const userId = decoded.userId;
      
//       // Auto-join user to their room
//       socket.join(`user:${userId}`);
//       console.log(`✅ User ${userId} joined their notification room`);
//     } catch (err) {
//       console.log('❌ Invalid token');
//     }
//   }

//   socket.on('disconnect', () => {
//     console.log('❌ User disconnected:', socket.id);
//   });
// });

io.on('connection', (socket) => {
  console.log('✅ User connected:', socket.id);
  
  // const userId = socket.handshake.auth.userId;  // Changed from token
  // console.log('User ID:', userId);
  
  const token = socket.handshake.auth.token;
  console.log(token)
  
  if (token) {
    try {
      // const jwt = require('jsonwebtoken');
      const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
      const { userId } = decoded;

      console.log(JSON.stringify(decoded));
      console.log(userId);

      // Auto-join user to their room
      if (userId) {
        socket.join(`user:${userId}`);
        console.log(`✅ User ${userId} joined their notification room`);
      }
    } catch (err) {
      console.log("❌ Invalid token");
    }
  }
  
  

  socket.on('disconnect', () => {
    console.log('❌ User disconnected:', socket.id);
  });
});

  (global as any).io = io;

  httpServer.once('error', (err) => {
    console.error(err);
    process.exit(1);
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});