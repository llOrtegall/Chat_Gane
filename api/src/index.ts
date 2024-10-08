// TODO: Importar las dependencias necesarias
import cookieParser from 'cookie-parser';
import express from 'express';
import jwt from 'jsonwebtoken';
import morgan from 'morgan';
import cors from 'cors';


// TODO: Importar las variables de entorno  y types
import { JWT_SECRET, ORIGIN_URL, PORT } from './config'
import { ExtendedWebSocket, MessageDataInt } from './types/types'

// TODO: Importar las rutas de la API
import messageRouter from './routes/message.routes';
import userRouter from './routes/user.routes';

import { testDatabaseConnection } from './test/conectionDb';
import { MessageModel } from './model/Message.model';
import { clearInterval } from 'timers';

import { WebSocketServer } from 'ws';


const app = express();

app.disable('x-powered-by');

app.use(cookieParser());

app.use(cors({ origin: [ORIGIN_URL], credentials: true }));

app.use(morgan('dev'));

app.use(express.json());

// TODO: Rutas de la API

app.get('/', (req, res) => {
  res.send('API running');
});

app.use(userRouter);

app.use(messageRouter);


const server = app.listen(PORT, () => {
  console.log(`API listening at http://localhost:${PORT}`);
});

// TODO: Implementar el WebSocketServer para el chat
const wss = new WebSocketServer({ server });

wss.on('connection', (socket: ExtendedWebSocket, req) => {

  function notifyOnlineUsers() {
    [...wss.clients].forEach((client: ExtendedWebSocket) => {
      client.send(JSON.stringify({
        online: [...wss.clients].map((client: ExtendedWebSocket) => ({ userId: client.userId, email: client.email }))
      }));
    });
  }

  socket.isAlive = true;

  socket.timer = setInterval(() => {
    socket.ping();
    socket.deathTimer = setTimeout(() => {
      socket.isAlive = false;
      clearInterval(socket.timer);
      socket.terminate();
      notifyOnlineUsers();
    }, 2000);
  }, 10000);

  socket.on('pong', () => {
    clearInterval(socket.deathTimer);
  });

  // TODO: esto es para verificar si el usuario está autenticado y obtener su userId y email
  const cookies = req.headers.cookie;

  if (cookies) {
    const tokenCookieString = cookies.split(';').find((cookie: string) => cookie.includes('token'));
    if (tokenCookieString) {
      const token = tokenCookieString.split('=')[1];
      if (token) {
        jwt.verify(token, JWT_SECRET, {}, async (err: any, decoded: any) => {
          if (err) throw err;
          const { userId, email } = decoded;
          socket.userId = userId;
          socket.email = email;
        });
      }
    }
  }

  socket.on('message', async (message: string) => {
    const messageData: MessageDataInt = JSON.parse(message)
    const { recipient, text } = messageData;

    if (recipient && text) {
      const newMessageDoc = await MessageModel.create({ sender: socket.userId, recipient, text });
      [...wss.clients]
        .filter((client: ExtendedWebSocket) => client.userId === recipient)
        .forEach((client: ExtendedWebSocket) => {
          client.send(JSON.stringify({
            messages: { text, sender: socket.userId, recipient, _id: newMessageDoc._id }
          }));
        })
    }
  });

  // TODO: enviar a todos los clientes conectados la lista de usuarios conectados
  notifyOnlineUsers();

});

testDatabaseConnection()
  .then(() => {})
  .catch((error) => {
    console.error('Error connecting to MongoDB', error);
    process.exit(1);
  });