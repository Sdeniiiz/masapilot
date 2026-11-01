import * as signalR from '@microsoft/signalr';
import { api } from './api';

class SignalRManager {
  private orderHub: signalR.HubConnection | null = null;
  private kitchenHub: signalR.HubConnection | null = null;
  private isConnected = false;
  private branchId: string | null = null;

  async init(branchId: string) {
    this.branchId = branchId;
    const token = api.getToken();

    this.orderHub = new signalR.HubConnectionBuilder()
      .withUrl('/hubs/orders', {
        accessTokenFactory: () => api.getToken() || '',
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000])
      .build();

    this.kitchenHub = new signalR.HubConnectionBuilder()
      .withUrl('/hubs/kitchen', {
        accessTokenFactory: () => api.getToken() || '',
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000])
      .build();

    try {
      await this.orderHub.start();
      await this.orderHub.invoke('JoinBranchGroup', branchId);

      await this.kitchenHub.start();
      await this.kitchenHub.invoke('JoinBranchGroup', branchId);

      this.isConnected = true;
    } catch (err) {
      console.warn('[SignalR] WebSocket bağlantısı kurulamadı, polling modu etkin:', err);
      this.isConnected = false;
    }
  }

  onTableStatusChanged(callback: (data: any) => void) {
    this.orderHub?.on('TableStatusChanged', callback);
  }

  onOrderAdded(callback: (data: any) => void) {
    this.orderHub?.on('OrderAdded', callback);
  }

  onPaymentReceived(callback: (data: any) => void) {
    this.orderHub?.on('PaymentReceived', callback);
  }

  onNewKitchenOrder(callback: (data: any) => void) {
    this.kitchenHub?.on('NewKitchenOrder', callback);
  }

  onLineStatusUpdated(callback: (data: any) => void) {
    this.kitchenHub?.on('LineStatusUpdated', callback);
  }

  getIsConnected() {
    return this.isConnected;
  }
}

export const signalRManager = new SignalRManager();
