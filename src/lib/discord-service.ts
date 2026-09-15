/**
 * Discord Webhook Notification Service
 * Handles sending notifications to Discord via webhooks with rich formatting
 */

export interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number;
  fields?: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
  thumbnail?: {
    url: string;
  };
  timestamp?: string;
}

export interface DiscordMessage {
  content?: string;
  embeds?: DiscordEmbed[];
}

export interface DiscordConfig {
  webhookUrl: string;
  defaultChannel?: string;
  defaultRole?: string;
  enabled: boolean;
}

export class DiscordNotificationService {
  private static instance: DiscordNotificationService;
  private config: DiscordConfig | null = null;

  private constructor() {}

  public static getInstance(): DiscordNotificationService {
    if (!DiscordNotificationService.instance) {
      DiscordNotificationService.instance = new DiscordNotificationService();
    }
    return DiscordNotificationService.instance;
  }

  public configure(config: DiscordConfig): void {
    this.config = config;
  }

  public async sendMessage(message: DiscordMessage): Promise<boolean> {
    if (!this.config || !this.config.enabled || !this.config.webhookUrl) {
      console.log('Discord notifications disabled or not configured');
      return false;
    }

    try {
      const response = await fetch(this.config.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      return response.ok;
    } catch (error) {
      console.error('Failed to send Discord message:', error);
      return false;
    }
  }

  public async sendIndustryComplete(
    pilotName: string,
    itemName: string,
    count: number,
    completionTime: string,
    role?: string
  ): Promise<boolean> {
    const mention = role ? `<@&${role}>` : `@${pilotName}`;
    
    const embed: DiscordEmbed = {
      title: '🏭 Industry Job Complete',
      description: `${mention} - your LMeve industry task is complete!`,
      color: 0x00ff00,
      fields: [
        {
          name: 'Item',
          value: itemName,
          inline: true,
        },
        {
          name: 'Quantity',
          value: count.toString(),
          inline: true,
        },
        {
          name: 'Completed',
          value: completionTime,
          inline: true,
        },
      ],
      timestamp: new Date().toISOString(),
    };

    return this.sendMessage({
      content: `Hey ${mention}!`,
      embeds: [embed],
    });
  }

  public async sendQueueAlert(
    adminRole?: string,
    customMessage?: string
  ): Promise<boolean> {
    const mention = adminRole ? `<@&${adminRole}>` : '@lmeve_admin';
    const message = customMessage || 'Queues are running low - you need to setup additional industry tasking!';

    const embed: DiscordEmbed = {
      title: '⚠️ Queue Alert',
      description: `${mention} - ${message}`,
      color: 0xff9900,
      timestamp: new Date().toISOString(),
    };

    return this.sendMessage({
      content: `Hey ${mention}!`,
      embeds: [embed],
    });
  }

  public async sendCustomAlert(
    title: string,
    message: string,
    color: number = 0x0099ff,
    mentions?: string[]
  ): Promise<boolean> {
    let content = '';
    if (mentions && mentions.length > 0) {
      content = mentions.join(' ');
    }

    const embed: DiscordEmbed = {
      title,
      description: message,
      color,
      timestamp: new Date().toISOString(),
    };

    return this.sendMessage({
      content,
      embeds: [embed],
    });
  }

  // Missing method used by NotificationManager
  async sendNotification(
    eventType: string,
    eventData: Record<string, any>,
    settings: any
  ): Promise<boolean> {
    const content = eventData.pilot_name ? `@${eventData.pilot_name} updated ${eventData.item_name}` : undefined;
    const embed: DiscordEmbed = {
      title: `LMeve Notification: ${eventType}`,
      description: JSON.stringify(eventData, null, 2),
      color: 0x0099ff,
      timestamp: new Date().toISOString(),
    };

    return this.sendMessage({
      content,
      embeds: [embed],
    });
  }

  async testWebhook(webhookUrl?: string, botName?: string): Promise<boolean> {
    if (!webhookUrl) return false;

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: `Webhook test from ${botName || 'LMEve'}${botName ? ` (${botName})` : ''}`,
          username: botName || 'LMEve',
        }),
      });
      return response.ok;
    } catch (error) {
      console.error('Webhook test failed:', error);
      return false;
    }
  }

  getNotificationStats(): { [key: string]: { lastSent: number | null; nextAllowed: number | null } } {
    return {
      default: { lastSent: null, nextAllowed: null },
    };
  }
}

export const discordService = DiscordNotificationService.getInstance();