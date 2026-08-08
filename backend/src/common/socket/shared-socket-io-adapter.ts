import { IoAdapter } from '@nestjs/platform-socket.io';
import { Server, ServerOptions } from 'socket.io';

export class SharedSocketIoAdapter extends IoAdapter {
  private sharedServer: Server | null = null;

  createIOServer(port: number, options?: ServerOptions): Server {
    if (this.sharedServer) {
      return this.sharedServer;
    }
    const server = super.createIOServer(port, options);
    this.sharedServer = server;
    return server;
  }
}
