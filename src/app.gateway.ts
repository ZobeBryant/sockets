import { Logger } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
// 自定义 WebSocketGateway
@WebSocketGateway({
  path: '/socket',
  allowEIO3: true,
  cors: {
    origin: /.*/,
    credentials: true,
  },
})
export class AppGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private logger: Logger = new Logger('AppGateway');
  @WebSocketServer() private ws: Server; // socket 实例
  private users: any = {}; // 人数信息
  // 断开连接
  handleDisconnect(client: Socket) {
    const disconnectUserName = this.users[client.id].name;
    delete this.users[client.id];
    this.ws.emit('leave', {
      name: disconnectUserName,
    });
    const userList = Object.keys(this.users).map((uid) => ({
      uid,
      name: this.users[uid].name,
    }));
    // 全员更新在线用户列表
    this.ws.emit('update', userList);
  }
  // 连接成功
  handleConnection(client: Socket) {
    this.users[client.id] = {
      name: `user-${client.id}`,
      client,
    };
    const userList = Object.keys(this.users).map((uid) => ({
      uid,
      name: this.users[uid].name,
    }));
    // 当前连接同步连接状态;
    client.emit('status', {
      type: 'connect',
      data: {
        uid: client.id,
        name: this.users[client.id].name,
        message: '连接成功',
      },
    });
    // 全员更新在线用户列表
    this.ws.emit('update', userList);
    // 全员新用户上线通知
    this.ws.emit('enter', {
      name: this.users[client.id].name,
    });
  }
  // 初始化
  afterInit(client: any) {
    this.logger.log('socket init ...');
  }

  // //监听 message 事件
  @SubscribeMessage('message')
  handleMessage(client: Socket, data: any): void {
    const { to, message } = data;

    this.users[to] &&
      this.users[to].client.emit('message', {
        from: client.id,
        message: message,
      });
  }

  // 监听 name 事件
  @SubscribeMessage('name')
  handleName(client: Socket, data: any): void {
    this.users[client.id].name = data;
    // 用户修改昵称
    client.emit('status', {
      type: 'updateName',
      data: {
        uid: client.id,
        name: this.users[client.id].name,
        message: '用户名修改成功',
      },
    });
    const userList = Object.keys(this.users).map((uid) => ({
      uid,
      name: this.users[uid].name,
    }));

    // 全员更新在线用户列表
    this.ws.emit('update', userList);
  }
}
